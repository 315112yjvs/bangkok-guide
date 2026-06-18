import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

// 登入成功後種一個 httpOnly cookie，middleware 會用它驗證所有後台 API。
// cookie 值放 ADMIN_PASSWORD 的 SHA-256，不存明碼。
export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const secret = process.env.ADMIN_PASSWORD
  if (secret && password === secret) {
    const token = createHash('sha256').update(secret).digest('hex')
    const res = NextResponse.json({ ok: true })
    res.cookies.set('bkk_admin', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 本機 http 也能登入
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 天
    })
    return res
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}
