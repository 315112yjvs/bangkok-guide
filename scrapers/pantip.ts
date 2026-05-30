import { firecrawlSearch, firecrawlScrape, sleep, type ScrapedItem } from './shared'

const PANTIP_QUERIES = [
  'site:pantip.com ร้านอาหาร กรุงเทพ แนะนำ อร่อย',
  'site:pantip.com คาเฟ่ กรุงเทพ น่าไป',
]

const THAI_PLACE_PATTERN = /(?:^|\n)[\s*\d.-]*(?:ร้าน|คาเฟ่|บาร์|ห้องอาหาร|โรงแรม)?\s*([A-Z][A-Za-zก-๙\s&''.()]{3,50})(?:\s*[-–—:\n])/gm
const EN_PLACE_PATTERN = /(?:^|\n)[\s*\d.-]*([A-Z][A-Za-z\s&''.()]{3,50})(?:\s*[-–—:\n])/gm

function extractNamesFromPantip(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const SKIP = /^(ที่|การ|มี|ไป|แต่|และ|หรือ|จาก|The Best|Best |Top |Most )/i

  for (const pattern of [THAI_PLACE_PATTERN, EN_PLACE_PATTERN]) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim().replace(/\s+/g, ' ')
      if (name.length < 3 || name.length > 50) continue
      if (SKIP.test(name)) continue
      if (seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      names.push(name)
      if (names.length >= 8) break
    }
    if (names.length >= 8) break
  }
  return names
}

export async function scrapePantip(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []

  for (const query of PANTIP_QUERIES) {
    try {
      const searchResults = await firecrawlSearch(query, 3)
      for (const result of searchResults) {
        if (!result.url.includes('pantip.com')) continue
        try {
          const markdown = await firecrawlScrape(result.url)
          const names = extractNamesFromPantip(markdown)
          for (const name of names) {
            results.push({
              name_en: name,
              name_zh: name,
              description_en: `Recommended on Pantip — ${result.title ?? ''}`.slice(0, 120),
              description_zh: `Pantip 泰國論壇推薦`,
              address: 'Bangkok, Thailand',
              lat: 13.7563,
              lng: 100.5018,
              photos: [],
              source_url: result.url,
              rating: 4.0,
              price_range: 2,
              trending: false,
            })
          }
          await sleep(1500)
        } catch {
          // skip individual page errors
        }
      }
      await sleep(2000)
    } catch (err) {
      console.error('Pantip scrape failed:', err)
    }
  }

  return results
}
