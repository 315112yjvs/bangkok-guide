import type { Metadata } from 'next'
import { readVisibleLocations, toCardLocation } from '@/lib/data'
import { decodeList } from '@/lib/shareList'
import { CollectionView } from '@/components/CollectionView'
import { SaveAllButton } from './SaveAllButton'

// 每個人的清單都不一樣，不給搜尋引擎收錄
export const metadata: Metadata = {
  title: '旅伴分享的曼谷清單 | 曼谷人',
  description: '朋友在曼谷人收藏的店家清單，點開看地址、營業時間和導航。',
  robots: { index: false, follow: true },
}

export default async function ListPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams
  const prefixes = decodeList(p)
  const all = readVisibleLocations()
  // 依分享者收藏的順序排
  const locations = prefixes
    .map((pre) => all.find((l) => l.id.startsWith(pre)))
    .filter((l): l is NonNullable<typeof l> => !!l)
    .map(toCardLocation)

  return (
    <CollectionView
      locations={locations}
      h1Zh="旅伴分享的曼谷清單"
      h1En="A Bangkok list from your friend"
      descZh="朋友在曼谷人收藏的店，點進去看地址、營業時間和導航。"
      descEn="Places your friend saved on BKK LOCAL. Tap for address, hours and directions."
      icon="place"
      related={[]}
      keepOrder
      banner={locations.length > 0 ? <SaveAllButton ids={locations.map((l) => l.id)} /> : undefined}
    />
  )
}
