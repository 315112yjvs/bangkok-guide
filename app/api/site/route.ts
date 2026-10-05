import { NextRequest, NextResponse } from 'next/server'
import { readContact, writeContact } from '@/lib/site'

// 後台讀寫「關於」頁的聯絡方式（/api/* 由 middleware 驗證管理員 cookie）
export async function GET() {
  return NextResponse.json({ contact: readContact() })
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    return NextResponse.json({ ok: true, contact: writeContact(body.contact ?? {}) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
