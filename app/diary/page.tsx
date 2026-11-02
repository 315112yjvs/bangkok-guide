import type { Metadata } from 'next'
import { readDiary } from '@/lib/diary'
import { DiaryView } from './DiaryView'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '曼谷日記 | 曼谷人',
  description: '住在曼谷的日常：去了哪間廟、吃了什麼、看到什麼。一張照片配幾句話。',
  alternates: { canonical: '/diary' },
}

export default function DiaryPage() {
  return <DiaryView entries={readDiary()} />
}
