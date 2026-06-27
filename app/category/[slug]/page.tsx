import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import { CATEGORY_META, CATEGORY_SLUGS, listAreas } from '@/lib/collections'
import { CollectionView } from '@/components/CollectionView'

export const revalidate = 3600

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const meta = CATEGORY_META[slug]
  if (!meta) return {}
  return {
    title: meta.titleZh,
    description: meta.descZh,
    alternates: { canonical: `/category/${slug}` },
    openGraph: { title: meta.titleZh, description: meta.descZh, type: 'website' },
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const meta = CATEGORY_META[slug]
  if (!meta) notFound()

  const all = readLocations()
  const locations = all
    .filter((l) => l.category === slug)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  // 交叉連結：熱門區域（前 6）
  const related = listAreas(all)
    .slice(0, 6)
    .map((a) => ({ href: `/area/${a.slug}`, label: a.area }))

  return (
    <CollectionView
      locations={locations}
      h1Zh={meta.h1Zh}
      h1En={meta.h1En}
      descZh={meta.descZh}
      descEn={meta.descEn}
      icon={meta.icon}
      related={related}
    />
  )
}
