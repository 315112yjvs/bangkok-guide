import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations, toCardLocation } from '@/lib/data'
import { TEMPLE_ROUTES } from '@/lib/templeRoutes'
import { RouteView } from './RouteView'

export const revalidate = 3600

export function generateStaticParams() {
  return TEMPLE_ROUTES.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const route = TEMPLE_ROUTES.find((r) => r.slug === slug)
  if (!route) return {}
  return {
    title: `${route.title_zh} | 曼谷人`,
    description: route.intro_zh,
    alternates: { canonical: `/guide/${slug}` },
    openGraph: { title: route.title_zh, description: route.intro_zh, type: 'article' },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const route = TEMPLE_ROUTES.find((r) => r.slug === slug)
  if (!route) notFound()
  const all = readLocations()
  const stops = route.stops.flatMap((s) => {
    const loc = all.find((l) => l.id === s.id)
    return loc ? [{ location: toCardLocation(loc), note: s.note_zh, noteEn: s.note_en }] : []
  })
  return <RouteView route={route} stops={stops} />
}
