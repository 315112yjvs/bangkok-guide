import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '曼谷人 | BKK LOCAL',
    short_name: '曼谷人',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 每日更新',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e1b4b',
    theme_color: '#1e1b4b',
    lang: 'zh-TW',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
