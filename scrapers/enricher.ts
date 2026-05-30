const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'

type PlaceResult = {
  displayName?: { text: string }
  formattedAddress?: string
  rating?: number
  location?: { latitude: number; longitude: number }
  photos?: Array<{ name: string }>
  editorialSummary?: { text: string }
  reviews?: Array<{ text?: { text: string }; originalText?: { text: string } }>
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
        'X-Goog-FieldMask': [
          'places.displayName',
          'places.formattedAddress',
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

export function extractHighlights(
  reviews: Array<{ text?: { text: string }; originalText?: { text: string } }>
): string[] {
  const allText = reviews.map(r => r.text?.text ?? r.originalText?.text ?? '').join(' ')

  const patterns = [
    /(?:try|order|get|have|love|best|famous for|known for|recommend(?:ed)?)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[a-z]+){0,3})/g,
    /([A-Z][a-z]+(?:\s+[a-z]+){0,2})\s+(?:is amazing|is great|is delicious|is excellent|was amazing|was delicious)/g,
    /(?:must[- ]try|must[- ]have|must[- ]order)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[a-z]+){0,3})/gi,
  ]

  const freq = new Map<string, number>()
  for (const pat of patterns) {
    let m
    while ((m = pat.exec(allText)) !== null) {
      const item = m[1].trim()
      if (item.length >= 4 && item.length <= 40 && !/^\d/.test(item)) {
        const key = item.toLowerCase()
        freq.set(key, (freq.get(key) ?? 0) + 1)
      }
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key.replace(/^\w/, (c: string) => c.toUpperCase()))
}

const CAT_ZH: Record<string, string> = {
  food: '餐廳', cafe: '咖啡廳', shopping: '購物景點', nightlife: '夜生活場所', hotel: '飯店',
}

export function buildDescriptions(
  editorial: string | undefined,
  highlights: string[],
  category: string
): { description_en: string; description_zh: string } {
  const catZh = CAT_ZH[category] ?? '地點'

  const highlightEn = highlights.length > 0 ? ` Must-try: ${highlights.join(', ')}.` : ''
  const description_en = (editorial ?? `Popular ${category} in Bangkok.`) + highlightEn

  let description_zh = highlights.length > 0
    ? `必點：${highlights.join('、')}。`
    : `曼谷人氣${catZh}。`
  if (editorial) {
    const condensed = editorial.length > 60 ? editorial.slice(0, 60) + '…' : editorial
    description_zh += condensed
  } else {
    description_zh += `曼谷人氣${catZh}。`
  }

  return { description_en, description_zh }
}

export type EnrichedItem = {
  name_en: string
  description_en: string
  description_zh: string
  highlights: string[]
  lat: number
  lng: number
  photos: string[]
  rating: number
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

  const highlights = place.reviews ? extractHighlights(place.reviews) : []
  const editorial = place.editorialSummary?.text
  const { description_en, description_zh } = buildDescriptions(editorial, highlights, category)
  const photoRef = place.photos?.[0]?.name ?? ''

  return {
    name_en: place.displayName?.text ?? name,
    description_en,
    description_zh,
    highlights,
    lat: place.location?.latitude ?? lat ?? 13.7563,
    lng: place.location?.longitude ?? lng ?? 100.5018,
    photos: photoRef ? [photoRef] : [],
    rating: place.rating ?? 4.0,
  }
}
