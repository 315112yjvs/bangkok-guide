import { sleep, categoryLabel, type ScrapedItem } from './shared'
import { extractHighlights } from './enricher'
import { cleanHighlights } from '../lib/buildDescriptions'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const BANGKOK_LAT = 13.7563
const BANGKOK_LNG = 100.5018

const SEARCH_QUERIES = [
  // Food — varied areas, cuisines, styles
  { query: 'best Thai restaurant Sukhumvit Bangkok', category: 'food' as const },
  { query: 'best restaurant Silom Bangkok', category: 'food' as const },
  { query: 'best Thai food Ari Phahonyothin Bangkok', category: 'food' as const },
  { query: 'street food Bangkok Yaowarat Chinatown', category: 'food' as const },
  { query: 'fine dining restaurant Bangkok Sathorn', category: 'food' as const },
  { query: 'hidden gem local food Bangkok', category: 'food' as const },
  { query: 'seafood restaurant Bangkok', category: 'food' as const },
  { query: 'Japanese restaurant Bangkok Thonglor', category: 'food' as const },
  { query: 'Thai street food Ekkamai Bangkok', category: 'food' as const },
  { query: 'dim sum restaurant Bangkok', category: 'food' as const },
  { query: 'brunch restaurant Bangkok Thonglor', category: 'food' as const },
  { query: 'rooftop restaurant Bangkok dinner', category: 'food' as const },
  { query: 'authentic Thai food Bangkok local favourite', category: 'food' as const },
  // Cafe
  { query: 'specialty coffee cafe Thonglor Bangkok', category: 'cafe' as const },
  { query: 'aesthetic cafe Bangkok Ari', category: 'cafe' as const },
  { query: 'best cafe Sukhumvit Bangkok', category: 'cafe' as const },
  { query: 'coffee roastery Bangkok', category: 'cafe' as const },
  { query: 'brunch cafe Bangkok Ekkamai aesthetic', category: 'cafe' as const },
  { query: 'cafe Bangkok Siam Chidlom hidden gem', category: 'cafe' as const },
  // Shopping
  { query: 'night market Bangkok shopping', category: 'shopping' as const },
  { query: 'Chatuchak weekend market Bangkok', category: 'shopping' as const },
  { query: 'mall Bangkok MBK Siam Paragon', category: 'shopping' as const },
  { query: 'ICONSIAM Bangkok shopping', category: 'shopping' as const },
  { query: 'Or Tor Kor market Bangkok fresh food', category: 'shopping' as const },
  // Nightlife
  { query: 'rooftop bar Bangkok night view', category: 'nightlife' as const },
  { query: 'cocktail bar Bangkok Ekkamai Thonglor', category: 'nightlife' as const },
  { query: 'jazz bar live music Bangkok', category: 'nightlife' as const },
  { query: 'sky bar Bangkok best rooftop panoramic', category: 'nightlife' as const },
  { query: 'wine bar craft cocktail Bangkok Silom', category: 'nightlife' as const },
  // Hotel
  { query: 'boutique hotel Bangkok Silom', category: 'hotel' as const },
  { query: 'luxury hotel Bangkok Sukhumvit', category: 'hotel' as const },
  { query: 'design hotel Bangkok riverside', category: 'hotel' as const },

  // ── Thai-language queries — surfaces local favourites not found via English ──
  // Food
  { query: 'ร้านอาหารไทย กรุงเทพ อร่อย คนไทยชอบ', category: 'food' as const, local: true },
  { query: 'ข้าวมันไก่ กรุงเทพ เด็ด', category: 'food' as const, local: true },
  { query: 'ก๋วยเตี๋ยว ร้านดัง กรุงเทพ', category: 'food' as const, local: true },
  { query: 'ส้มตำ ร้านดัง กรุงเทพ', category: 'food' as const, local: true },
  { query: 'หมูกระทะ กรุงเทพ อร่อย', category: 'food' as const, local: true },
  { query: 'อาหารอีสาน กรุงเทพ เด็ด', category: 'food' as const, local: true },
  { query: 'ผัดไทย ร้านดัง กรุงเทพ', category: 'food' as const, local: true },
  { query: 'ร้านอาหารเช้า กรุงเทพ คนไทย', category: 'food' as const, local: true },
  { query: 'ต้มยำ ร้านดัง กรุงเทพ', category: 'food' as const, local: true },
  { query: 'ร้านอาหาร ย่านลาดพร้าว ยอดนิยม', category: 'food' as const, local: true },
  { query: 'ร้านอาหาร ย่านรัชดา พระราม 9', category: 'food' as const, local: true },
  // Cafe
  { query: 'คาเฟ่ กรุงเทพ คนไทยชอบ สวย', category: 'cafe' as const, local: true },
  { query: 'ร้านกาแฟ สด กรุงเทพ อร่อย', category: 'cafe' as const, local: true },
  { query: 'คาเฟ่เปิดใหม่ กรุงเทพ 2025', category: 'cafe' as const, local: true },
  // Nightlife
  { query: 'บาร์คนไทย กรุงเทพ สนุก', category: 'nightlife' as const, local: true },
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

export type QueryConfig = { query: string; category: 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel'; local?: boolean }

async function fetchPlacesQuery(query: string, category: QueryConfig['category'], apiKey: string, local = false): Promise<ScrapedItem[]> {
  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.bkk-local.com/',
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
  if (!data.places?.length) {
    console.error('Places API no results for', query, JSON.stringify(data).slice(0, 200))
    return []
  }

  const items: ScrapedItem[] = []
  for (const place of (data.places as GMPlace[]).slice(0, 8)) {
    if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
      console.log(`Skipping "${place.displayName.text}" — ${place.businessStatus}`)
      continue
    }
    if (place.rating !== undefined && place.rating < 4.0) continue

    const rawHighlights = place.reviews ? extractHighlights(place.reviews) : []
    const highlights = cleanHighlights(rawHighlights)
    const name_en = place.displayName.text
    const rating = place.rating ?? 4.0
    const price_range = PRICE_MAP[place.priceLevel ?? ''] ?? 2
    const baseLoc = { category, rating, price_range }
    const q = encodeURIComponent(name_en + ' ' + place.formattedAddress)
    // 不用 AI 生成文案，只放分類標籤（文案由使用者自行填寫）
    const label = categoryLabel(category)

    items.push({
      name_en,
      name_zh: name_en,
      description_en: label.en,
      description_zh: label.zh,
      category,
      address: place.formattedAddress,
      lat: place.location.latitude,
      lng: place.location.longitude,
      photos: place.photos?.[0]?.name ? [place.photos[0].name] : [],
      source_url: `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.id}`,
      rating,
      price_range,
      tag: 'evergreen',
      highlights,
      local_ratio: local ? 75 : undefined,
    })
  }
  return items
}

export async function scrapeGoogleMapsQueries(queries: QueryConfig[]): Promise<ScrapedItem[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return []

  const results: ScrapedItem[] = []
  for (const { query, category, local } of queries) {
    try {
      const items = await fetchPlacesQuery(query, category, apiKey, local)
      results.push(...items)
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
  for (const { query, category, local } of SEARCH_QUERIES) {
    try {
      const items = await fetchPlacesQuery(query, category, apiKey, local)
      console.log(`[GM] "${query}" → ${items.length} items`)
      results.push(...items)
      await sleep(1000)
    } catch (err) {
      console.error('Google Maps scrape failed for', query, err)
    }
  }
  return results
}
