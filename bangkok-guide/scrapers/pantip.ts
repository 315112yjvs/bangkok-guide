import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const PANTIP_QUERIES = [
  'https://pantip.com/search#q=%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3+%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E&st=topic',
  'https://pantip.com/search#q=%E0%B8%84%E0%B8%B2%E0%B9%80%E0%B8%9F%E0%B9%88+%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B9%81%E0%B8%9F+Bangkok&st=topic',
]

function parseRestaurantsFromMarkdown(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    const nameMatch = line.match(/^\*\*(.{3,50})\*\*/) || line.match(/^#{1,3}\s+(.{3,50})/)
    if (nameMatch) {
      const rawName = nameMatch[1].trim()
      if (rawName.length >= 3 && /[a-zA-Z\d]/.test(rawName)) {
        const description = lines.slice(i + 1, i + 4).join(' ').replace(/#+/g, '').trim().slice(0, 200)
        items.push({
          name_en: rawName,
          name_zh: rawName,
          description_en: description,
          description_zh: description,
          address: 'Bangkok, Thailand',
          lat: 13.7563,
          lng: 100.5018,
          photos: [],
          source_url: sourceUrl,
          rating: 4.0,
          price_range: 2,
          trending: true,
        })
      }
    }
    i++
    if (items.length >= 10) break
  }
  return items
}

export async function scrapePantip(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of PANTIP_QUERIES) {
    try {
      const markdown = await firecrawlScrape(url)
      const items = parseRestaurantsFromMarkdown(markdown, url)
      results.push(...items)
      await sleep(2000)
    } catch (err) {
      console.error('Pantip scrape failed for', url, err)
    }
  }
  return results
}
