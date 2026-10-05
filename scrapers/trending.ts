import { firecrawlSearch, sleep, type SearchResult } from './shared'
import { extractTrendingVenues, type TrendingMention } from './extract'
import { similarity } from '@/lib/dedup'
import type { Category, Evidence } from '@/lib/types'

// 「找熱點」模式：不再問 Google「哪家評價好」，而是看「最近一個月誰被提到」。
// 1) 泰國媒體/部落格的新店整理文（搜尋限定近一個月，抓全文）
// 2) TikTok / IG / Pantip 近一個月的貼文標題與摘要
// 3) AI 抽出店名＋被提到的理由，跨來源合併、算被提到幾次
// 之後由 index.ts 拿去 Google 驗證（真的存在、在曼谷、有營業、評分夠）才進待審。

// 整理文：會把搜尋結果的文章全文抓回來（每篇算一次 Firecrawl 抓取）
const ARTICLE_QUERIES = [
  'ร้านเปิดใหม่ กรุงเทพ เดือนนี้',
  'คาเฟ่เปิดใหม่ กรุงเทพ',
  'ร้านอาหารเปิดใหม่ กรุงเทพ ห้ามพลาด',
  'บาร์เปิดใหม่ กรุงเทพ',
  'ร้านดัง กรุงเทพ กำลังฮิต ไวรัล',
  'new restaurants Bangkok this month',
  'new cafes Bangkok openings',
  'new bars Bangkok opening',
]
const ARTICLES_PER_QUERY = 4

// 社群：只用搜尋結果的標題＋摘要（不抓內頁，便宜）
const SOCIAL_QUERIES = [
  'site:tiktok.com ร้านเปิดใหม่ กรุงเทพ',
  'site:tiktok.com คาเฟ่เปิดใหม่ กรุงเทพ',
  'site:tiktok.com ร้านไวรัล กรุงเทพ ต้องไป',
  'site:tiktok.com Bangkok new cafe',
  'site:tiktok.com Bangkok new restaurant viral',
  'site:instagram.com คาเฟ่เปิดใหม่ กรุงเทพ',
  'site:instagram.com Bangkok new opening restaurant',
  'site:pantip.com ร้านเปิดใหม่ กรุงเทพ',
]
const SOCIAL_PER_QUERY = 10

// 只看近一個月的內容（Google 搜尋的時間篩選參數）
const RECENT = 'qdr:m'

export type Doc = { url: string; title: string; text: string }

export type TrendingCandidate = {
  name: string
  category: Category
  isNew: boolean
  mentions: number      // 幾個不同來源網址提到
  evidence: Evidence[]
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

async function collectDocs(): Promise<{ articles: Doc[]; social: Doc[] }> {
  const seen = new Set<string>()
  const articles: Doc[] = []
  const social: Doc[] = []

  for (const query of ARTICLE_QUERIES) {
    try {
      const results: SearchResult[] = await firecrawlSearch(query, ARTICLES_PER_QUERY, { tbs: RECENT, scrape: true })
      for (const r of results) {
        if (!r.url || seen.has(r.url)) continue
        // 社群站的內頁抓不到有用內容，交給下面的摘要流程
        if (/tiktok\.com|instagram\.com|facebook\.com|youtube\.com/.test(r.url)) continue
        const text = (r.markdown ?? '').trim()
        if (text.length < 400) continue
        seen.add(r.url)
        articles.push({ url: r.url, title: r.title ?? '', text })
      }
    } catch (err) {
      console.error('[trending] article search failed:', query, err)
    }
    await sleep(600)
  }

  for (const query of SOCIAL_QUERIES) {
    try {
      const results: SearchResult[] = await firecrawlSearch(query, SOCIAL_PER_QUERY, { tbs: RECENT })
      for (const r of results) {
        if (!r.url || seen.has(r.url)) continue
        const text = [r.title, r.description].filter(Boolean).join(' — ').trim()
        if (text.length < 15) continue
        seen.add(r.url)
        social.push({ url: r.url, title: r.title ?? '', text: text.slice(0, 600) })
      }
    } catch (err) {
      console.error('[trending] social search failed:', query, err)
    }
    await sleep(600)
  }

  console.log(`[trending] collected ${articles.length} articles, ${social.length} social posts`)
  return { articles, social }
}

// 把社群摘要切成每批約 6000 字，避免像舊版一樣只讀到前面幾則
function chunkDocs(docs: Doc[], maxChars = 6000): Doc[][] {
  const chunks: Doc[][] = []
  let cur: Doc[] = []
  let size = 0
  for (const d of docs) {
    if (cur.length > 0 && size + d.text.length > maxChars) { chunks.push(cur); cur = []; size = 0 }
    cur.push(d)
    size += d.text.length
  }
  if (cur.length > 0) chunks.push(cur)
  return chunks
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u0E00-\u0E7F\u4E00-\u9FFF]+/gi, '')

// 同一家店在不同來源的寫法略有出入（大小寫、空白、分店字樣），正規化後相似度夠高就視為同一家
function sameVenue(a: string, b: string): boolean {
  const na = normalize(a), nb = normalize(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (Math.min(na.length, nb.length) >= 6 && (na.includes(nb) || nb.includes(na))) return true
  return similarity(na, nb) >= 0.85
}

export function aggregateMentions(mentions: TrendingMention[]): TrendingCandidate[] {
  const groups: { names: string[]; cats: Category[]; isNew: boolean; evidence: Evidence[] }[] = []
  for (const m of mentions) {
    let g = groups.find((x) => x.names.some((n) => sameVenue(n, m.name)))
    if (!g) { g = { names: [], cats: [], isNew: false, evidence: [] }; groups.push(g) }
    g.names.push(m.name)
    g.cats.push(m.category)
    if (m.isNew) g.isNew = true
    // 同一個網址只算一次
    if (!g.evidence.some((e) => e.url === m.url)) {
      g.evidence.push({ url: m.url, title: m.title.slice(0, 120), quote: m.why, ...(m.facts ? { facts: m.facts } : {}) })
    }
  }

  const mode = <T,>(arr: T[]): T => {
    const count = new Map<T, number>()
    for (const x of arr) count.set(x, (count.get(x) ?? 0) + 1)
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0][0]
  }

  return groups
    .map((g) => ({
      name: mode(g.names),
      category: mode(g.cats),
      isNew: g.isNew,
      mentions: g.evidence.length,
      evidence: g.evidence,
    }))
    // 被越多來源提到排越前面；同分時不同網域多的優先（避免同一站洗版），再來是新開幕
    .sort((a, b) =>
      b.mentions - a.mentions ||
      new Set(b.evidence.map((e) => hostOf(e.url))).size - new Set(a.evidence.map((e) => hostOf(e.url))).size ||
      Number(b.isNew) - Number(a.isNew)
    )
}

export async function findTrendingCandidates(): Promise<TrendingCandidate[]> {
  const { articles, social } = await collectDocs()

  // 文章一篇一次（全文較長）；社群摘要分批
  const batches: Doc[][] = [...articles.map((a) => [a]), ...chunkDocs(social)]
  const results = await mapLimit(batches, 4, (batch) => extractTrendingVenues(batch))
  const mentions = results.flat()
  console.log(`[trending] AI extracted ${mentions.length} mentions`)

  const candidates = aggregateMentions(mentions)
  console.log(`[trending] ${candidates.length} distinct venues, ${candidates.filter((c) => c.mentions >= 2).length} mentioned 2+ times`)
  return candidates
}
