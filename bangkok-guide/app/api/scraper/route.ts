import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers } from '@/scrapers/index'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const customKeywords: string[] | undefined = body.customKeywords?.length ? body.customKeywords : undefined
    const count = await runAllScrapers(customKeywords)
    return NextResponse.json({ ok: true, added: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
