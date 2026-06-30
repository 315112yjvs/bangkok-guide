import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const alt = '曼谷人 BKK LOCAL — 住在曼谷的人推薦在地私藏'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logoBuf = readFileSync(join(process.cwd(), 'public/logo-full.png'))
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
          background: '#ffffff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={600} height={600} style={{ width: 600, height: 600 }} />
      </div>
    ),
    { ...size }
  )
}
