import { firecrawlSearch, sleep, type ScrapedItem } from './shared'

const QUERIES = [
  'Bangkok Instagram worthy restaurant photo aesthetic 2024',
  'Bangkok rooftop bar nightlife best view 2024',
  'Bangkok luxury hotel brunch afternoon tea best 2024',
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

export async function scrapeInstagram(): Promise<ScrapedItem[]> {
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
            description_en: `Instagram-worthy Bangkok spot — ${result.title ?? ''}`.slice(0, 120),
            description_zh: `IG 曼谷打卡熱點`,
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
      console.error('Instagram scrape failed for query:', query, err)
    }
  }

  return results
}
