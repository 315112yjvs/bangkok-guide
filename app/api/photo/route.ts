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

  const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&key=${key}`

  // 抓 Google 照片，加 10 秒逾時；遇到逾時或 5xx 暫時性錯誤再重試一次
  // （冷啟動/暫時性失敗常一試就過，可減少卡片掉成預設圖）
  async function fetchOnce() {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    try {
      return await fetch(url, { headers: { Referer: 'https://www.bkk-local.com/' }, signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchOnce()
      if (res.ok) {
        const buf = await res.arrayBuffer()
        return new NextResponse(buf, {
          headers: {
            'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
            // 瀏覽器 + Vercel CDN 都長快取；照片內容不變所以 immutable
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        })
      }
      // 4xx（ref 失效等）不重試，直接回錯誤；5xx 才再試一次
      if (res.status < 500) return new NextResponse('upstream error', { status: res.status })
    } catch {
      // 逾時/網路錯誤 → 進入下一輪重試
    }
  }
  return new NextResponse('fetch failed', { status: 502 })
}
