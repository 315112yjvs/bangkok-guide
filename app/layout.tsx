import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { RegisterSW } from '@/components/RegisterSW'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#1e1b4b',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.bkk-local.com'),
  title: '曼谷人 | BKK LOCAL',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '曼谷人' },
  description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 每週更新',
  icons: {
    icon: [{ url: '/logo-circle.png', type: 'image/png', sizes: '512x512' }],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: '曼谷人 | BKK LOCAL',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × TikTok 爆紅地點 × 每週更新',
    url: 'https://www.bkk-local.com',
    siteName: '曼谷人',
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '曼谷人 | BKK LOCAL',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 每週更新',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 提早下載粉圓子集字型，避免首屏文字先用系統字再跳字（減少版面位移）*/}
        <link
          rel="preload"
          href="/fonts/openhuninn-subset.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-gray-100 min-h-screen">{children}<Analytics /><RegisterSW /></body>
    </html>
  )
}
