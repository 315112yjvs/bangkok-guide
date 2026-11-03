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
  const url = `https://www.bkk-local.com/guide/${route.slug}`
  // 結構化資料：一日遊行程（依序經過的每一站）+ 麵包屑
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: route.title_zh,
      description: route.intro_zh,
      url,
      inLanguage: 'zh-TW',
      touristType: '自由行旅客',
      itinerary: {
        '@type': 'ItemList',
        numberOfItems: stops.length,
        itemListElement: stops.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': s.location.category === 'temple' ? 'PlaceOfWorship' : 'TouristAttraction',
            name: s.location.name_zh,
            alternateName: s.location.name_en,
            url: `https://www.bkk-local.com/location/${s.location.slug ?? s.location.id}`,
            geo: { '@type': 'GeoCoordinates', latitude: s.location.lat, longitude: s.location.lng },
          },
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '曼谷人', item: 'https://www.bkk-local.com/' },
        { '@type': 'ListItem', position: 2, name: route.title_zh, item: url },
      ],
    },
  ]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <RouteView route={route} stops={stops} />
    </>
  )
}
