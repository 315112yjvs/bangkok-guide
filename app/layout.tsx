import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '曼谷旅遊指南 | Bangkok Guide',
  description: '精選曼谷美食、咖啡廳、購物、夜生活、飯店推薦',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
