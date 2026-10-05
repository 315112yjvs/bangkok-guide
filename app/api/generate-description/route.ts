import { NextRequest, NextResponse } from 'next/server'
import { generateDescription, type GenerateInput } from '@/lib/generateDescription'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const input = (await req.json()) as GenerateInput
  if (!input.name_en?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'no anthropic key' }, { status: 500 })

  try {
    return NextResponse.json(await generateDescription(input))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: msg.startsWith('could not parse') ? 502 : 500 })
  }
}
