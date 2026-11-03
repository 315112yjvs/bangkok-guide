import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '曼谷人 | BKK LOCAL',
    short_name: '曼谷人',
    description: '曼谷人自己會去的地方：住在曼谷的人挑好的美食、咖啡廳、拜拜與一日路線',
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
