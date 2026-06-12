import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import type { Location } from '@/lib/types'
import { LocationDetail } from './LocationDetail'

export const revalidate = 3600

// schema.org 類型對應
const SCHEMA_TYPE: Record<string, string> = {
  food: 'Restaurant',
  cafe: 'CafeOrCoffeeShop',
  nightlife: 'BarOrPub',
  hotel: 'Hotel',
  shopping: 'Store',
  attraction: 'TouristAttraction',
}

function buildJsonLd(loc: Location) {
  const photo = loc.photos[0]
    ? loc.photos[0].startsWith('places/')
      ? `https://places.googleapis.com/v1/${loc.photos[0]}/media?maxWidthPx=1200&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : loc.photos[0]
    : undefined

  // 注意：刻意不放 aggregateRating，因為缺少評論數量，放了會被 Google 判為無效結構化資料
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[loc.category] ?? 'LocalBusiness',
    name: loc.name_en,
    url: `https://www.bkk-local.com/location/${loc.id}`,
    description: loc.description_en || loc.description_zh || undefined,
    ...(photo ? { image: photo } : {}),
    ...(loc.price_range > 0 ? { priceRange: '฿'.repeat(loc.price_range) } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.address || undefined,
      addressLocality: loc.area && loc.area !== 'Bangkok' ? loc.area : 'Bangkok',
      addressCountry: 'TH',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: loc.lat,
      longitude: loc.lng,
    },
  }
  return data
}

export async function generateStaticParams() {
  const locations = readLocations()
  return locations.map((l) => ({ id: l.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const locations = readLocations()
  const loc = locations.find((l) => l.id === id)
  if (!loc) return {}

  const title = `${loc.name_en} — 曼谷人`
  const description = loc.description_zh || loc.description_en || ''

  // og:image / twitter:image 由 opengraph-image.tsx 自動產生（品牌化地點圖）
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locations = readLocations()
  const location = locations.find((l) => l.id === id)
  if (!location) notFound()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(location)) }}
      />
      <LocationDetail location={location} />
    </>
  )
}
