import { NextRequest, NextResponse } from 'next/server'
import { enrichItem } from '@/scrapers/enricher'
import type { Category } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function extractCoords(url: string): { lat: number; lng: number } | null {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

// maps.app.goo.gl 短網址本身沒有座標，跟著轉址拿到完整的 Google 地圖網址
async function expandShortUrl(url: string): Promise<string> {
  if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(url)) return url
  try {
    let current = url
    for (let i = 0; i < 4; i++) {
      const res = await fetch(current, { redirect: 'manual' })
      const next = res.headers.get('location')
      if (!next) break
      current = new URL(next, current).toString()
      if (current.includes('google.com/maps')) break
    }
    return current
  } catch {
    return url
  }
}

const CATEGORIES: Category[] = ['food', 'cafe', 'shopping', 'nightlife', 'hotel', 'attraction', 'temple']

const TYPE_TO_CATEGORY: Record<string, Category> = {
  restaurant: 'food', food: 'food', bakery: 'food', fast_food: 'food',
  cafe: 'cafe', coffee_shop: 'cafe', tea_house: 'cafe',
  bar: 'nightlife', night_club: 'nightlife', pub: 'nightlife',
  lodging: 'hotel', hotel: 'hotel', resort: 'hotel',
  shopping_mall: 'shopping', market: 'shopping', store: 'shopping',
  tourist_attraction: 'attraction', museum: 'attraction', park: 'attraction',
}

export async function POST(req: NextRequest) {
  const { name, mapsUrl, category } = await req.json() as { name: string; mapsUrl?: string; category?: Category }
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const coords = mapsUrl ? extractCoords(await expandShortUrl(mapsUrl.trim())) : null
  const cat: Category = category ?? 'food'

  // 手動新增是站主自己要加的：寺廟、景點也要能匯入（爬蟲才需要濾掉非店家）
  const enriched = await enrichItem(name.trim(), cat, coords?.lat, coords?.lng, { allowLandmarks: true })
  if (!enriched) return NextResponse.json({ error: 'place not found' }, { status: 404 })

  const name_zh = enriched.name_en  // keep original name

  // enrichItem 回傳的已經是網站分類（food/cafe/temple…）
  const detectedCat: Category =
    CATEGORIES.includes(enriched.category as Category) ? enriched.category as Category : TYPE_TO_CATEGORY[enriched.category] ?? cat

  return NextResponse.json({ ...enriched, name_zh, category: detectedCat })
}
