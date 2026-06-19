export type Category = 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel' | 'attraction'
export type Source = 'pantip' | 'wongnai' | 'googlemaps' | 'tiktok' | 'instagram' | 'manual'
export type LocationTag = 'trending' | 'hidden_gem' | 'new_opening' | 'evergreen'

export type Location = {
  id: string
  slug?: string          // 網址用的英文店名 slug（由 name_en 產生，readLocations 自動補上）
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
  tag?: LocationTag      // editorial classification
  area?: string          // Bangkok neighbourhood, e.g. "Thonglor", "Silom"
  highlights?: string[]
  hashtags?: string[]    // Thai/EN trending hashtags
  local_ratio?: number   // 0–100 (% local customers)
  curator_note?: string      // short personal observation from the site owner
  social_embed_url?: string  // TikTok or Instagram post URL to embed
  approved_at?: string
}

export type PendingLocation = Omit<Location, 'approved_at'> & {
  scraped_at: string
}
