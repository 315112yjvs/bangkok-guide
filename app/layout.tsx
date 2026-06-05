import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '曼谷人 | BKK Local',
  description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 每日更新',
  openGraph: {
    title: '曼谷人 | BKK Local',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × TikTok 爆紅地點 × 每日更新',
    url: 'https://www.bkk-local.com',
    siteName: '曼谷人',
    images: [{ url: 'https://www.bkk-local.com/hero-bangkok.jpg', width: 1200, height: 900 }],
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '曼谷人 | BKK Local',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 每日更新',
    images: ['https://www.bkk-local.com/hero-bangkok.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
