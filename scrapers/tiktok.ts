import { firecrawlSearch, sleep, type ScrapedItem } from './shared'

const QUERIES = [
  'Bangkok restaurant must try viral trending 2024 best food',
  'Bangkok street food hidden gem local favorite 2024',
  'Bangkok cafe aesthetic trendy 2024 must visit',
]

const PLACE_PATTERN = /(?:^|\n)[\s*-]*([A-Z][A-Za-z\s&''.()]{3,50})(?:\s*[-–—]|\s*:|\s*–|\n|,)/gm

function extractNames(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const SKIP = /^(The Best|Best |Top |Most |More |What |When |Where |How |Why |Tips |Read |Check |See |Visit |Open |Book |Get |Make |Try |Also |Note |Find |Here |This |That |These |With |From |For |And |But |Are |Was |Has |Have |About |After |Before |During |Other |Some |Many |All |Any )/i

  let match: RegExpExecArray | null
  PLACE_PATTERN.lastIndex = 0
  while ((match = PLACE_PATTERN.exec(text)) !== null) {
    const name = match[1].trim().replace(/\s+/g, ' ')
    if (name.length < 4 || name.length > 50) continue
    if (SKIP.test(name)) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    names.push(name)
    if (names.length >= 6) break
  }
  return names
}

export async function scrapeTikTok(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []

  for (const query of QUERIES) {
    try {
      const searchResults = await firecrawlSearch(query, 3)
      for (const result of searchResults) {
        const text = result.markdown ?? result.description ?? result.title ?? ''
        const names = extractNames(text)
        for (const name of names) {
          results.push({
            name_en: name,
            name_zh: name,
            description_en: `Trending Bangkok spot — ${result.title ?? ''}`.slice(0, 120),
            description_zh: `曼谷熱門打卡地點`,
            address: 'Bangkok, Thailand',
            lat: 13.7563,
            lng: 100.5018,
            photos: [],
            source_url: result.url,
            rating: 4.2,
            price_range: 2,
            trending: true,
          })
        }
      }
      await sleep(1500)
    } catch (err) {
      console.error('TikTok scrape failed for query:', query, err)
    }
  }

  return results
}
