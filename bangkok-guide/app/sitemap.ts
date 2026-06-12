import type { MetadataRoute } from 'next'
import { readLocations } from '@/lib/data'
import { CATEGORY_SLUGS, listAreas } from '@/lib/collections'

const BASE_URL = 'https://www.bkk-local.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const locations = readLocations()

  const locationUrls: MetadataRoute.Sitemap = locations.map((loc) => ({
    url: `${BASE_URL}/location/${loc.id}`,
    lastModified: loc.approved_at ? new Date(loc.approved_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // 分類清單頁（高意圖關鍵字，優先度高）
  const categoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((slug) => ({
    url: `${BASE_URL}/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  }))

  // 區域清單頁
  const areaUrls: MetadataRoute.Sitemap = listAreas(locations).map((a) => ({
    url: `${BASE_URL}/area/${a.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...categoryUrls,
    ...areaUrls,
    ...locationUrls,
  ]
}
