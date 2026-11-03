import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers } from '@/scrapers/index'
import { isOnline } from '@/lib/store'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  // 要跑很久或要用本機的 Python / git，只能在電腦上的後台用
  if (isOnline) return NextResponse.json({ ok: false, error: '這個功能只能在電腦上的後台使用' }, { status: 400 })
  try {
    const body = await req.json().catch(() => ({}))
    const customKeywords: string[] | undefined = body.customKeywords?.length ? body.customKeywords : undefined
    const mode = body.mode === 'stock' ? 'stock' : 'trending'
    const count = await runAllScrapers(customKeywords, mode)
    return NextResponse.json({ ok: true, added: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
