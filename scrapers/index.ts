import { v4 as uuidv4 } from 'uuid'
import { readLocations, readPending, writePending } from '@/lib/data'
import { isDuplicate, similarity } from '@/lib/dedup'
import { extractPlaceId } from '@/lib/maps'
import type { PendingLocation, Category, Source } from '@/lib/types'
import { scrapeGoogleMaps, scrapeGoogleMapsQueries } from './googlemaps'
import { enrichItem } from './enricher'
import { classifyCategory } from './extract'
import { categoryLabel } from './shared'
import { findTrendingCandidates, type TrendingCandidate } from './trending'

// trending：找近一個月被社群/媒體提到的店（預設）
// stock：用 Google 地圖固定關鍵字補庫存（評價好的常青店，跟熱不熱門無關）
export type ScrapeMode = 'trending' | 'stock'

// 一次最多拿幾家去 Google 驗證（每家一次 Places 查詢，控制費用）
const MAX_VERIFY = 45
// 進待審的門檻：太低分或評論太少的店多半是對錯店或品質不穩
const MIN_RATING = 4.2
const MIN_REVIEWS = 15
// 新開幕的店評論本來就少，放寬
const MIN_REVIEWS_NEW = 5

const GENERIC_TOKENS = new Set([
  'bangkok', 'cafe', 'café', 'coffee', 'restaurant', 'bar', 'the', 'thai', 'house', 'kitchen',
  'bistro', 'roasters', 'roaster', 'bakery', 'rooftop', 'hotel', 'branch', 'and',
])
const hasThai = (s: string) => /[฀-๿]/.test(s)
const hasLatin = (s: string) => /[a-z]/i.test(s)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u0E00-\u0E7F\u4E00-\u9FFF]+/gi, '')

// Google 回來的店名要跟來源寫的店名對得上，否則就是搜到不相干的店（舊版「Hi tiktok」「貨運行」就是這樣混進來的）
function nameMatches(wanted: string, got: string): boolean {
  // 一邊純泰文、一邊純英文時無從比對字面，交給範圍限制與評分門檻把關
  if ((hasThai(wanted) && !hasLatin(wanted) && !hasThai(got)) || (hasThai(got) && !hasLatin(got) && !hasThai(wanted))) return true
  const a = norm(wanted), b = norm(got)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  if (similarity(a, b) >= 0.5) return true
  const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9\u00C0-\u024F\u0E00-\u0E7F\u4E00-\u9FFF]+/i).filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t))
  const tb = new Set(tokens(got))
  return tokens(wanted).some((t) => tb.has(t))
}

function sourceOf(c: TrendingCandidate): Source {
  const url = c.evidence[0]?.url ?? ''
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('pantip.com')) return 'pantip'
  if (url.includes('wongnai.com')) return 'wongnai'
  return 'media'
}

async function runTrending(existing: PendingLocation[], newItems: PendingLocation[]) {
  const knownPlaceIds = new Set(existing.map((l) => extractPlaceId(l.source_url)).filter(Boolean) as string[])
  // 只留有熱度訊號的：來源明說是新開幕，或被兩個以上來源提到。
  // 只被單一來源順帶提到的老店（例如米其林名單）不算熱點。
  // 已上架/待審裡已經有的店也先濾掉，不浪費 Google 查詢。
  const candidates = (await findTrendingCandidates())
    .filter((c) => c.isNew || c.mentions >= 2)
    .filter((c) => !isDuplicate({ name_en: c.name }, existing))
    .slice(0, MAX_VERIFY)

  const skipped: Record<string, number> = {}
  const skip = (why: string, name: string, detail = '') => {
    skipped[why] = (skipped[why] ?? 0) + 1
    console.log(`[trending] skip "${name}" — ${why}${detail ? `（${detail}）` : ''}`)
  }

  for (const c of candidates) {
    const place = await enrichItem(c.name, c.category)
    if (!place) { skip('Google 找不到或已歇業', c.name); continue }
    if (!nameMatches(c.name, place.name_en)) { skip('店名對不上', c.name, `Google: ${place.name_en}`); continue }
    if (place.rating < MIN_RATING) { skip('評分太低', c.name, String(place.rating)); continue }
    if (place.rating_count < (c.isNew ? MIN_REVIEWS_NEW : MIN_REVIEWS)) { skip('評論數太少', c.name, String(place.rating_count)); continue }
    // 用 Google 回來的正式店名與 place id 再去重一次（來源寫法常跟 Google 店名不同）
    if (place.place_id && knownPlaceIds.has(place.place_id)) { skip('已上架或已在待審', c.name); continue }
    if (isDuplicate({ name_en: place.name_en }, existing)) { skip('已上架或已在待審', c.name); continue }

    const category = place.category as Category
    const label = categoryLabel(category)
    const q = encodeURIComponent(`${place.name_en} ${place.address}`)
    const pending: PendingLocation = {
      id: uuidv4(),
      name_en: place.name_en,
      name_zh: place.name_zh,
      // 文案仍由你審核時產生/撰寫；這裡先放分類字樣
      description_zh: label.zh,
      description_en: label.en,
      category,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      photos: place.photos,
      source: sourceOf(c),
      source_url: `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.place_id}`,
      rating: place.rating,
      price_range: place.price_range,
      tag: c.isNew ? 'new_opening' : 'trending',
      area: place.area,
      mentions: c.mentions,
      evidence: c.evidence.slice(0, 6),
      scraped_at: new Date().toISOString(),
    }
    newItems.push(pending)
    existing.push(pending)
    if (place.place_id) knownPlaceIds.add(place.place_id)
  }

  console.log(`[trending] verified ${newItems.length}/${candidates.length}; skipped: ${JSON.stringify(skipped)}`)
}

async function processGoogleItems(
  items: Awaited<ReturnType<typeof scrapeGoogleMaps>>,
  existing: PendingLocation[],
  newItems: PendingLocation[]
) {
  for (const item of items) {
    if (isDuplicate(item, existing)) continue
    const category = (item.category ?? 'food') as Category
    // AI 依主要性質重新分類；Google 關鍵字找到的是常青店，標籤預設「在地私藏」
    const aiCat = await classifyCategory(item.name_en, item.description_zh || item.description_en || '', category)
    const pending: PendingLocation = {
      ...item,
      id: uuidv4(),
      category: aiCat,
      tag: 'hidden_gem',
      source: 'googlemaps',
      scraped_at: new Date().toISOString(),
    }
    newItems.push(pending)
    existing.push(pending)
  }
}

export async function runAllScrapers(customKeywords?: string[], mode: ScrapeMode = 'trending'): Promise<number> {
  const existing = [...readLocations(), ...readPending()] as PendingLocation[]
  const newItems: PendingLocation[] = []

  // Custom keywords — run through Google Maps Places API directly
  // Supports "keyword:category" syntax, e.g. "Thonglor brunch:cafe" or "rooftop bar:nightlife"
  if (customKeywords && customKeywords.length > 0) {
    const VALID_CATS = ['food', 'cafe', 'shopping', 'nightlife', 'hotel'] as const
    type ValidCat = typeof VALID_CATS[number]
    const queries = customKeywords.map((kw) => {
      const colonIdx = kw.lastIndexOf(':')
      if (colonIdx > 0) {
        const possibleCat = kw.slice(colonIdx + 1).trim().toLowerCase()
        if ((VALID_CATS as readonly string[]).includes(possibleCat)) {
          return { query: kw.slice(0, colonIdx).trim(), category: possibleCat as ValidCat }
        }
      }
      return { query: kw, category: 'food' as ValidCat }
    })
    console.log(`Running custom keyword scraper: ${queries.map(q => `"${q.query}" (${q.category})`).join(', ')}`)
    try {
      const items = await scrapeGoogleMapsQueries(queries)
      await processGoogleItems(items, existing, newItems)
    } catch (err) {
      console.error('Custom keyword scraper failed:', err)
    }
  } else if (mode === 'stock') {
    console.log('Running Google Maps stock scraper...')
    try {
      await processGoogleItems(await scrapeGoogleMaps(), existing, newItems)
    } catch (err) {
      console.error('Google Maps scraper failed:', err)
    }
  } else {
    console.log('Running trending scraper...')
    try {
      await runTrending(existing, newItems)
    } catch (err) {
      console.error('Trending scraper failed:', err)
    }
  }

  if (newItems.length > 0) {
    const current = readPending()
    writePending([...current, ...newItems])
  }

  console.log(`Scrapers done — added ${newItems.length} new items`)
  return newItems.length
}
