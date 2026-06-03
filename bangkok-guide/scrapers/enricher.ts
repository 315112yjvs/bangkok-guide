import { translateName, generateDescriptionZh } from './translate'
import { buildDescZh, buildDescEn, cleanHighlights } from '../lib/buildDescriptions'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'

type PlaceResult = {
  displayName?: { text: string }
  formattedAddress?: string
  primaryTypeDisplayName?: { text: string }
  rating?: number
  location?: { latitude: number; longitude: number }
  photos?: Array<{ name: string }>
  editorialSummary?: { text: string }
  reviews?: Array<{ text?: { text: string }; originalText?: { text: string } }>
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | string
}

async function findPlace(name: string, lat?: number, lng?: number): Promise<PlaceResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const body: Record<string, unknown> = {
    textQuery: `${name} Bangkok`,
    maxResultCount: 1,
  }
  if (lat && lng) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } }
  }

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
          'places.location',
          'places.photos',
          'places.editorialSummary',
          'places.reviews',
        ].join(','),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.places?.[0] ?? null
  } catch {
    return null
  }
}

// Ordered list of food/drink items to look for in review text
const KNOWN_ITEMS: [string, string][] = [
  ['pad thai', 'Pad Thai'],
  ['pad kra pao', 'Pad Kra Pao'],
  ['som tum', 'Som Tum'],
  ['tom yum', 'Tom Yum'],
  ['tom kha', 'Tom Kha'],
  ['green curry', 'Green Curry'],
  ['massaman', 'Massaman Curry'],
  ['khao man gai', 'Khao Man Gai'],
  ['mango sticky rice', 'Mango Sticky Rice'],
  ['mango sorbet', 'Mango Sorbet'],
  ['boat noodles', 'Boat Noodles'],
  ['papaya salad', 'Papaya Salad'],
  ['larb', 'Larb'],
  ['satay', 'Satay'],
  ['dim sum', 'Dim Sum'],
  ['dumplings', 'Dumplings'],
  ['ramen', 'Ramen'],
  ['sushi', 'Sushi'],
  ['omakase', 'Omakase'],
  ['pasta', 'Pasta'],
  ['steak', 'Steak'],
  ['tiramisu', 'Tiramisu'],
  ['croissant', 'Croissant'],
  ['espresso', 'Espresso'],
  ['pour over', 'Pour Over'],
  ['cold brew', 'Cold Brew'],
  ['thai tea', 'Thai Tea'],
  ['craft beer', 'Craft Beer'],
  ['cocktail', 'Cocktails'],
  ['rooftop', 'Rooftop View'],
  ['city view', 'City View'],
  ['live music', 'Live Music'],
]

export function extractHighlights(
  reviews: Array<{ text?: { text: string }; originalText?: { text: string } }>
): string[] {
  const allText = reviews
    .map(r => r.text?.text ?? r.originalText?.text ?? '')
    .join(' ')
    .toLowerCase()

  // First pass: known food/drink items
  const found: string[] = []
  for (const [keyword, label] of KNOWN_ITEMS) {
    if (allText.includes(keyword)) {
      found.push(label)
      if (found.length >= 3) break
    }
  }

  if (found.length >= 2) return found

  // Second pass: pattern-based extraction for other items
  const patterns = [
    /(?:try|order|get|love|best|famous for|known for|recommend(?:ed)?)\s+(?:the\s+)?([a-z][a-z\s]{2,25}?)(?:[.,!]|$)/gi,
    /([a-z][a-z\s]{2,20}?)\s+(?:is amazing|is great|is delicious|is excellent|was incredible|was outstanding)/gi,
    /must[- ](?:try|order|have)\s+(?:the\s+)?([a-z][a-z\s]{2,25}?)(?:[.,!]|$)/gi,
  ]

  const freq = new Map<string, number>()
  for (const pat of patterns) {
    let m
    while ((m = pat.exec(allText)) !== null) {
      const item = m[1].trim().replace(/\s+/g, ' ')
      if (item.length >= 4 && item.length <= 30 && !/^\d/.test(item)) {
        // Skip overly generic words
        if (/^(the|this|that|here|food|place|dish|meal|service|staff|everything|nothing|something)$/i.test(item)) continue
        const key = item.toLowerCase()
        freq.set(key, (freq.get(key) ?? 0) + 1)
      }
    }
  }

  const extra = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3 - found.length)
    .map(([key]) => key.replace(/^\w/, c => c.toUpperCase()))

  return [...found, ...extra].slice(0, 3)
}

// Bangkok area extraction from Google formattedAddress
const AREA_PATTERNS: Array<[RegExp, string]> = [
  [/thong lo|thonglor|thong lor/i, 'Thonglor'],
  [/ekkamai|ekamai/i, 'Ekkamai'],
  [/phrom phong|prompong|phrompong/i, 'Phrom Phong'],
  [/asok|asoke/i, 'Asok'],
  [/on nut|on-nut|onnut/i, 'On Nut'],
  [/udom suk/i, 'Udom Suk'],
  [/bearing|samrong/i, 'Bearing'],
  [/nana(?!\s*plaza)/i, 'Nana'],
  [/phloen chit|ploenchit|ploen chit/i, 'Ploenchit'],
  [/chit lom|chidlom/i, 'Chidlom'],
  [/siam(?!\s*paragon|\s*square|\s*center)/i, 'Siam'],
  [/ratchadamri/i, 'Ratchadamri'],
  [/silom/i, 'Silom'],
  [/surawong|surawongse/i, 'Surawong'],
  [/sathorn/i, 'Sathorn'],
  [/charoen krung|charoenkrung/i, 'Charoen Krung'],
  [/ari\b/i, 'Ari'],
  [/phahon yothin|phahonyothin/i, 'Phahonyothin'],
  [/ratchayothin/i, 'Ratchayothin'],
  [/lat phrao|ladprao|lad phrao/i, 'Lat Phrao'],
  [/ratchadaphisek|ratchada\b/i, 'Ratchada'],
  [/huai khwang|huay kwang|huaikhwang/i, 'Huai Khwang'],
  [/chatuchak/i, 'Chatuchak'],
  [/mo chit/i, 'Mo Chit'],
  [/don mueang|don muang/i, 'Don Mueang'],
  [/yaowarat/i, 'Yaowarat'],
  [/khao san|khaosan|ko san/i, 'Khao San'],
  [/bang rak|bangrak/i, 'Bang Rak'],
  [/pratunam|pratunam/i, 'Pratunam'],
  [/ratchathewi/i, 'Ratchathewi'],
  [/bang phlat|bangphlat/i, 'Bang Phlat'],
  [/thon buri|thonburi/i, 'Thon Buri'],
  [/khlong san/i, 'Khlong San'],
  [/phra khanong/i, 'Phra Khanong'],
  [/wang thong lang/i, 'Wang Thong Lang'],
  [/min buri/i, 'Min Buri'],
  // District-level fallbacks
  [/watthana/i, 'Sukhumvit'],
  [/khlong toei/i, 'Sukhumvit'],
  [/phra nakhon/i, 'Old City'],
  [/samphanthawong/i, 'Yaowarat'],
  [/pathum wan|pathumwan/i, 'Siam'],
  [/phaya thai/i, 'Phaya Thai'],
  [/bang sue/i, 'Bang Sue'],
]

export function extractArea(formattedAddress: string): string {
  for (const [pattern, area] of AREA_PATTERNS) {
    if (pattern.test(formattedAddress)) return area
  }
  return 'Bangkok'
}

const CAT_ZH: Record<string, string> = {
  food: '餐廳', cafe: '咖啡廳', shopping: '購物景點', nightlife: '夜生活場所', hotel: '飯店', attraction: '景點',
}

export function buildDescriptions(
  editorial: string | undefined,
  highlights: string[],
  category: string,
  primaryType?: string
): { description_en: string; description_zh: string } {
  const catZh = CAT_ZH[category] ?? '地點'
  const typeLabel = primaryType ?? (category === 'cafe' ? 'specialty cafe' : `${category} spot`)

  const highlightEn = highlights.length > 0
    ? ` Must-try: ${highlights.join(', ')}.`
    : ''

  const baseEn = editorial ?? `Highly recommended ${typeLabel} in Bangkok.`
  const description_en = baseEn + highlightEn

  // description_zh excludes highlights (shown separately as pills)
  let description_zh: string
  if (editorial) {
    const condensed = editorial.length > 60 ? editorial.slice(0, 60) + '…' : editorial
    description_zh = condensed
  } else if (highlights.length > 0) {
    description_zh = `曼谷人氣${catZh}，深受本地人喜愛。`
  } else {
    description_zh = `曼谷熱門${catZh}，評價極佳。`
  }

  return { description_en, description_zh }
}

export type EnrichedItem = {
  name_en: string
  name_zh: string
  description_en: string
  description_zh: string
  highlights: string[]
  lat: number
  lng: number
  photos: string[]
  rating: number
  area: string
  address: string
}

// Returns null if the name can't be matched to a real Bangkok place on Google Maps.
export async function enrichItem(
  name: string,
  category: string,
  lat?: number,
  lng?: number
): Promise<EnrichedItem | null> {
  const place = await findPlace(name, lat, lng)
  if (!place) return null

  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
    console.log(`Skipping "${name}" — ${place.businessStatus}`)
    return null
  }

  // Skip tourist attractions, landmarks, government buildings, and districts
  const placeType = (place.primaryTypeDisplayName?.text ?? '').toLowerCase()
  const NON_VENUE_TYPES = [
    'tourist attraction', 'historical landmark', 'monument', 'museum', 'art museum',
    'religious site', 'buddhist temple', 'hindu temple', 'mosque', 'church', 'cathedral',
    'palace', 'government office', 'city hall', 'embassy', 'national park', 'park',
    'neighborhood', 'subdistrict', 'locality', 'transit station', 'train station',
    'subway station', 'airport', 'hospital', 'university', 'school', 'library',
  ]
  if (NON_VENUE_TYPES.some(t => placeType.includes(t))) {
    console.log(`Skipping "${name}" — non-venue type: ${place.primaryTypeDisplayName?.text}`)
    return null
  }

  const rawHighlights = place.reviews ? extractHighlights(place.reviews) : []
  const highlights = cleanHighlights(rawHighlights)
  const editorial = place.editorialSummary?.text
  const photoRef = place.photos?.[0]?.name ?? ''

  const name_en = place.displayName?.text ?? name
  const name_zh = await translateName(name_en)

  // Use Claude if available, otherwise fall back to template builder
  const description_zh_rich = await generateDescriptionZh(
    name_en, editorial, highlights, category
  )
  const price_range = 2 as 1|2|3|4
  const baseLoc = { category, rating: place.rating ?? 4.0, price_range, local_ratio: 0, tag: 'evergreen' }
  const description_en = buildDescEn(baseLoc, highlights, editorial)
  const description_zh = description_zh_rich || buildDescZh({ ...baseLoc, source: 'googlemaps' as const, name_en }, highlights, editorial)

  const formattedAddress = place.formattedAddress ?? ''
  const area = extractArea(formattedAddress)

  return {
    name_en,
    name_zh,
    description_en,
    description_zh,
    highlights,
    lat: place.location?.latitude ?? lat ?? 13.7563,
    lng: place.location?.longitude ?? lng ?? 100.5018,
    photos: photoRef ? [photoRef] : [],
    rating: place.rating ?? 4.0,
    area,
    address: formattedAddress || 'Bangkok, Thailand',
  }
}
