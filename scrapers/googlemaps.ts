import { sleep, categoryLabel, type ScrapedItem } from './shared'
import { extractHighlights } from './enricher'
import { cleanHighlights } from '../lib/buildDescriptions'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const BANGKOK_LAT = 13.7563
const BANGKOK_LNG = 100.5018

export type QueryConfig = { query: string; category: 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel'; local?: boolean }

// 補庫存用的關鍵字：全部用泰文，照泰國人自己找店的講法下，目的是找到在地人常去的店。
// 刻意不放英文關鍵字、大商場、觀光夜市和飯店：那些會撈到觀光客取向的地方，站主不需要。
// 不寫年份，避免過時。
const SEARCH_QUERIES: QueryConfig[] = [
  // ── 泰國人常吃的料理 ──
  { query: 'ร้านอาหารไทย กรุงเทพ อร่อย คนไทยชอบ', category: 'food', local: true },
  { query: 'ข้าวมันไก่ กรุงเทพ เด็ด', category: 'food', local: true },
  { query: 'ก๋วยเตี๋ยว ร้านดัง กรุงเทพ', category: 'food', local: true },
  { query: 'ก๋วยเตี๋ยวเรือ กรุงเทพ ร้านดัง', category: 'food', local: true },
  { query: 'ส้มตำ ร้านดัง กรุงเทพ', category: 'food', local: true },
  { query: 'อาหารอีสาน กรุงเทพ เด็ด', category: 'food', local: true },
  { query: 'อาหารใต้ กรุงเทพ อร่อย', category: 'food', local: true },
  { query: 'อาหารเหนือ ข้าวซอย กรุงเทพ', category: 'food', local: true },
  { query: 'หมูกระทะ กรุงเทพ อร่อย', category: 'food', local: true },
  { query: 'ผัดไทย ร้านดัง กรุงเทพ', category: 'food', local: true },
  { query: 'ต้มยำ ร้านดัง กรุงเทพ', category: 'food', local: true },
  { query: 'ร้านข้าวแกง เจ้าดัง กรุงเทพ', category: 'food', local: true },
  { query: 'ข้าวต้มโต้รุ่ง กรุงเทพ', category: 'food', local: true },
  { query: 'โจ๊ก ข้าวต้ม ร้านอาหารเช้า กรุงเทพ คนไทย', category: 'food', local: true },
  { query: 'ร้านอาหารทะเล กรุงเทพ คนไทยไป', category: 'food', local: true },
  { query: 'ร้านอาหารจีน เยาวราช คนไทยไป', category: 'food', local: true },
  { query: 'ร้านอาหารริมน้ำ กรุงเทพ คนไทย', category: 'food', local: true },

  // ── 老店、私房店（泰國人找店的講法，最能避開觀光客店）──
  { query: 'ร้านเจ้าเก่า กรุงเทพ ในตำนาน อร่อย', category: 'food', local: true },
  { query: 'ร้านลับ กรุงเทพ คนท้องถิ่น เด็ด', category: 'food', local: true },
  { query: 'ร้านเด็ด บิบกูร์มองด์ มิชลิน กรุงเทพ', category: 'food', local: true },
  { query: 'ร้านอาหาร คนไทยรีวิว Wongnai กรุงเทพ', category: 'food', local: true },

  // ── 觀光客較少去的住宅區、在地生活圈 ──
  { query: 'ร้านอาหารเด็ด ย่านลาดพร้าว เกษตร นวมินทร์', category: 'food', local: true },
  { query: 'ร้านอาหาร ย่านรัชดา พระราม 9', category: 'food', local: true },
  { query: 'ร้านอร่อย ย่านรามคำแหง บางกะปิ', category: 'food', local: true },
  { query: 'ร้านอาหาร ย่านอ่อนนุช อุดมสุข เด็ด', category: 'food', local: true },
  { query: 'ร้านเด็ด ฝั่งธน ปิ่นเกล้า จรัญ', category: 'food', local: true },
  { query: 'ร้านอาหาร ย่านประชาชื่น งามวงศ์วาน', category: 'food', local: true },
  { query: 'ร้านอาหาร ย่านบางนา ศรีนครินทร์', category: 'food', local: true },
  { query: 'ร้านอาหาร ย่านอารีย์ สะพานควาย คนไทย', category: 'food', local: true },

  // ── 咖啡廳、甜點 ──
  { query: 'คาเฟ่ กรุงเทพ คนไทยชอบ สวย', category: 'cafe', local: true },
  { query: 'ร้านกาแฟ สด กรุงเทพ อร่อย', category: 'cafe', local: true },
  { query: 'คาเฟ่เปิดใหม่ กรุงเทพ', category: 'cafe', local: true },
  { query: 'คาเฟ่ลับ กรุงเทพ คนไม่เยอะ', category: 'cafe', local: true },
  { query: 'ร้านกาแฟ specialty กรุงเทพ คั่วเอง', category: 'cafe', local: true },
  { query: 'ร้านขนมหวาน เบเกอรี่ กรุงเทพ คนไทยชอบ', category: 'cafe', local: true },
  { query: 'คาเฟ่ ย่านลาดพร้าว เกษตร คนไทยชอบ', category: 'cafe', local: true },
  { query: 'ร้านกาแฟลับ ฝั่งธน คนท้องถิ่น', category: 'cafe', local: true },
  { query: 'คาเฟ่ ย่านอ่อนนุช พระโขนง บางนา', category: 'cafe', local: true },

  // ── 泰國人自己去的酒吧 ──
  { query: 'บาร์คนไทย กรุงเทพ สนุก', category: 'nightlife', local: true },
  { query: 'บาร์ลับ กรุงเทพ', category: 'nightlife', local: true },
  { query: 'ร้านนั่งชิล ดนตรีสด กรุงเทพ', category: 'nightlife', local: true },
  { query: 'คราฟต์เบียร์ กรุงเทพ ร้านดัง', category: 'nightlife', local: true },
  { query: 'ร้านเหล้า นั่งชิล ย่านลาดพร้าว รัชดา', category: 'nightlife', local: true },
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
        'places.location', 'places.photos', 'places.id',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 10,
      // 用泰國在地視角排序（regionCode TH）。關鍵字是泰文，但店名一律要英文版：
      // 之前用 languageCode 'th' 會拿到純泰文店名，台灣讀者看不懂，事後還得一家家補拼音。
      // 店家本身沒有英文名的，Google 仍會回泰文。
      regionCode: 'TH',
      languageCode: 'en',
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
