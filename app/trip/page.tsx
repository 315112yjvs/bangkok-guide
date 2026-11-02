import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tripEnabled } from '@/lib/site'
import { TripView } from './TripView'

export const metadata: Metadata = {
  title: '曼谷客製行程 | 住在曼谷的人幫你排',
  description: '依你的天數、預算和喜好，住在曼谷的人幫你排一份真的走得完的行程：路線、餐廳、拜拜、交通一次搞定。',
  alternates: { canonical: '/trip' },
}

export default function TripPage() {
  if (!tripEnabled) notFound()
  return <TripView />
}
