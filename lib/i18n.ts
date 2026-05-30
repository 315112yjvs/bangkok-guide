export type Lang = 'zh' | 'en'

export const strings = {
  zh: {
    siteName: '曼谷旅遊指南',
    heroTitle: '探索曼谷',
    heroTitleAccent: '最值得去的地方',
    heroSubtitle: '精選在地美食、咖啡廳、購物、夜生活、飯店',
    searchPlaceholder: '搜尋餐廳、咖啡廳...',
    categoryAll: '全部',
    categoryFood: '美食',
    categoryCafe: '咖啡廳',
    categoryShopping: '購物',
    categoryNightlife: '夜生活',
    categoryHotel: '飯店',
    trending: '熱門',
    seeAll: '查看全部',
    trendingSection: '近期熱門',
    openMaps: '在 Google Maps 開啟',
    navigate: '導航',
    sourceTikTok: 'TikTok 熱傳',
    sourceIG: 'IG 爆紅',
    sourcePantip: 'Pantip 推薦',
    sourceWongnai: 'Wongnai 精選',
    sourceGoogleMaps: 'Google Maps',
    sourceManual: '編輯精選',
    expandMap: '展開地圖',
    priceRange: ['', '$', '$$', '$$$', '$$$$'],
  },
  en: {
    siteName: 'Bangkok Guide',
    heroTitle: 'Discover',
    heroTitleAccent: 'The Best of Bangkok',
    heroSubtitle: 'Curated food, cafes, shopping, nightlife & hotels',
    searchPlaceholder: 'Search restaurants, cafes...',
    categoryAll: 'All',
    categoryFood: 'Food',
    categoryCafe: 'Cafe',
    categoryShopping: 'Shopping',
    categoryNightlife: 'Nightlife',
    categoryHotel: 'Hotels',
    trending: 'Trending',
    seeAll: 'See all',
    trendingSection: 'Trending Now',
    openMaps: 'Open in Google Maps',
    navigate: 'Navigate',
    sourceTikTok: 'TikTok Viral',
    sourceIG: 'IG Trending',
    sourcePantip: 'Pantip Pick',
    sourceWongnai: 'Wongnai Top',
    sourceGoogleMaps: 'Google Maps',
    sourceManual: "Editor's Pick",
    expandMap: 'Expand Map',
    priceRange: ['', '$', '$$', '$$$', '$$$$'],
  },
} satisfies Record<Lang, Record<string, string | string[]>>

export function t(lang: Lang, key: keyof typeof strings.zh, index?: number): string {
  const val = strings[lang][key]
  if (Array.isArray(val)) return index !== undefined ? (val[index] ?? '') : val.join('')
  return val
}
