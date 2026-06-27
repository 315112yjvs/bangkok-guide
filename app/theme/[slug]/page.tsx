import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import { getTheme, THEMES } from '@/lib/themes'
import { CATEGORY_META } from '@/lib/collections'
import { CollectionView } from '@/components/CollectionView'

export const revalidate = 3600

export function generateStaticParams() {
  return THEMES.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const theme = getTheme(slug)
  if (!theme) return {}
  return {
    title: theme.titleZh,
    description: theme.descZh,
    alternates: { canonical: `/theme/${slug}` },
    openGraph: { title: theme.titleZh, description: theme.descZh, type: 'website' },
  }
}

export default async function ThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const theme = getTheme(slug)
  if (!theme) notFound()

  const locations = readLocations()
    .filter(theme.match)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  // 交叉連結：其他主題 + 分類
  const related = [
    ...THEMES.filter((t) => t.slug !== slug).map((t) => ({ href: `/theme/${t.slug}`, label: `${t.emoji} ${t.h1Zh}` })),
    ...Object.values(CATEGORY_META).slice(0, 3).map((c) => ({ href: `/category/${c.slug}`, label: `${c.emoji} ${c.h1Zh}` })),
  ]

  return (
    <CollectionView
      locations={locations}
      h1Zh={theme.h1Zh}
      h1En={theme.h1En}
      descZh={theme.descZh}
      descEn={theme.descEn}
      icon={theme.icon}
      related={related}
    />
  )
}
