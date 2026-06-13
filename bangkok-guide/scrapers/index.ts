import { v4 as uuidv4 } from 'uuid'
import { readLocations, readPending, writePending } from '@/lib/data'
import { isDuplicate } from '@/lib/dedup'
import type { PendingLocation, Category } from '@/lib/types'
import { scrapePantip } from './pantip'
import { scrapeWongnai } from './wongnai'
import { scrapeGoogleMaps, scrapeGoogleMapsQueries } from './googlemaps'
import { scrapeTikTok } from './tiktok'
import { scrapeInstagram } from './instagram'
import { enrichItem } from './enricher'
import { classifyCategory } from './extract'

const SOURCE_MAP = {
  pantip: scrapePantip,
  wongnai: scrapeWongnai,
  googlemaps: scrapeGoogleMaps,
  tiktok: scrapeTikTok,
  instagram: scrapeInstagram,
} as const

async function processItems(
  items: Awaited<ReturnType<typeof scrapeGoogleMaps>>,
  source: string,
  existing: PendingLocation[],
  newItems: PendingLocation[]
) {
  for (const item of items) {
    if (isDuplicate(item, existing)) continue
    const category = (item.category ?? 'food') as Category

    if (source === 'googlemaps') {
      // AI 依主要性質重新分類；標籤一律預設「在地私藏」
      const aiCat = await classifyCategory(item.name_en, item.description_zh || item.description_en || '', category)
      const pending: PendingLocation = {
        ...item,
        id: uuidv4(),
        category: aiCat,
        tag: 'hidden_gem',
        source: 'googlemaps',
        scraped_at: new Date().toISOString(),
      }
      newItems.push(pending)
      existing.push(pending)
    } else {
      const enriched = await enrichItem(item.name_en, category, item.lat, item.lng)
      if (!enriched) {
        console.log(`Skipping "${item.name_en}" — not found or closed on Google Maps`)
        continue
      }
      const aiCat = await classifyCategory(
        enriched.name_en,
        enriched.description_zh || enriched.description_en || '',
        (enriched.category ?? category) as Category
      )
      const pending: PendingLocation = {
        ...item,
        name_en: enriched.name_en,
        name_zh: enriched.name_zh,
        description_en: enriched.description_en,
        description_zh: enriched.description_zh,
        highlights: enriched.highlights,
        lat: enriched.lat,
        lng: enriched.lng,
        photos: enriched.photos,
        rating: enriched.rating,
        area: enriched.area,
        address: enriched.address,
        id: uuidv4(),
        category: aiCat,
        tag: 'hidden_gem',
        source: source as PendingLocation['source'],
        scraped_at: new Date().toISOString(),
      }
      newItems.push(pending)
      existing.push(pending)
    }
  }
}

export async function runAllScrapers(customKeywords?: string[]): Promise<number> {
  const existing = [...readLocations(), ...readPending()] as PendingLocation[]
  const newItems: PendingLocation[] = []

  // Custom keywords — run through Google Maps Places API directly
  // Supports "keyword:category" syntax, e.g. "Thonglor brunch:cafe" or "rooftop bar:nightlife"
  if (customKeywords && customKeywords.length > 0) {
    const VALID_CATS = ['food', 'cafe', 'shopping', 'nightlife', 'hotel'] as const
    type ValidCat = typeof VALID_CATS[number]
    const queries = customKeywords.map((kw) => {
      const colonIdx = kw.lastIndexOf(':')
      if (colonIdx > 0) {
        const possibleCat = kw.slice(colonIdx + 1).trim().toLowerCase()
        if ((VALID_CATS as readonly string[]).includes(possibleCat)) {
          return { query: kw.slice(0, colonIdx).trim(), category: possibleCat as ValidCat }
        }
      }
      return { query: kw, category: 'food' as ValidCat }
    })
    console.log(`Running custom keyword scraper: ${queries.map(q => `"${q.query}" (${q.category})`).join(', ')}`)
    try {
      const items = await scrapeGoogleMapsQueries(queries)
      await processItems(items, 'googlemaps', existing, newItems)
    } catch (err) {
      console.error('Custom keyword scraper failed:', err)
    }
  } else {
    // Normal full scrape
    for (const [source, scraper] of Object.entries(SOURCE_MAP)) {
      console.log(`Running ${source} scraper...`)
      try {
        const items = await scraper()
        await processItems(items, source, existing, newItems)
      } catch (err) {
        console.error(`Scraper ${source} failed:`, err)
      }
    }
  }

  if (newItems.length > 0) {
    const current = readPending()
    writePending([...current, ...newItems])
  }

  console.log(`Scrapers done — added ${newItems.length} new items`)
  return newItems.length
}
