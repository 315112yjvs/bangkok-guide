import { NextRequest, NextResponse } from 'next/server'
import { readPending, writePending } from '@/lib/data'

export async function GET() {
  return NextResponse.json(readPending())
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  writePending(readPending().filter((p) => p.id !== id))
  return NextResponse.json({ ok: true })
}
