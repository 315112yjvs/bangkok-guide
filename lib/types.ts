export type Category = 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel' | 'attraction'
export type Source = 'pantip' | 'wongnai' | 'googlemaps' | 'tiktok' | 'instagram' | 'media' | 'manual'
export type LocationTag = 'trending' | 'hidden_gem' | 'new_opening' | 'evergreen'

// 爬蟲「找熱點」留下的出處：哪個網址、標題、以及它怎麼說這家店
// facts：來源原文裡關於這家店的具體事實摘要（位置、招牌、特色），寫介紹時當依據
export type Evidence = { url: string; title: string; quote: string; facts?: string }

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
  photos: string[]           // 本機檔路徑（/photos/...）或 Google 照片 ref（places/...）
  photo_refs?: string[]      // 已改用本機檔的店：原本的 Google 照片 ref（日後重抓時用）
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
  mentions?: number          // 找熱點時被幾個不同來源提到（待審排序用）
  evidence?: Evidence[]      // 提到這家店的來源清單（待審時判斷為什麼紅）
  approved_at?: string
}

export type PendingLocation = Omit<Location, 'approved_at'> & {
  scraped_at: string
}
