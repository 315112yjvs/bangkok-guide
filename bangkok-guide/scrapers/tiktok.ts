import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const TIKTOK_URLS = [
  'https://www.tiktok.com/search?q=bangkok+restaurant+food',
  'https://www.tiktok.com/search?q=bangkok+cafe+coffee',
]

function parseTikTokMarkdown(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  const namePattern = /(?:@|#|📍|🍽️|☕)\s*([A-Z][A-Za-z\s&']{2,40})(?:\s|$)/g
  let match
  const seen = new Set<string>()

  while ((match = namePattern.exec(markdown)) !== null) {
    const name = match[1].trim()
    if (seen.has(name) || name.length < 4) continue
    seen.add(name)

    items.push({
      name_en: name,
      name_zh: name,
      description_en: `Trending on TikTok in Bangkok`,
      description_zh: `TikTok 曼谷熱傳`,
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

export async function scrapeTikTok(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of TIKTOK_URLS) {
    try {
      const markdown = await firecrawlScrape(url)
      results.push(...parseTikTokMarkdown(markdown, url))
      await sleep(3000)
    } catch (err) {
      console.error('TikTok scrape failed', err)
    }
  }
  return results
}
