const GARBAGE_PATTERNS = [
  /^(the |a |an )?(food|place|spot|experience|restaurant|cafe|bar|vibe|ambiance|atmosphere|service|staff|everything|nothing|meal|dishes?|menu|price|value|quality|things?)$/i,
  /^(this|that|here|very|so|just|definitely|really|absolutely|must|highly|great|good|nice|amazing|excellent|wonderful|perfect|awesome|best|top|my|our|their|we|you|i|they)(\s.*)?$/i,
  /bangkok|thailand|city|town|area|district|street|road|bts|mrt|sky/i,
  /^(some |the )?\w{1,3}$/,
  /will be back|come back|back again|next time|go back|be back/i,
  /^(meal we|day trip|night out|date night|girls trip|solo|family|group|friends)/i,
  /per person|per head|baht|thb|usd|\$\d/i,
  /a lot for|lot of|worth (the|it|every)/i,
  /^(and |but |so |also |even )/i,
]

export function cleanHighlights(highlights: string[] | undefined): string[] {
  return (highlights ?? []).filter(
    h => !GARBAGE_PATTERNS.some(p => p.test(h.trim())) && h.length >= 3 && h.length <= 35
  )
}

type DescInput = { category: string; rating?: number; price_range?: number; source?: string; local_ratio?: number; trending?: boolean; name_en?: string }

export function buildDescZh(loc: DescInput, highlights: string[], editorial?: string | null): string {
  if (editorial) return editorial.length > 80 ? editorial.slice(0, 78) + '…' : editorial

  const { category: cat, rating = 4.5, price_range: price = 2, source, local_ratio: local = 0, trending } = loc

  const good = rating >= 4.8 ? '評分極高' : rating >= 4.5 ? '口碑極佳' : '深受好評'
  const priceDesc = ({ 1: '親民價格', 2: '中等消費', 3: '高檔', 4: '精緻奢華' } as Record<number, string>)[price] ?? '中等消費'
  const localSuffix = local >= 70 ? '，在地人最愛' : local >= 50 ? '，本地人常光顧' : ''
  const prefix = trending ? '曼谷社群熱傳' : source === 'tiktok' ? 'TikTok 瘋傳' : source === 'instagram' ? 'IG 爆紅' : ''
  const p = prefix ? `${prefix}，` : ''

  if (cat === 'food') {
    if (highlights.length >= 2) return `${p}以${highlights[0]}和${highlights[1]}聞名的曼谷美食，${good}${localSuffix}。`
    if (highlights.length === 1) return `${p}招牌${highlights[0]}必試，${priceDesc}曼谷餐廳，${good}${localSuffix}。`
    return `${p}${priceDesc}、${good}的曼谷餐廳${localSuffix}，食客好評不斷。`
  }

  if (cat === 'cafe') {
    const coffeeHl = highlights.find(h => ['Pour Over', 'Espresso', 'Cold Brew', 'Thai Tea', 'Croissant'].includes(h))
    if (coffeeHl) return `${p}${coffeeHl}是招牌，${priceDesc}的精品咖啡廳，${good}${localSuffix}。`
    if (highlights.length > 0) return `以${highlights[0]}聞名的曼谷咖啡廳，${good}${localSuffix}。`
    return `${p}${priceDesc}的精品咖啡廳，拍照打卡首選，${good}${localSuffix}。`
  }

  if (cat === 'nightlife') {
    if (highlights.includes('Rooftop View') || highlights.includes('City View'))
      return `曼谷必去高空景觀酒吧，俯瞰全城夜景，${good}${localSuffix}。`
    if (highlights.includes('Live Music')) return `${p}現場音樂每晚演出，${good}曼谷酒吧${localSuffix}。`
    if (highlights.includes('Cocktails') || highlights.includes('Craft Beer'))
      return `${p}創意調酒聞名曼谷，${good}${localSuffix}。`
    return `${p}${priceDesc}曼谷夜生活，${good}${localSuffix}，夜遊必去。`
  }

  if (cat === 'shopping') {
    const name = (loc.name_en ?? '').toLowerCase()
    if (name.includes('market') || name.includes('bazaar')) return `${p}曼谷${priceDesc}夜市，逛街淘貨首選${localSuffix}。`
    if (name.includes('mall') || name.includes('plaza')) return `曼谷${priceDesc}購物中心，品牌齊全，${good}${localSuffix}。`
    return `${p}曼谷${priceDesc}購物景點，${good}${localSuffix}。`
  }

  if (cat === 'hotel') return `${p}${priceDesc}曼谷住宿，${good}${localSuffix}，地理位置優越。`

  return `${p}${priceDesc}曼谷地點，${good}${localSuffix}。`
}

export function buildDescEn(loc: DescInput, highlights: string[], editorial?: string | null): string {
  if (editorial) return editorial

  const { category: cat, rating = 4.5, price_range: price = 2, local_ratio: local = 0, trending } = loc
  const ratingDesc = rating >= 4.8 ? 'top-rated' : rating >= 4.5 ? 'highly praised' : 'well-regarded'
  const priceDesc = ({ 1: 'budget-friendly', 2: 'mid-range', 3: 'upscale', 4: 'fine dining' } as Record<number, string>)[price] ?? 'mid-range'
  const localNote = local >= 70 ? ' A local favourite.' : local >= 50 ? ' Popular with locals.' : ''
  const trendingNote = trending ? ' Trending on Thai social media.' : ''
  const hlText = highlights.length > 0 ? ` Known for ${highlights.slice(0, 2).join(' and ')}.` : ''

  const catDesc = ({
    food: `${ratingDesc} restaurant in Bangkok`,
    cafe: `${ratingDesc} specialty café in Bangkok`,
    shopping: `popular shopping destination in Bangkok`,
    nightlife: `${ratingDesc} bar in Bangkok`,
    hotel: `${ratingDesc} hotel in Bangkok`,
  } as Record<string, string>)[cat] ?? `${ratingDesc} spot in Bangkok`

  return `A ${priceDesc}, ${catDesc}.${hlText}${localNote}${trendingNote}`
}
