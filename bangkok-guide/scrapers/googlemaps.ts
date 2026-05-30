import { sleep, type ScrapedItem } from './shared'
import { extractHighlights, buildDescriptions } from './enricher'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const BANGKOK_LAT = 13.7563
const BANGKOK_LNG = 100.5018

const SEARCH_QUERIES = [
  { query: 'best restaurant Bangkok', category: 'food' as const },
  { query: 'best cafe Bangkok', category: 'cafe' as const },
  { query: 'night market Bangkok shopping', category: 'shopping' as const },
  { query: 'rooftop bar Bangkok nightlife', category: 'nightlife' as const },
  { query: 'boutique hotel Bangkok', category: 'hotel' as const },
]

const PRICE_MAP: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

type GMPlace = {
  displayName: { text: string }
  formattedAddress: string
  rating?: number
  priceLevel?: string
  location: { latitude: number; longitude: number }
  photos?: Array<{ name: string }>
  id: string
  editorialSummary?: { text: string }
  reviews?: Array<{ text?: { text: string }; originalText?: { text: string } }>
}

export async function scrapeGoogleMaps(): Promise<ScrapedItem[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not set — skipping Google Maps scraper')
    return []
  }

  const results: ScrapedItem[] = []

  for (const { query, category } of SEARCH_QUERIES) {
    try {
      const res = await fetch(PLACES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'places.displayName',
            'places.formattedAddress',
            'places.rating',
            'places.priceLevel',
            'places.location',
            'places.photos',
            'places.id',
            'places.editorialSummary',
            'places.reviews',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 10,
          locationBias: {
            circle: {
              center: { latitude: BANGKOK_LAT, longitude: BANGKOK_LNG },
              radius: 10000,
            },
          },
        }),
      })

      const data = await res.json()

      if (!data.places?.length) {
        console.error('Google Maps (Places API New) error for', query, JSON.stringify(data).slice(0, 200))
        continue
      }

      for (const place of (data.places as GMPlace[]).slice(0, 8)) {
        const highlights = place.reviews ? extractHighlights(place.reviews) : []
        const { description_en, description_zh } = buildDescriptions(
          place.editorialSummary?.text,
          highlights,
          category
        )

        const photoRef = place.photos?.[0]?.name ?? ''

        results.push({
          name_en: place.displayName.text,
          name_zh: place.displayName.text,
          description_en,
          description_zh,
          category,
          address: place.formattedAddress,
          lat: place.location.latitude,
          lng: place.location.longitude,
          photos: photoRef ? [photoRef] : [],
          source_url: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
          rating: place.rating ?? 4.0,
          price_range: PRICE_MAP[place.priceLevel ?? ''] ?? 2,
          trending: false,
          highlights,
        })
      }

      await sleep(1000)
    } catch (err) {
      console.error('Google Maps scrape failed for', query, err)
    }
  }

  return results
}
