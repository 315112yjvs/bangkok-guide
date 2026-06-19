import { ImageResponse } from 'next/og'
import { readLocations } from '@/lib/data'
import type { Location, LocationTag } from '@/lib/types'

export const alt = '曼谷人 BKK LOCAL'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONT_URL = 'https://www.bkk-local.com/fonts/liufen.otf'

const TAG_META: Record<LocationTag, { zh: string; color: string }> = {
  trending:    { zh: '話題爆紅', color: '#f97316' },
  hidden_gem:  { zh: '在地私藏', color: '#059669' },
  new_opening: { zh: '新開幕',   color: '#8b5cf6' },
  evergreen:   { zh: '經典必訪', color: '#0ea5e9' },
}

const CAT_LABEL: Record<string, string> = {
  food: '餐廳', cafe: '咖啡廳', shopping: '購物',
  nightlife: '夜生活', hotel: '飯店', attraction: '景點',
}

function resolveTag(loc: Location): LocationTag {
  if (loc.tag) return loc.tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((loc as any).trending === true) return 'trending'
  return 'evergreen'
}

async function loadPhoto(loc: Location): Promise<string | null> {
  const first = loc.photos?.find(Boolean)
  if (!first) return null
  try {
    let url: string
    if (first.startsWith('places/')) {
      const key = process.env.GOOGLE_MAPS_API_KEY
      if (!key) return null
      url = `https://places.googleapis.com/v1/${first}/media?maxWidthPx=1200&key=${key}`
    } else {
      url = first
    }
    const res = await fetch(url, { headers: { Referer: 'https://www.bkk-local.com/' } })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const locations = readLocations()
  const loc = locations.find((l) => l.slug === id) ?? locations.find((l) => l.id === id)

  const [liufen, photo] = await Promise.all([
    fetch(FONT_URL).then((r) => r.arrayBuffer()),
    loc ? loadPhoto(loc) : Promise.resolve(null),
  ])

  const name = loc?.name_zh || loc?.name_en || '曼谷人'
  const rating = loc?.rating
  const tag = loc ? TAG_META[resolveTag(loc)] : null
  const catLabel = loc ? CAT_LABEL[loc.category] ?? '' : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'LiuFen',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)',
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={1200}
            height={630}
            style={{ position: 'absolute', inset: 0, width: 1200, height: 630, objectFit: 'cover' }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.45) 100%)',
          }}
        />

        {tag && (
          <div
            style={{
              position: 'absolute',
              top: 48,
              left: 56,
              display: 'flex',
              background: tag.color,
              color: 'white',
              fontSize: 30,
              padding: '8px 24px',
              borderRadius: 999,
            }}
          >
            {tag.zh}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 48,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', color: 'white', fontSize: 76, lineHeight: 1.1, marginBottom: 16 }}>
            {name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 26 }}>
            {rating ? (
              <div style={{ display: 'flex', color: '#fbbf24', fontSize: 40 }}>★ {rating.toFixed(1)}</div>
            ) : null}
            {catLabel ? (
              <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 36 }}>{catLabel}</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', color: 'white', fontSize: 34 }}>曼谷人</div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: 26, letterSpacing: 7 }}>
              BKK LOCAL
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'LiuFen', data: liufen, style: 'normal', weight: 400 }],
    }
  )
}
