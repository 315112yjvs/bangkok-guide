import { sleep, type ScrapedItem } from './shared'
import { extractHighlights, buildDescriptions } from './enricher'
import { translateNames, generateDescriptionZh } from './translate'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const BANGKOK_LAT = 13.7563
const BANGKOK_LNG = 100.5018

const SEARCH_QUERIES = [
  // Food — varied areas and cuisines
  { query: 'best Thai restaurant Sukhumvit Bangkok', category: 'food' as const },
  { query: 'best restaurant Silom Bangkok', category: 'food' as const },
  { query: 'best Thai food Ari Phahonyothin Bangkok', category: 'food' as const },
  { query: 'street food Bangkok Yaowarat Chinatown', category: 'food' as const },
  { query: 'fine dining restaurant Bangkok Sathorn', category: 'food' as const },
  { query: 'hidden gem local food Bangkok', category: 'food' as const },
  { query: 'seafood restaurant Bangkok', category: 'food' as const },
  { query: 'Japanese restaurant Bangkok Thonglor', category: 'food' as const },
  { query: 'Thai street food Ekkamai Bangkok', category: 'food' as const },
  // Cafe
  { query: 'specialty coffee cafe Thonglor Bangkok', category: 'cafe' as const },
  { query: 'aesthetic cafe Bangkok Ari', category: 'cafe' as const },
  { query: 'best cafe Sukhumvit Bangkok', category: 'cafe' as const },
  { query: 'coffee roastery Bangkok', category: 'cafe' as const },
  // Shopping
  { query: 'night market Bangkok shopping', category: 'shopping' as const },
  { query: 'Chatuchak weekend market Bangkok', category: 'shopping' as const },
  { query: 'mall Bangkok MBK Siam', category: 'shopping' as const },
  // Nightlife
  { query: 'rooftop bar Bangkok night view', category: 'nightlife' as const },
  { query: 'cocktail bar Bangkok Ekkamai Thonglor', category: 'nightlife' as const },
  { query: 'jazz bar live music Bangkok', category: 'nightlife' as const },
  // Hotel
  { query: 'boutique hotel Bangkok Silom', category: 'hotel' as const },
  { query: 'luxury hotel Bangkok Sukhumvit', category: 'hotel' as const },
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
  primaryTypeDisplayName?: { text: string }
  businessStatus?: string
  rating?: number
  priceLevel?: string
  location: { latitude: number; longitude: number }
  photos?: Array<{ name: string }>
  id: string
  editorialSummary?: { text: string }
  reviews?: Array<{ text?: { text: string }; originalText?: { text: string } }>
}

type QueryConfig = { query: string; category: 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel' }

export async function scrapeGoogleMapsQueries(queries: QueryConfig[]): Promise<ScrapedItem[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return []

  const results: ScrapedItem[] = []

  for (const { query, category } of queries) {
    try {
      const res = await fetch(PLACES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://bangkok-guide-alpha.vercel.app/',
          'X-Goog-FieldMask': [
            'places.displayName', 'places.formattedAddress', 'places.primaryTypeDisplayName',
            'places.businessStatus', 'places.rating', 'places.priceLevel',
            'places.location', 'places.photos', 'places.id', 'places.editorialSummary', 'places.reviews',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 10,
          locationBias: { circle: { center: { latitude: BANGKOK_LAT, longitude: BANGKOK_LNG }, radius: 10000 } },
        }),
      })
      const data = await res.json()
      if (!data.places?.length) continue
      const validPlaces = (data.places as GMPlace[]).slice(0, 8).filter(
        p => !p.businessStatus || p.businessStatus === 'OPERATIONAL'
      )
      const nameEns = validPlaces.map(p => p.displayName.text)
      const nameZhs = await translateNames(nameEns)
      for (let i = 0; i < validPlaces.length; i++) {
        const place = validPlaces[i]
        const highlights = place.reviews ? extractHighlights(place.reviews) : []
        const { description_en } = buildDescriptions(
          place.editorialSummary?.text, highlights, category, place.primaryTypeDisplayName?.text
        )
        const description_zh = await generateDescriptionZh(
          place.displayName.text, place.editorialSummary?.text, highlights, category
        )
        const name_en = place.displayName.text
        const q = encodeURIComponent(name_en + ' ' + place.formattedAddress)
        results.push({
          name_en, name_zh: nameZhs[i] ?? name_en,
          description_en, description_zh, category,
          address: place.formattedAddress,
          lat: place.location.latitude, lng: place.location.longitude,
          photos: place.photos?.[0]?.name ? [place.photos[0].name] : [],
          source_url: `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.id}`,
          rating: place.rating ?? 4.0,
          price_range: PRICE_MAP[place.priceLevel ?? ''] ?? 2,
          trending: false, highlights,
        })
      }
      await sleep(1000)
    } catch (err) {
      console.error('Google Maps scrape failed for', query, err)
    }
  }

  return results
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
          'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://bangkok-guide-alpha.vercel.app/',
          'X-Goog-FieldMask': [
            'places.displayName',
            'places.formattedAddress',
            'places.primaryTypeDisplayName',
            'places.businessStatus',
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

      const validPlaces2 = (data.places as GMPlace[]).slice(0, 8).filter(p => {
        if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') {
          console.log(`Skipping "${p.displayName.text}" — ${p.businessStatus}`)
          return false
        }
        return true
      })
      const nameEns2 = validPlaces2.map(p => p.displayName.text)
      const nameZhs2 = await translateNames(nameEns2)
      for (let i = 0; i < validPlaces2.length; i++) {
        const place = validPlaces2[i]
        const highlights = place.reviews ? extractHighlights(place.reviews) : []
        const { description_en } = buildDescriptions(
          place.editorialSummary?.text, highlights, category, place.primaryTypeDisplayName?.text
        )
        const description_zh = await generateDescriptionZh(
          place.displayName.text, place.editorialSummary?.text, highlights, category
        )
        const name_en = place.displayName.text
        const q = encodeURIComponent(name_en + ' ' + place.formattedAddress)
        results.push({
          name_en,
          name_zh: nameZhs2[i] ?? name_en,
          description_en,
          description_zh,
          category,
          address: place.formattedAddress,
          lat: place.location.latitude,
          lng: place.location.longitude,
          photos: place.photos?.[0]?.name ? [place.photos[0].name] : [],
          source_url: `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.id}`,
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
