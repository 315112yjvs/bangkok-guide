import { firecrawlSearch, sleep, type ScrapedItem, type SearchResult } from './shared'
import { extractVenuesFromSnippets } from './extract'

// 動態帶當年與前一年，抓最近爆紅而非寫死的舊資料
const YEAR = new Date().getFullYear()

const QUERIES = [
  `site:tiktok.com คาเฟ่ กรุงเทพ น่าไป ถ่ายรูป ${YEAR}`,
  `site:tiktok.com ร้านอาหาร กรุงเทพ อร่อย แนะนำ ${YEAR}`,
  `site:tiktok.com ร้านเปิดใหม่ กรุงเทพ ${YEAR}`,
  `site:tiktok.com ร้านอาหาร ทองหล่อ เอกมัย สุขุมวิท ${YEAR}`,
  `site:tiktok.com Bangkok viral cafe restaurant ${YEAR}`,
  `site:tiktok.com Bangkok rooftop bar nightlife ${YEAR}`,
  `site:tiktok.com Bangkok aesthetic cafe instagram spot ${YEAR}`,
  `site:tiktok.com Bangkok hidden gem must try ${YEAR}`,
  `site:tiktok.com Bangkok new opening trending ${YEAR}`,
  `site:tiktok.com คาเฟ่เปิดใหม่ กรุงเทพ ${YEAR}`,
]

export async function scrapeTikTok(): Promise<ScrapedItem[]> {
  // 1) 收集所有 TikTok 搜尋結果的標題+摘要
  const snippets: string[] = []
  for (const query of QUERIES) {
    try {
      const searchResults: SearchResult[] = await firecrawlSearch(query, 6)
      for (const r of searchResults) {
        if (!r.url.includes('tiktok.com')) continue
        const text = [r.title, r.description].filter(Boolean).join(' — ').trim()
        if (text.length > 10) snippets.push(text.slice(0, 600))
      }
      await sleep(800)
    } catch (err) {
      console.error('[TikTok] search failed:', query, err)
    }
  }

  console.log(`[TikTok] collected ${snippets.length} snippets`)

  // 2) 用 AI 抽出真正的店名（取代 regex），大幅降雜訊
  const venues = await extractVenuesFromSnippets(snippets, 'TikTok')

  // 3) 去重、轉成 ScrapedItem（後續會用 Google Maps 驗證補完）
  const seen = new Set<string>()
  const results: ScrapedItem[] = []
  for (const v of venues) {
    const key = v.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push({
      name_en: v.name,
      name_zh: v.name,
      description_en: '',
      description_zh: '',
      category: v.category,
      address: 'Bangkok, Thailand',
      lat: 13.7563,
      lng: 100.5018,
      photos: [],
      source_url: '',
      rating: 4.2,
      price_range: 2,
      tag: 'trending',
    })
  }

  console.log(`[TikTok] AI extracted ${results.length} venues`)
  return results
}
