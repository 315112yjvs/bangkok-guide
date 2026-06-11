import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import { LocationDetail } from './LocationDetail'

export const revalidate = 3600

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
  return <LocationDetail location={location} />
}
