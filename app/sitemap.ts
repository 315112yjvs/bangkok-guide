import type { MetadataRoute } from 'next'
import { readLocations } from '@/lib/data'

const BASE_URL = 'https://www.bkk-local.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const locations = readLocations()

  const locationUrls: MetadataRoute.Sitemap = locations.map((loc) => ({
    url: `${BASE_URL}/location/${loc.id}`,
    lastModified: loc.approved_at ? new Date(loc.approved_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...locationUrls,
  ]
}
