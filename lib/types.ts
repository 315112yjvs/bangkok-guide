export type Category = 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel'
export type Source = 'pantip' | 'wongnai' | 'googlemaps' | 'tiktok' | 'instagram' | 'manual'

export type Location = {
  id: string
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  category: Category
  address: string
  lat: number
  lng: number
  photos: string[]
  source: Source
  source_url: string
  rating: number
  price_range: 1 | 2 | 3 | 4
  trending: boolean
  highlights?: string[]
  approved_at?: string
}

export type PendingLocation = Omit<Location, 'approved_at'> & {
  scraped_at: string
}
