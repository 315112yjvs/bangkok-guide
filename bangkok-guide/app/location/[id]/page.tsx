import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import { LocationDetail } from './LocationDetail'

export async function generateStaticParams() {
  const locations = readLocations()
  return locations.map((l) => ({ id: l.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const locations = readLocations()
  const loc = locations.find((l) => l.id === id)
  if (!loc) return {}

  const photo = loc.photos[0]
    ? loc.photos[0].startsWith('places/')
      ? `https://places.googleapis.com/v1/${loc.photos[0]}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : loc.photos[0]
    : 'https://images.unsplash.com/photo-1552911180-2a7279af1b85?w=1200&h=630&fit=crop'

  const title = `${loc.name_en} — 曼谷人`
  const description = loc.description_zh || loc.description_en || ''

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: photo, width: 800, height: 600 }],
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description, images: [photo] },
  }
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locations = readLocations()
  const location = locations.find((l) => l.id === id)
  if (!location) notFound()
  return <LocationDetail location={location} />
}
