import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const alt = '曼谷人 BKK LOCAL — 住在曼谷的人推薦在地私藏'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const openhuninn = readFileSync(join(process.cwd(), 'public/fonts/og-openhuninn.woff'))
  const logoBuf = readFileSync(join(process.cwd(), 'public/icon-512.png'))
  const logo = `data:image/png;base64,${logoBuf.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
          fontFamily: 'OpenHuninn',
          background: '#ffffff',
          position: 'relative',
        }}
      >
        {/* top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            background: 'linear-gradient(90deg, #1e1b4b 0%, #1e1b4b 55%, #f97316 100%)',
          }}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={420} height={420} style={{ width: 420, height: 420 }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: '#1e1b4b', fontSize: 132, lineHeight: 1 }}>曼谷人</div>
          <div
            style={{
              display: 'flex',
              color: '#f97316',
              fontSize: 56,
              letterSpacing: 18,
              marginTop: 10,
              marginBottom: 28,
            }}
          >
            BKK LOCAL
          </div>
          <div style={{ display: 'flex', width: 92, height: 6, background: '#f97316', borderRadius: 999, marginBottom: 28 }} />
          <div style={{ display: 'flex', color: '#1e1b4b', fontSize: 38, lineHeight: 1.35 }}>
            住在曼谷的人
          </div>
          <div style={{ display: 'flex', color: '#1e1b4b', fontSize: 38, lineHeight: 1.35 }}>
            告訴你最近在瘋什麼
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'OpenHuninn', data: openhuninn, style: 'normal', weight: 400 }],
    }
  )
}
