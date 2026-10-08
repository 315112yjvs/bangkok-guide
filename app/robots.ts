import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.bkk-local.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /api/ 底下是照片代理：每被抓一張就向 Google 付一次照片費，不讓搜尋引擎和各種爬蟲去抓
      disallow: ['/admin', '/api/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
