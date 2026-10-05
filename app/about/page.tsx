import type { Metadata } from 'next'
import { AboutView } from './AboutView'

export const metadata: Metadata = {
  title: '關於曼谷人 | BKK LOCAL',
  description: '曼谷人的店家是怎麼選進來的、資料多久更新一次，以及資料來源。',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return <AboutView />
}
