import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const WONGNAI_URLS = [
  'https://www.wongnai.com/restaurants/bangkok',
  'https://www.wongnai.com/restaurants/bangkok?categories=cafe',
]

function parseWongnai(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const nameMatch = line.match(/^\[(.{3,60})\]/) || line.match(/^\*\*(.{3,60})\*\*/)
    if (!nameMatch) continue

    const name = nameMatch[1].trim()
    if (name.length < 3) continue

    let rating = 4.0
    const ratingLine = lines.slice(i, i + 5).join(' ')
    const ratingMatch = ratingLine.match(/(\d+\.\d+)\s*\/\s*5/) || ratingLine.match(/★\s*(\d+\.\d+)/)
    if (ratingMatch) rating = parseFloat(ratingMatch[1])

    const description = lines.slice(i + 1, i + 3).join(' ').trim().slice(0, 200)

    items.push({
      name_en: name,
      name_zh: name,
      description_en: description,
      description_zh: description,
      address: 'Bangkok, Thailand',
      lat: 13.7563,
      lng: 100.5018,
      photos: [],
      source_url: sourceUrl,
      rating,
      price_range: 2,
      tag: 'evergreen',
    })

    if (items.length >= 15) break
  }
  return items
}

export async function scrapeWongnai(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of WONGNAI_URLS) {
    try {
      const markdown = await firecrawlScrape(url)
      results.push(...parseWongnai(markdown, url))
      await sleep(2000)
    } catch (err) {
      console.error('Wongnai scrape failed', err)
    }
  }
  return results
}
