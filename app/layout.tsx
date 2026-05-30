import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '曼谷旅遊指南 | Bangkok Guide',
  description: '精選曼谷美食、咖啡廳、購物、夜生活、飯店推薦',
  openGraph: {
    title: '曼谷旅遊指南 | Bangkok Guide',
    description: '精選曼谷美食、咖啡廳、購物、夜生活、飯店推薦 — 在地私藏 × TikTok 爆紅地點',
    url: 'https://bangkok-guide-alpha.vercel.app',
    siteName: '曼谷旅遊指南',
    images: [{ url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&h=630&fit=crop', width: 1200, height: 630 }],
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '曼谷旅遊指南 | Bangkok Guide',
    description: '精選曼谷美食、咖啡廳、購物、夜生活、飯店推薦',
    images: ['https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&h=630&fit=crop'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
