import type { Location, LocationTag } from './types'

function resolveTag(loc: Location): LocationTag {
  if (loc.tag) return loc.tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((loc as any).trending === true) return 'trending'
  return 'evergreen'
}

function text(loc: Location): string {
  return [
    loc.description_zh ?? '',
    loc.description_en ?? '',
    ...(loc.highlights ?? []),
  ].join(' ').toLowerCase()
}

export type Theme = {
  slug: string
  icon: string
  emoji: string
  h1Zh: string
  h1En: string
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
  match: (loc: Location) => boolean
}

export const THEMES: Theme[] = [
  {
    slug: 'ig',
    icon: 'photo_camera',
    emoji: '📸',
    h1Zh: '曼谷 IG 打卡景點',
    h1En: 'Bangkok IG Photo Spots',
    titleZh: '曼谷 IG 打卡景點推薦 📸 網美咖啡廳 & 拍照地點',
    titleEn: 'Bangkok IG Photo Spots — Instagrammable Cafes & Places',
    descZh: '住在曼谷的人精選最好拍、最出片的網美咖啡廳與打卡地點，幫你曼谷行拍出整片 IG 限動。',
    descEn: 'The most Instagrammable cafes and photo spots in Bangkok, picked by locals.',
    match: (l) => /打卡|網美|出片|美拍|拍照|instagram|\big\b|夢幻|玻璃屋|花牆|彩虹|粉紅|少女|夕陽|海景|空間感|裝潢|aesthetic|photogenic|instagrammable|design/.test(text(l)),
  },
  {
    slug: 'rooftop',
    icon: 'nightlife',
    emoji: '🌆',
    h1Zh: '曼谷高空酒吧 & 夜景',
    h1En: 'Bangkok Rooftop Bars & Night Views',
    titleZh: '曼谷高空酒吧推薦 🌆 屋頂夜景 & Rooftop Bar',
    titleEn: 'Bangkok Rooftop Bars & Night View Spots',
    descZh: '住在曼谷的人精選的高空酒吧與夜景地點，把曼谷夜晚的天際線一次看遍。',
    descEn: 'Hand-picked Bangkok rooftop bars and skyline night-view spots by locals.',
    match: (l) => /rooftop|高空|頂樓|屋頂|夜景|skyline|view|景觀|city view|panoram/.test(text(l)),
  },
  {
    slug: 'brunch',
    icon: 'brunch_dining',
    emoji: '🥐',
    h1Zh: '曼谷早午餐',
    h1En: 'Bangkok Brunch',
    titleZh: '曼谷早午餐推薦 🥐 在地人精選 Brunch 咖啡廳',
    titleEn: 'Best Brunch Spots in Bangkok',
    descZh: '住在曼谷的人精選的早午餐去處，悠閒的週末從一頓好 brunch 開始。',
    descEn: 'Hand-picked Bangkok brunch spots by locals — start your weekend right.',
    match: (l) => /brunch|早午餐|pancake|可頌|croissant|egg benedict|french toast/.test(text(l)),
  },
  {
    slug: 'hidden',
    icon: 'explore',
    emoji: '🗺️',
    h1Zh: '曼谷在地私藏',
    h1En: "Bangkok Hidden Gems",
    titleZh: '曼谷隱藏版私房景點 🗺️ 在地人才知道的地方',
    titleEn: 'Bangkok Hidden Gems Only Locals Know',
    descZh: '不在觀光客名單上、住在曼谷的人才知道的私房咖啡廳、餐廳與景點。',
    descEn: 'Off-the-tourist-trail cafes, eats and spots only Bangkok locals know.',
    match: (l) => resolveTag(l) === 'hidden_gem',
  },
  {
    slug: 'new',
    icon: 'auto_awesome',
    emoji: '✨',
    h1Zh: '曼谷本週新熱點',
    h1En: "Bangkok's Newest Hotspots",
    titleZh: '曼谷新開幕 & 本週爆紅 ✨ 搶先體驗',
    titleEn: "Bangkok's Newest & Trending Spots",
    descZh: '曼谷最新開幕與本週社群爆紅的地點，搶在人潮之前先去。',
    descEn: "Bangkok's newest openings and this week's viral spots — beat the crowd.",
    match: (l) => resolveTag(l) === 'new_opening' || resolveTag(l) === 'trending',
  },
]

export function getTheme(slug: string): Theme | undefined {
  return THEMES.find((t) => t.slug === slug)
}
