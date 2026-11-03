import type { MetadataRoute } from 'next'
import { readVisibleLocations } from '@/lib/data'
import { CATEGORY_SLUGS, listAreas } from '@/lib/collections'
import { THEMES } from '@/lib/themes'
import { TEMPLE_ROUTES } from '@/lib/templeRoutes'
import { tripEnabled } from '@/lib/site'

const BASE_URL = 'https://www.bkk-local.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const locations = readVisibleLocations()

  const locationUrls: MetadataRoute.Sitemap = locations.map((loc) => ({
    url: `${BASE_URL}/location/${loc.slug ?? loc.id}`,
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

  // 主題情境頁（IG 打卡、高空夜景…，高意圖、優先度高）
  const themeUrls: MetadataRoute.Sitemap = THEMES.map((t) => ({
    url: `${BASE_URL}/theme/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  }))

  // 拜拜路線、日記、客製行程
  const extraUrls: MetadataRoute.Sitemap = [
    ...TEMPLE_ROUTES.map((r) => ({ url: `${BASE_URL}/guide/${r.slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.9 })),
    { url: `${BASE_URL}/diary`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    ...(tripEnabled ? [{ url: `${BASE_URL}/trip`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 }] : []),
  ]

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...extraUrls,
    ...themeUrls,
    ...categoryUrls,
    ...areaUrls,
    ...locationUrls,
  ]
}
