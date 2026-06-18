// Rebuilds descriptions from available data (highlights, rating, category, source, local_ratio)
// Also fetches editorial from Places API where available
// Usage: node scripts/refresh-descriptions.mjs
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_KEY = readEnvKey('GOOGLE_MAPS_API_KEY')

function readEnvKey(key) {
  try {
    const env = readFileSync(join(__dirname, '../.env.local'), 'utf-8')
    return env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() ?? ''
  } catch { return '' }
}

function extractPlaceId(sourceUrl) {
  return sourceUrl?.match(/query_place_id=([^&\s]+)/)?.[1]
    ?? sourceUrl?.match(/place_id:([^&\s]+)/)?.[1]
    ?? null
}

// Clean out garbage highlights extracted from review text
const GARBAGE_PATTERNS = [
  /^(the |a |an )?(food|place|spot|experience|restaurant|cafe|bar|vibe|ambiance|atmosphere|service|staff|everything|nothing|meal|dishes?|menu|price|value|quality|things?)$/i,
  /^(this|that|here|very|so|just|definitely|really|absolutely|must|highly|great|good|nice|amazing|excellent|wonderful|perfect|awesome|best|top|my|our|their|we|you|i|they)(\s.*)?$/i,
  /bangkok|thailand|thai|city|town|area|district|street|road|bts|mrt|sky/i,
  /^(some |the )?\w{1,3}$/,
  /will be back|come back|back again|next time|go back|be back/i,
  /^(meal we|day trip|night out|date night|girls trip|solo|family|group|friends)/i,
  /per person|per head|baht|thb|usd|\$\d/i,
  /a lot for|lot of|worth (the|it|every)/i,
  /^(and |but |so |also |even )/i,
]

function isGarbageHighlight(h) {
  return GARBAGE_PATTERNS.some(p => p.test(h.trim()))
}

function cleanHighlights(highlights) {
  return (highlights ?? []).filter(h => !isGarbageHighlight(h) && h.length >= 3 && h.length <= 35)
}

// Build a specific, varied Chinese description
function buildDescZh(loc, editorial, highlights) {
  const cat = loc.category
  const rating = loc.rating ?? 4.5
  const price = loc.price_range ?? 2
  const source = loc.source
  const local = loc.local_ratio ?? 0
  const trending = loc.trending

  if (editorial) {
    // Truncate editorial for card
    return editorial.length > 80 ? editorial.slice(0, 78) + '…' : editorial
  }

  // Category-specific templates with real data
  const catZh = { food: '餐廳', cafe: '咖啡廳', shopping: '購物', nightlife: '酒吧', hotel: '飯店' }[cat] ?? '地點'

  const good = rating >= 4.8 ? '評分極高' : rating >= 4.5 ? '口碑極佳' : '深受好評'
  const priceDesc = { 1: '親民價格', 2: '中等消費', 3: '高檔', 4: '精緻奢華' }[price] ?? '中等消費'
  const localSuffix = local >= 70 ? '，在地人最愛' : local >= 50 ? '，本地人常光顧' : ''
  const prefix = trending ? '曼谷社群熱傳' : source === 'tiktok' ? 'TikTok 瘋傳' : source === 'instagram' ? 'IG 爆紅' : ''

  if (cat === 'food') {
    if (highlights.length >= 2) {
      const p = prefix ? `${prefix}，` : ''
      return `${p}以${highlights[0]}和${highlights[1]}聞名的曼谷美食，${good}${localSuffix}。`
    }
    if (highlights.length === 1) {
      const p = prefix ? `${prefix}，` : ''
      return `${p}招牌${highlights[0]}必試，${priceDesc}曼谷${catZh}，${good}${localSuffix}。`
    }
    const p = prefix ? `${prefix}，` : ''
    return `${p}${priceDesc}、${good}的曼谷${catZh}${localSuffix}，食客好評不斷。`
  }

  if (cat === 'cafe') {
    const coffeeHl = highlights.find(h => ['Pour Over', 'Espresso', 'Cold Brew', 'Thai Tea', 'Croissant'].includes(h))
    if (coffeeHl) {
      const p = prefix ? `${prefix}，` : ''
      return `${p}${coffeeHl}是招牌，${priceDesc}的精品咖啡廳，${good}${localSuffix}。`
    }
    if (highlights.length > 0) {
      return `以${highlights[0]}聞名的曼谷咖啡廳，${good}${localSuffix}。`
    }
    const p = prefix ? `${prefix}，` : ''
    return `${p}${priceDesc}的精品咖啡廳，拍照打卡首選，${good}${localSuffix}。`
  }

  if (cat === 'nightlife') {
    if (highlights.includes('Rooftop View') || highlights.includes('City View')) {
      return `曼谷必去高空景觀酒吧，俯瞰全城夜景，${good}${localSuffix}。`
    }
    if (highlights.includes('Live Music')) {
      const p = prefix ? `${prefix}，` : ''
      return `${p}現場音樂每晚演出，${good}曼谷酒吧${localSuffix}。`
    }
    if (highlights.includes('Cocktails') || highlights.includes('Craft Beer')) {
      const p = prefix ? `${prefix}，` : ''
      return `${p}創意調酒聞名曼谷，${good}${localSuffix}。`
    }
    const p = prefix ? `${prefix}，` : ''
    return `${p}${priceDesc}曼谷夜生活，${good}${localSuffix}，夜遊必去。`
  }

  if (cat === 'shopping') {
    if (loc.name_en.toLowerCase().includes('market') || loc.name_en.toLowerCase().includes('bazaar')) {
      const p = prefix ? `${prefix}，` : ''
      return `${p}曼谷${priceDesc}夜市，逛街淘貨首選${localSuffix}。`
    }
    if (loc.name_en.toLowerCase().includes('mall') || loc.name_en.toLowerCase().includes('plaza')) {
      return `曼谷${priceDesc}購物中心，品牌齊全，${good}${localSuffix}。`
    }
    const p = prefix ? `${prefix}，` : ''
    return `${p}曼谷${priceDesc}購物景點，${good}${localSuffix}。`
  }

  if (cat === 'hotel') {
    const p = prefix ? `${prefix}，` : ''
    return `${p}${priceDesc}曼谷住宿，${good}${localSuffix}，地理位置優越。`
  }

  const p = prefix ? `${prefix}，` : ''
  return `${p}${priceDesc}曼谷${catZh}，${good}${localSuffix}。`
}

function buildDescEn(loc, editorial, highlights) {
  if (editorial) return editorial

  const cat = loc.category
  const rating = loc.rating ?? 4.5
  const price = loc.price_range ?? 2
  const local = loc.local_ratio ?? 0
  const trending = loc.trending

  const ratingDesc = rating >= 4.8 ? 'top-rated' : rating >= 4.5 ? 'highly praised' : 'well-regarded'
  const priceDesc = { 1: 'budget-friendly', 2: 'mid-range', 3: 'upscale', 4: 'fine dining' }[price] ?? 'mid-range'
  const localNote = local >= 70 ? ' A local favourite.' : local >= 50 ? ' Popular with locals.' : ''
  const trendingNote = trending ? ' Trending on Thai social media.' : ''

  const hlText = highlights.length > 0 ? ` Known for ${highlights.slice(0,2).join(' and ')}.` : ''

  const catDesc = {
    food: `${ratingDesc} Thai restaurant in Bangkok`,
    cafe: `${ratingDesc} specialty café in Bangkok`,
    shopping: `popular shopping destination in Bangkok`,
    nightlife: `${ratingDesc} bar and nightlife spot in Bangkok`,
    hotel: `${ratingDesc} hotel in Bangkok`,
  }[cat] ?? `${ratingDesc} spot in Bangkok`

  return `A ${priceDesc}, ${catDesc}.${hlText}${localNote}${trendingNote}`
}

async function fetchEditorial(placeId) {
  if (!API_KEY) return null
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'editorialSummary',
        'Referer': 'https://www.bkk-local.com/',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.editorialSummary?.text ?? null
  } catch { return null }
}

async function main() {
  const path = join(__dirname, '../data/locations.json')
  const locs = JSON.parse(readFileSync(path, 'utf-8'))

  let updated = 0
  let editorialsFetched = 0

  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i]
    const placeId = extractPlaceId(loc.source_url)
    const cleanHl = cleanHighlights(loc.highlights)

    // Try to fetch editorial if we don't already have one
    let editorial = (!loc.description_en?.startsWith('Highly recommended') && !loc.description_en?.startsWith('A ') && !loc.description_en?.startsWith('Popular'))
      ? loc.description_en?.replace(/ Known for.*$/, '').replace(/ Must-try.*$/, '').replace(/ A local.*$/, '').trim()
      : null

    if (!editorial && placeId) {
      const fetched = await fetchEditorial(placeId)
      if (fetched) { editorial = fetched; editorialsFetched++ }
      await new Promise(r => setTimeout(r, 110))
    }

    const newDescEn = buildDescEn(loc, editorial, cleanHl)
    const newDescZh = buildDescZh(loc, editorial, cleanHl)

    const changed = newDescEn !== loc.description_en || newDescZh !== loc.description_zh || JSON.stringify(cleanHl) !== JSON.stringify(loc.highlights ?? [])
    if (changed) {
      locs[i] = { ...loc, description_en: newDescEn, description_zh: newDescZh, highlights: cleanHl }
      updated++
    }

    if ((i+1) % 20 === 0) process.stdout.write(`${i+1}/${locs.length}…\n`)
  }

  writeFileSync(path, JSON.stringify(locs, null, 2))
  console.log(`Done. Fetched ${editorialsFetched} editorials from API, updated ${updated}/${locs.length} locations.`)
}

main().catch(console.error)
