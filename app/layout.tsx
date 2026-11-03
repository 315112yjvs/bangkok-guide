import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { RegisterSW } from '@/components/RegisterSW'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#3d4aae',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.bkk-local.com'),
  title: '曼谷人 | BKK LOCAL',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '曼谷人' },
  description: '曼谷人自己會去的地方：住在曼谷的人挑好的美食、咖啡廳、拜拜與一日路線',
  icons: {
    icon: [{ url: '/logo-circle.png?v=3', type: 'image/png', sizes: '512x512' }],
    apple: '/apple-icon.png?v=2',
  },
  openGraph: {
    title: '曼谷人 | BKK LOCAL',
    description: '曼谷人自己會去的地方：住在曼谷的人挑好的美食、咖啡廳、拜拜與一日路線',
    url: 'https://www.bkk-local.com',
    siteName: '曼谷人',
    locale: 'zh_TW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '曼谷人 | BKK LOCAL',
    description: '曼谷人自己會去的地方：住在曼谷的人挑好的美食、咖啡廳、拜拜與一日路線',
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
      <body className="bg-paper min-h-screen">{children}<Analytics /><RegisterSW /></body>
    </html>
  )
}
