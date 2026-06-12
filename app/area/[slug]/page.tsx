import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations } from '@/lib/data'
import { CATEGORY_META, listAreas, slugToArea } from '@/lib/collections'
import { getArea } from '@/lib/area'
import { CollectionView } from '@/components/CollectionView'

export const revalidate = 3600

export function generateStaticParams() {
  return listAreas(readLocations()).map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const area = slugToArea(slug, readLocations())
  if (!area) return {}
  const titleZh = `${area} 美食咖啡廳推薦 📍 曼谷在地精選`
  const descZh = `住在曼谷的人精選 ${area} 的咖啡廳、餐廳、酒吧與打卡景點，幫你規劃 ${area} 一日散步路線。`
  return {
    title: titleZh,
    description: descZh,
    alternates: { canonical: `/area/${slug}` },
    openGraph: { title: titleZh, description: descZh, type: 'website' },
  }
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const all = readLocations()
  const area = slugToArea(slug, all)
  if (!area) notFound()

  const locations = all
    .filter((l) => getArea(l) === area)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  // 交叉連結：各分類
  const related = Object.values(CATEGORY_META).map((c) => ({
    href: `/category/${c.slug}`,
    label: `${c.emoji} ${c.h1Zh}`,
  }))

  return (
    <CollectionView
      locations={locations}
      h1Zh={`${area} 在地精選`}
      h1En={`${area} Local Picks`}
      descZh={`住在曼谷的人精選 ${area} 的咖啡廳、餐廳、酒吧與打卡景點。`}
      descEn={`Hand-picked spots in ${area}, Bangkok — cafes, eats, bars and more.`}
      emoji="📍"
      related={related}
    />
  )
}
