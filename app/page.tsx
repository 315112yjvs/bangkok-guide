import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import { PublicHomepage } from './PublicHomepage'

export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Page() {
  const locations = readLocations()
  return <PublicHomepage locations={locations} />
}
