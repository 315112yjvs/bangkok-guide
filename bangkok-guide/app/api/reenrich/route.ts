import { NextResponse } from 'next/server'
import { readLocations, writeLocations } from '@/lib/data'
import { enrichItem } from '@/scrapers/enricher'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST() {
  const locations = readLocations()
  let updated = 0

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    try {
      const enriched = await enrichItem(loc.name_en, loc.category, loc.lat, loc.lng)
      if (enriched) {
        locations[i] = {
          ...loc,
          description_en: enriched.description_en,
          description_zh: enriched.description_zh,
          highlights: enriched.highlights,
          // Keep existing lat/lng/photos if the enriched ones are generic fallbacks
          lat: enriched.lat !== 13.7563 ? enriched.lat : loc.lat,
          lng: enriched.lng !== 100.5018 ? enriched.lng : loc.lng,
          photos: enriched.photos.length > 0 ? enriched.photos : loc.photos,
        }
        updated++
      }
    } catch {
      // skip individual failures
    }
    // Avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  writeLocations(locations)
  return NextResponse.json({ ok: true, updated, total: locations.length })
}
