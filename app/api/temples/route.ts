import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { transact, isOnline } from '@/lib/store'
import { txLocations, txWriteLocations } from '@/lib/data'
import { txLocalizePhotos } from '@/lib/googlePhotos'
import { extractPlaceId } from '@/lib/maps'
import type { Location } from '@/lib/types'
import { withErrors } from '@/lib/apiError'

export const runtime = 'nodejs'
export const maxDuration = 60

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
async function handlePOST(req: NextRequest) {
  const { query, name_zh } = await req.json() as { query: string; name_zh?: string }
  if (!query?.trim()) return NextResponse.json({ error: '請輸入廟名' }, { status: 400 })

  const en = await search(query.trim(), 'en')
  if (!en) return NextResponse.json({ error: 'Google 找不到這間廟，換個寫法試試（英文或泰文名）' }, { status: 404 })
  const existing = await transact('read', txLocations)
  if (existing.some((l) => extractPlaceId(l.source_url) === en.id)) {
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
  // 正式站沒有 Python，新增當下就把照片存成網站自己的檔案
  const saved = await transact(`新增廟 ${loc.name_zh}`, async (tx) => {
    const withPhotos = isOnline ? await txLocalizePhotos(tx, loc) : loc
    txWriteLocations(tx, [...await txLocations(tx), withPhotos])
    return withPhotos
  })
  return NextResponse.json({ ok: true, location: saved })
}

export const POST = withErrors(handlePOST)
