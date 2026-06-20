import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
// 代理 Google Places 照片：server 端用 server key 抓一次，加長快取走 CDN，
// 之後同一張圖全部命中快取、不再打 Google（大幅降低 Place Photo 用量），
// 且 API key 不再外露在前端網頁。
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref') ?? ''
  const w = Math.min(Math.max(Number(req.nextUrl.searchParams.get('w')) || 800, 100), 1600)

  // 只允許 Google Places 照片 ref，避免被當成任意網址代理（SSRF）
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(ref)) {
    return new NextResponse('bad ref', { status: 400 })
  }

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return new NextResponse('no key', { status: 500 })

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&key=${key}`,
      { headers: { Referer: 'https://www.bkk-local.com/' } }
    )
    if (!res.ok) return new NextResponse('upstream error', { status: res.status })
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        // 瀏覽器 + Vercel CDN 都長快取；照片內容不變所以 immutable
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('fetch failed', { status: 502 })
  }
}
