import type { Location } from './types'
import { getArea } from './area'

// 分類清單頁的 SEO 中繼資料（針對中文高意圖搜尋字詞優化）
export type CollectionMeta = {
  slug: string
  emoji: string
  h1Zh: string
  h1En: string
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
}

export const CATEGORY_META: Record<string, CollectionMeta> = {
  cafe: {
    slug: 'cafe', emoji: '☕',
    h1Zh: '曼谷咖啡廳推薦', h1En: 'Best Cafes in Bangkok',
    titleZh: '曼谷咖啡廳推薦 ☕ 在地人精選每日更新', titleEn: 'Best Cafes in Bangkok',
    descZh: '住在曼谷的人精選的咖啡廳，從 specialty 烘豆、隱藏巷弄咖啡到網美打卡店，每日更新。',
    descEn: 'Hand-picked Bangkok cafes by locals, from specialty roasters to hidden-soi gems.',
  },
  food: {
    slug: 'food', emoji: '🍜',
    h1Zh: '曼谷美食餐廳推薦', h1En: 'Best Restaurants in Bangkok',
    titleZh: '曼谷美食推薦 🍜 在地餐廳精選每日更新', titleEn: 'Best Restaurants in Bangkok',
    descZh: '住在曼谷的人精選的餐廳，泰式、異國料理到在地小館，幫你避開地雷踩到真正好吃的。',
    descEn: 'Hand-picked Bangkok restaurants by locals, from Thai classics to hidden eats.',
  },
  nightlife: {
    slug: 'nightlife', emoji: '🍸',
    h1Zh: '曼谷酒吧 & 夜生活推薦', h1En: 'Bangkok Bars & Nightlife',
    titleZh: '曼谷酒吧夜生活推薦 🍸 在地人精選', titleEn: 'Bangkok Bars & Nightlife',
    descZh: '住在曼谷的人精選的酒吧、調酒吧與屋頂酒吧，從隱藏 speakeasy 到熱門夜店。',
    descEn: 'Hand-picked Bangkok bars, cocktail dens and rooftops by locals.',
  },
  shopping: {
    slug: 'shopping', emoji: '🛍️',
    h1Zh: '曼谷購物推薦', h1En: 'Bangkok Shopping',
    titleZh: '曼谷購物推薦 🛍️ 市集商場在地精選', titleEn: 'Bangkok Shopping',
    descZh: '住在曼谷的人精選的購物去處，從文青選物、市集到特色商場。',
    descEn: 'Hand-picked Bangkok shopping spots by locals, from markets to concept stores.',
  },
  hotel: {
    slug: 'hotel', emoji: '🏨',
    h1Zh: '曼谷飯店住宿推薦', h1En: 'Bangkok Hotels',
    titleZh: '曼谷飯店住宿推薦 🏨 在地精選', titleEn: 'Bangkok Hotels',
    descZh: '住在曼谷的人精選的飯店與住宿，從設計旅店到高 CP 值選擇。',
    descEn: 'Hand-picked Bangkok hotels and stays by locals.',
  },
  attraction: {
    slug: 'attraction', emoji: '🗺️',
    h1Zh: '曼谷景點推薦', h1En: 'Bangkok Attractions',
    titleZh: '曼谷景點推薦 🗺️ 在地人帶你玩', titleEn: 'Bangkok Attractions',
    descZh: '住在曼谷的人精選的景點與打卡地點，避開觀光客陷阱玩到真正有趣的。',
    descEn: 'Hand-picked Bangkok attractions and photo spots by locals.',
  },
}

export const CATEGORY_SLUGS = Object.keys(CATEGORY_META)

export function areaToSlug(area: string): string {
  return area.toLowerCase().replace(/\s+/g, '-')
}

export function slugToArea(slug: string, locations: Location[]): string | null {
  const target = slug.toLowerCase()
  for (const loc of locations) {
    const a = getArea(loc)
    if (a !== 'Bangkok' && areaToSlug(a) === target) return a
  }
  return null
}

// 取得所有有地點的區域（依數量排序，從地址即時推導）
export function listAreas(locations: Location[]): { area: string; slug: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const loc of locations) {
    const a = getArea(loc)
    if (a !== 'Bangkok') counts.set(a, (counts.get(a) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => ({ area, slug: areaToSlug(area), count }))
}
