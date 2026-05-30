import { NextRequest, NextResponse } from 'next/server'
import { readLocations, writeLocations, readPending, writePending } from '@/lib/data'
import { v4 as uuidv4 } from 'uuid'
import type { Location, PendingLocation } from '@/lib/types'

export async function GET() {
  return NextResponse.json(readLocations())
}

// POST: approve a pending item (body: { id: string }) OR add a manual location (body: full Location fields without id/approved_at)
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Approve from pending: body has only { id }
  if (body.id && !body.name_zh) {
    const pending = readPending()
    const item = pending.find((p) => p.id === body.id)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { scraped_at, ...rest } = item as PendingLocation
    void scraped_at
    const approved: Location = { ...rest, approved_at: new Date().toISOString() }
    writeLocations([...readLocations(), approved])
    writePending(pending.filter((p) => p.id !== body.id))
    return NextResponse.json({ ok: true })
  }

  // Manual add: body has full location fields
  const location: Location = {
    ...body,
    id: uuidv4(),
    approved_at: new Date().toISOString(),
  }
  writeLocations([...readLocations(), location])
  return NextResponse.json({ ok: true, id: location.id })
}

// DELETE: remove an approved location by id
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  writeLocations(readLocations().filter((l) => l.id !== id))
  return NextResponse.json({ ok: true })
}
