import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { readLocations, toCardLocation } from '@/lib/data'
import { haversineKm } from '@/lib/geo'
import { getOpeningHours } from '@/lib/placeInfo'
import { nearestStation } from '@/lib/transit'
import type { Location } from '@/lib/types'
import { LocationDetail } from './LocationDetail'
import { isHiddenCategory } from '@/lib/site'
import { safeJsonLd } from '@/lib/jsonLd'
import { CATEGORY_META } from '@/lib/collections'
import { getArea, extractArea } from '@/lib/area'
import { buildFaq, faqJsonLd } from '@/lib/faq'

export const revalidate = 3600

// 以 slug、舊 uuid 或舊 slug 找地點；byUuid=true 代表是舊網址、需轉到新 slug 網址
function resolveLocation(param: string, locations: Location[]) {
  const bySlug = locations.find((l) => l.slug === param)
  if (bySlug) return { loc: bySlug, byUuid: false }
  const byId = locations.find((l) => l.id === param || l.old_slugs?.includes(param))
  if (byId) return { loc: byId, byUuid: true }
  return { loc: null, byUuid: false }
}

// schema.org 類型對應
const SCHEMA_TYPE: Record<string, string> = {
  food: 'Restaurant',
  cafe: 'CafeOrCoffeeShop',
  nightlife: 'BarOrPub',
  hotel: 'Hotel',
  shopping: 'Store',
  attraction: 'TouristAttraction',
  temple: 'PlaceOfWorship',
}

function buildJsonLd(loc: Location) {
  // 圖片指向這家店的分享圖：照片代理已禁止爬蟲抓取（每抓一張都要付 Google 照片費）
  const photo = loc.photos[0] ? `https://www.bkk-local.com/location/${loc.slug ?? loc.id}/opengraph-image` : undefined
  // 注意：刻意不放 aggregateRating，因為缺少評論數量，放了會被 Google 判為無效結構化資料
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[loc.category] ?? 'LocalBusiness',
    name: loc.name_en,
    url: `https://www.bkk-local.com/location/${loc.slug ?? loc.id}`,
    description: loc.description_en || loc.description_zh || undefined,
    ...(photo ? { image: photo } : {}),
    ...(loc.price_range > 0 && loc.category !== 'temple' ? { priceRange: '฿'.repeat(loc.price_range) } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.address || undefined,
      addressLocality: loc.area && loc.area !== 'Bangkok' ? loc.area : 'Bangkok',
      addressCountry: 'TH',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: loc.lat,
      longitude: loc.lng,
    },
  }
  // 廟：中文為主（搜尋的人多半打中文），同時是參拜地點和觀光景點
  if (loc.category === 'temple') {
    const isWat = /^wat\b/i.test(loc.name_en)
    data['@type'] = [isWat ? 'BuddhistTemple' : 'PlaceOfWorship', 'TouristAttraction']
    data.name = loc.name_zh
    data.alternateName = [loc.name_en, loc.name_th].filter(Boolean)
    data.description = loc.description_zh || loc.description_en || undefined
    data.isAccessibleForFree = true
    data.inLanguage = 'zh-TW'
  }
  return data
}

// 麵包屑：首頁 › 分類 › 店名（Google 搜尋結果會顯示這條路徑）
function buildBreadcrumb(loc: Location) {
  const meta = CATEGORY_META[loc.category]
  const items = [
    { name: '曼谷人', item: 'https://www.bkk-local.com/' },
    ...(meta ? [{ name: meta.h1Zh, item: `https://www.bkk-local.com/category/${meta.slug}` }] : []),
    { name: loc.name_zh || loc.name_en, item: `https://www.bkk-local.com/location/${loc.slug ?? loc.id}` },
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })),
  }
}

const TYPE_ZH: Record<string, string> = {
  food: '美食',
  cafe: '咖啡廳',
  nightlife: '酒吧',
  hotel: '住宿',
  shopping: '購物',
  attraction: '景點',
  temple: '寺廟',
}

// 標題放店名、區域、類型（區域維持英文地名，例如 Thonglor 咖啡廳）。
// 區域優先用走得到的捷運站判斷（地址常只寫到大區，例如 Thonglor 的店地址寫 Khlong Toei）
function pageTitle(loc: Location) {
  const name = loc.name_zh || loc.name_en
  const station = nearestStation(loc.lat, loc.lng)
  const byStation = station ? extractArea(station.name) : 'Bangkok'
  const area = byStation !== 'Bangkok' ? byStation : getArea(loc)
  const kind = `${area === 'Bangkok' ? '曼谷' : `${area} `}${TYPE_ZH[loc.category] ?? ''}`
  return name.includes(kind) ? `${name} — 曼谷人` : `${name}｜${kind} — 曼谷人`
}

// 附近的其他地點：2 公里內由近到遠取 6 筆（用自家座標計算，不打任何 API）
function nearbyOf(loc: Location, all: Location[]) {
  return all
    .filter((l) => l.id !== loc.id)
    .map((l) => ({ location: toCardLocation(l), km: haversineKm(loc.lat, loc.lng, l.lat, l.lng) }))
    .filter((x) => x.km <= 2)
    .sort((a, b) => a.km - b.km)
    .slice(0, 6)
}

export async function generateStaticParams() {
  const locations = readLocations()
  return locations.map((l) => ({ id: l.slug ?? l.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const locations = readLocations()
  const { loc } = resolveLocation(id, locations)
  if (!loc) return {}

  const title = pageTitle(loc)
  const description = loc.description_zh || loc.description_en || ''

  // og:image / twitter:image 由 opengraph-image.tsx 自動產生（品牌化地點圖）
  return {
    title,
    description,
    alternates: { canonical: `/location/${loc.slug ?? loc.id}` },
    // 暫時隱藏的分類：頁面留著，但不給搜尋引擎收錄
    ...(isHiddenCategory(loc.category) ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locations = readLocations()
  const { loc: location, byUuid } = resolveLocation(id, locations)
  if (!location) notFound()
  // 舊的 uuid 網址 → 永久轉到新的英文店名網址（308，讓 Google 轉移權重）
  if (byUuid && location.slug) permanentRedirect(`/location/${location.slug}`)

  const hours = getOpeningHours(location.id)
  const station = nearestStation(location.lat, location.lng)
  const faq = buildFaq(location, hours, station)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(buildJsonLd(location)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(buildBreadcrumb(location)) }}
      />
      {faq.length >= 2 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd(faq)) }} />
      )}
      <LocationDetail
        location={location}
        nearby={nearbyOf(location, locations.filter((l) => !isHiddenCategory(l.category)))}
        hours={hours}
        station={station}
        faq={faq.length >= 2 ? faq : []}
      />
    </>
  )
}
