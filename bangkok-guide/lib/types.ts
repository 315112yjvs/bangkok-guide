export type Category = 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel'
export type Source = 'pantip' | 'wongnai' | 'googlemaps' | 'tiktok' | 'instagram' | 'manual'

export type Location = {
  id: string
  name_zh: string
  name_en: string
  name_th?: string       // Thai name for copy-to-taxi
  description_zh: string
  description_en: string
  category: Category
  address: string
  address_th?: string    // Thai address for copy-to-taxi
  lat: number
  lng: number
  photos: string[]
  source: Source
  source_url: string
  rating: number
  price_range: 1 | 2 | 3 | 4
  trending: boolean
  highlights?: string[]
  hashtags?: string[]    // Thai/EN trending hashtags
  local_ratio?: number   // 0–100 (% local customers)
  approved_at?: string
}

export type PendingLocation = Omit<Location, 'approved_at'> & {
  scraped_at: string
}
