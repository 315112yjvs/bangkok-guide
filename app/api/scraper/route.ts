import { NextResponse } from 'next/server'
import { runAllScrapers } from '@/scrapers/index'

export async function POST() {
  try {
    const count = await runAllScrapers()
    return NextResponse.json({ ok: true, added: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
