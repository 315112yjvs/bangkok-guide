import { notFound } from 'next/navigation'
import { readLocations } from '@/lib/data'
import { LocationDetail } from './LocationDetail'

export async function generateStaticParams() {
  const locations = readLocations()
  return locations.map((l) => ({ id: l.id }))
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locations = readLocations()
  const location = locations.find((l) => l.id === id)
  if (!location) notFound()
  return <LocationDetail location={location} />
}
