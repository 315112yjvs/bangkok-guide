import type { Metadata } from 'next'
import { readContact, contactLinks } from '@/lib/site'
import { AboutView } from './AboutView'

export const metadata: Metadata = {
  title: '關於曼谷人 | BKK LOCAL',
  description: '曼谷人的店家是怎麼選進來的、資料多久更新一次，以及資料來源。',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  // 聯絡方式由站主在後台填寫（data/site.json）；沒填就不顯示這一段
  const contact = readContact()
  return <AboutView links={contactLinks(contact)} note={contact.note} />
}
