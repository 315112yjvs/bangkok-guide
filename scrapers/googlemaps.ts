import { sleep, type ScrapedItem } from './shared'

const BANGKOK_LAT = 13.7563
const BANGKOK_LNG = 100.5018
const RADIUS = 10000 // 10km

const SEARCH_QUERIES = [
  { query: 'best restaurant Bangkok', category: 'food' as const },
  { query: 'best cafe Bangkok', category: 'cafe' as const },
  { query: 'night market Bangkok shopping', category: 'shopping' as const },
  { query: 'rooftop bar Bangkok nightlife', category: 'nightlife' as const },
  { query: 'boutique hotel Bangkok', category: 'hotel' as const },
]

type GMPlace = {
  name: string
  formatted_address: string
  rating?: number
  geometry: { location: { lat: number; lng: number } }
  photos?: Array<{ photo_reference: string }>
  price_level?: number
  place_id: string
}

export async function scrapeGoogleMaps(): Promise<ScrapedItem[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not set — skipping Google Maps scraper')
    return []
  }

  const results: ScrapedItem[] = []

  for (const { query } of SEARCH_QUERIES) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      url.searchParams.set('query', query)
      url.searchParams.set('location', `${BANGKOK_LAT},${BANGKOK_LNG}`)
      url.searchParams.set('radius', String(RADIUS))
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status !== 'OK') {
        console.error('Places API error:', data.status, data.error_message)
        continue
      }

      for (const place of (data.results as GMPlace[]).slice(0, 8)) {
        const photoRef = place.photos?.[0]?.photo_reference
        const photoUrl = photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`
          : ''

        results.push({
          name_en: place.name,
          name_zh: place.name,
          description_en: `${place.name} — ${place.formatted_address}`,
          description_zh: `${place.name} — ${place.formatted_address}`,
          address: place.formatted_address,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          photos: photoUrl ? [photoUrl] : [],
          source_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          rating: place.rating ?? 4.0,
          price_range: Math.min((place.price_level ?? 1) + 1, 4) as 1 | 2 | 3 | 4,
          trending: false,
        })
      }

      await sleep(1000)
    } catch (err) {
      console.error('Google Maps scrape failed for', query, err)
    }
  }

  return results
}
