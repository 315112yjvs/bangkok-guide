import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const IG_URLS = [
  'https://www.instagram.com/explore/tags/bangkokfood/',
  'https://www.instagram.com/explore/tags/bangkokcafe/',
]

function parseInstagramMarkdown(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  const namePattern = /(?:📍|🍽️|☕|at\s+|@)([A-Z][A-Za-z\s&'.]{2,40})(?:\n|,|!|\.|$)/g
  let match
  const seen = new Set<string>()

  while ((match = namePattern.exec(markdown)) !== null) {
    const name = match[1].trim()
    if (seen.has(name) || name.length < 4) continue
    seen.add(name)

    items.push({
      name_en: name,
      name_zh: name,
      description_en: `Trending on Instagram in Bangkok`,
      description_zh: `IG 曼谷爆紅`,
      address: 'Bangkok, Thailand',
      lat: 13.7563,
      lng: 100.5018,
      photos: [],
      source_url: sourceUrl,
      rating: 4.0,
      price_range: 2,
      trending: true,
    })

    if (items.length >= 8) break
  }
  return items
}

export async function scrapeInstagram(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of IG_URLS) {
    try {
      const markdown = await firecrawlScrape(url)
      results.push(...parseInstagramMarkdown(markdown, url))
      await sleep(3000)
    } catch (err) {
      console.error('Instagram scrape failed', err)
    }
  }
  return results
}
