import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { RegisterSW } from '@/components/RegisterSW'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#FFFCF6',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.bkk-local.com'),
  title: '曼谷人 | BKK LOCAL',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '曼谷人' },
  description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 夜生活',
  icons: {
    icon: [{ url: '/logo-circle.png?v=3', type: 'image/png', sizes: '512x512' }],
    apple: '/apple-icon.png?v=2',
  },
  openGraph: {
    title: '曼谷人 | BKK LOCAL',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × TikTok 爆紅地點 × 美食咖啡廳',
    url: 'https://www.bkk-local.com',
    siteName: '曼谷人',
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '曼谷人 | BKK LOCAL',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 夜生活',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 字型：Google Fonts 的 Huninn（粉圓）。中文字型很大，Google 會切成很多小檔，只下載頁面用到的字 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Huninn&display=swap" />
      </head>
      <body className="bg-paper min-h-screen">{children}<Analytics /><RegisterSW /></body>
    </html>
  )
}
