import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { readLocations, writeLocations } from '@/lib/data'
import { extractPlaceId } from '@/lib/maps'
import type { Location } from '@/lib/types'

export const runtime = 'nodejs'

const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos'

async function search(query: string, lang: 'en' | 'th') {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY ?? '',
      'X-Goog-FieldMask': FIELDS,
      'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.bkk-local.com/',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
      regionCode: 'TH',
      languageCode: lang,
      // 只收大曼谷範圍
      locationRestriction: { rectangle: { low: { latitude: 13.45, longitude: 100.25 }, high: { latitude: 14.05, longitude: 100.95 } } },
    }),
  })
  if (!res.ok) return null
  return (await res.json()).places?.[0] ?? null
}

// 新增一間廟：用名稱在 Google 找位置、照片、泰文名，參拜內容之後在後台填
export async function POST(req: NextRequest) {
  const { query, name_zh } = await req.json() as { query: string; name_zh?: string }
  if (!query?.trim()) return NextResponse.json({ error: '請輸入廟名' }, { status: 400 })

  const en = await search(query.trim(), 'en')
  if (!en) return NextResponse.json({ error: 'Google 找不到這間廟，換個寫法試試（英文或泰文名）' }, { status: 404 })
  const locations = readLocations()
  if (locations.some((l) => extractPlaceId(l.source_url) === en.id)) {
    return NextResponse.json({ error: `已經有這間了：${en.displayName?.text}` }, { status: 409 })
  }
  const th = await search(query.trim(), 'th')
  const sameTh = th?.id === en.id
  const address = en.formattedAddress ?? 'Bangkok, Thailand'
  const nameEn = en.displayName?.text ?? query.trim()

  const loc: Location = {
    id: randomUUID(),
    name_zh: name_zh?.trim() || nameEn,
    name_en: nameEn,
    ...(sameTh ? { name_th: th.displayName?.text, address_th: th.formattedAddress } : {}),
    description_zh: '',
    description_en: '',
    category: 'temple',
    address,
    lat: en.location.latitude,
    lng: en.location.longitude,
    photos: (en.photos ?? []).slice(0, 6).map((p: { name: string }) => p.name),
    source: 'manual',
    source_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nameEn} ${address}`)}&query_place_id=${en.id}`,
    rating: en.rating ?? 0,
    price_range: 1,
    tag: 'evergreen',
    temple: { deity_zh: '', wishes_zh: [], steps_zh: [], offerings_zh: [] },
    approved_at: new Date().toISOString(),
  }
  writeLocations([...locations, loc])
  return NextResponse.json({ ok: true, location: loc })
}
