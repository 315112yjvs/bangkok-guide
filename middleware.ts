import { NextRequest, NextResponse } from 'next/server'

// 不需登入即可呼叫的 API：
//  - /api/admin/auth：登入端點本身
//  - /api/photo：公開詳情頁/卡片的照片代理（CDN 快取）
const PUBLIC_API = ['/api/admin/auth', '/api/photo']

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_API.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const secret = process.env.ADMIN_PASSWORD
  const token = req.cookies.get('bkk_admin')?.value
  if (secret && token && token === (await sha256Hex(secret))) {
    return NextResponse.next()
  }

  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

export const config = {
  // 只攔截 API；頁面（含 /admin 畫面）不受影響，後台 UI 仍由密碼登入
  matcher: ['/api/:path*'],
}
