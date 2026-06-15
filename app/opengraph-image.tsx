import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const alt = '曼谷人 BKK LOCAL — 住在曼谷的人推薦在地私藏'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const liufen = readFileSync(join(process.cwd(), 'public/fonts/liufen.otf'))
  const heroBuf = readFileSync(join(process.cwd(), 'public/hero-bangkok.jpg'))
  const hero = `data:image/jpeg;base64,${heroBuf.toString('base64')}`

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0, width: 1200, height: 630, objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.5) 100%)',
          }}
        />

        {/* LIVE badge */}
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#f97316',
            color: 'white',
            fontSize: 28,
            padding: '8px 26px',
            borderRadius: 999,
            letterSpacing: 4,
          }}
        >
          ● LIVE · 每日更新
        </div>

        {/* Bottom editorial block */}
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 52,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', color: 'white', fontSize: 104, lineHeight: 1.05, marginBottom: 8 }}>
            曼谷人
          </div>
          <div style={{ display: 'flex', color: '#fbbf24', fontSize: 44, letterSpacing: 14, marginBottom: 22 }}>
            BKK LOCAL
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.92)', fontSize: 36, lineHeight: 1.3 }}>
            住在曼谷的人告訴你最近在瘋什麼
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.7)', fontSize: 28, marginTop: 8 }}>
            在地私藏 × 美食咖啡廳 × TikTok 爆紅地點
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
