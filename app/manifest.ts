import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '曼谷人 | BKK LOCAL',
    short_name: '曼谷人',
    description: '住在曼谷的人告訴你最近在瘋什麼 — 在地私藏 × 美食咖啡廳 × 夜生活',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3d4aae',
    lang: 'zh-TW',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
