import { v4 as uuidv4 } from 'uuid'
import { readLocations, readPending, writePending } from '@/lib/data'
import { isDuplicate } from '@/lib/dedup'
import type { PendingLocation } from '@/lib/types'
import { scrapePantip } from './pantip'
import { scrapeWongnai } from './wongnai'
import { scrapeGoogleMaps } from './googlemaps'
import { scrapeTikTok } from './tiktok'
import { scrapeInstagram } from './instagram'

const SOURCE_MAP = {
  pantip: scrapePantip,
  wongnai: scrapeWongnai,
  googlemaps: scrapeGoogleMaps,
  tiktok: scrapeTikTok,
  instagram: scrapeInstagram,
} as const

export async function runAllScrapers(): Promise<number> {
  const existing = [...readLocations(), ...readPending()]
  const newItems: PendingLocation[] = []

  for (const [source, scraper] of Object.entries(SOURCE_MAP)) {
    console.log(`Running ${source} scraper...`)
    try {
      const items = await scraper()
      for (const item of items) {
        if (!isDuplicate(item, existing)) {
          const pending: PendingLocation = {
            ...item,
            id: uuidv4(),
            category: 'food',
            source: source as PendingLocation['source'],
            scraped_at: new Date().toISOString(),
          }
          newItems.push(pending)
          existing.push(pending)
        }
      }
    } catch (err) {
      console.error(`Scraper ${source} failed:`, err)
    }
  }

  if (newItems.length > 0) {
    const current = readPending()
    writePending([...current, ...newItems])
  }

  console.log(`Scrapers done — added ${newItems.length} new items`)
  return newItems.length
}
