import { ImageResponse } from 'next/og'

export const alt = '曼谷人 BKK LOCAL — 住在曼谷的人告訴你最近在瘋什麼'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONT_URL = 'https://www.bkk-local.com/fonts/liufen.otf'

export default async function Image() {
  const liufen = await fetch(FONT_URL).then((r) => r.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #2d2a6e 55%, #4c1d95 100%)',
          fontFamily: 'LiuFen',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f97316',
              color: 'white',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 4,
              padding: '6px 18px',
              borderRadius: 999,
            }}
          >
            ● LIVE
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 24 }}>
            每日更新 · 泰國社群精選
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'white', fontSize: 96, lineHeight: 1.1 }}>
            住在曼谷的人
          </div>
          <div style={{ color: '#fbbf24', fontSize: 96, lineHeight: 1.1 }}>
            告訴你最近在瘋什麼
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 40,
          }}
        >
          <div style={{ color: 'white', fontSize: 40 }}>曼谷人</div>
          <div
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 30,
              letterSpacing: 8,
            }}
          >
            BKK LOCAL
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
