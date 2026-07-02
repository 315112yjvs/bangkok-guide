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
      if (res.ok) return imageResponse(res)
      // 403/404：照片 ref 過期（Google 會定期換掉 ref）→ 用 ref 內含的 place id
      // 換一個現行 ref 再抓一次，成功的話 CDN 照樣以原網址快取，前端不用改
      if (res.status === 403 || res.status === 404) {
        const healed = await fetchWithFreshRef(ref, w, key)
        if (healed) return imageResponse(healed)
        return new NextResponse('upstream error', { status: res.status })
      }
      // 其他 4xx 不重試，直接回錯誤；5xx 才再試一次
      if (res.status < 500) return new NextResponse('upstream error', { status: res.status })
    } catch {
      // 逾時/網路錯誤 → 進入下一輪重試
    }
  }
  return new NextResponse('fetch failed', { status: 502 })
}

async function imageResponse(res: Response) {
  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      // 瀏覽器 + Vercel CDN 都長快取；照片內容不變所以 immutable
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  })
}

// ref 格式 places/{placeId}/photos/{photoId}：跟 Place Details 要現行照片清單，
// 抓第一張頂替過期的 ref（總比破圖換預設圖好）
async function fetchWithFreshRef(staleRef: string, w: number, key: string): Promise<Response | null> {
  try {
    const placeId = staleRef.split('/')[1]
    const detail = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'photos',
        'Referer': 'https://www.bkk-local.com/',
      },
    })
    if (!detail.ok) return null
    const data = await detail.json()
    const fresh: string | undefined = data.photos?.[0]?.name
    if (!fresh || fresh === staleRef) return null
    const res = await fetch(`https://places.googleapis.com/v1/${fresh}/media?maxWidthPx=${w}&key=${key}`, {
      headers: { Referer: 'https://www.bkk-local.com/' },
    })
    return res.ok ? res : null
  } catch {
    return null
  }
}
