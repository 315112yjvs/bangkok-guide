import { NextRequest, NextResponse } from 'next/server'
import { enrichItem } from '@/scrapers/enricher'
import type { Category } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function extractCoords(url: string): { lat: number; lng: number } | null {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

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

  const coords = mapsUrl ? extractCoords(mapsUrl) : null
  const cat: Category = category ?? 'food'

  const enriched = await enrichItem(name.trim(), cat, coords?.lat, coords?.lng)
  if (!enriched) return NextResponse.json({ error: 'place not found' }, { status: 404 })

  const name_zh = enriched.name_en  // keep original name

  const detectedCat: Category =
    TYPE_TO_CATEGORY[enriched.category] ?? cat

  return NextResponse.json({ ...enriched, name_zh, category: detectedCat })
}
