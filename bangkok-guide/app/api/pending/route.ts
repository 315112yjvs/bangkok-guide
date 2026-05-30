import { NextRequest, NextResponse } from 'next/server'
import { readPending, writePending } from '@/lib/data'

export async function GET() {
  return NextResponse.json(readPending())
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  if (body.all) {
    writePending([])
    return NextResponse.json({ ok: true })
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  writePending(readPending().filter((p) => p.id !== body.id))
  return NextResponse.json({ ok: true })
}
