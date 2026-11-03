import { NextRequest, NextResponse } from 'next/server'
import { readLocations, writeLocations, readPending, writePending } from '@/lib/data'
import { v4 as uuidv4 } from 'uuid'
import type { Location, PendingLocation } from '@/lib/types'
import { isTrendingFresh } from '@/lib/tags'

export async function GET() {
  return NextResponse.json(readLocations())
}

// POST: approve a pending item (body: { action:'approve', id:string }) OR add a manual location (body: { action:'add', ...fields })
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === 'approve') {
    const pending = readPending()
    const item = pending.find((p) => p.id === body.id)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { scraped_at, ...rest } = item as PendingLocation
    void scraped_at
    const approved: Location = {
      ...rest,
      ...(body.category ? { category: body.category } : {}),
      ...(body.tag ? { tag: body.tag } : {}),
      approved_at: new Date().toISOString(),
    }
    if (approved.tag === 'trending' && !approved.trending_at) approved.trending_at = new Date().toISOString()
    if (approved.tag === 'trending' && body.tag === 'trending' && item.tag !== 'trending' && item.tag) approved.base_tag = item.tag
    writeLocations([...readLocations(), approved])
    writePending(pending.filter((p) => p.id !== body.id))
    return NextResponse.json({ ok: true })
  }

  // Manual add
  const location: Location = {
    ...body,
    id: uuidv4(),
    approved_at: new Date().toISOString(),
  }
  writeLocations([...readLocations(), location])
  return NextResponse.json({ ok: true, id: location.id })
}

// PATCH: update fields on an approved location
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const locations = readLocations()
  const idx = locations.findIndex((l) => l.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // 後台手動改成「話題爆紅」：從現在起算兩個月，期滿退回原本的標籤
  // （已經過期的爆紅店重新選一次，也會重新起算）
  if (updates.tag === 'trending' && !(locations[idx].tag === 'trending' && isTrendingFresh(locations[idx]))) {
    updates.trending_at = new Date().toISOString()
    if (locations[idx].tag && locations[idx].tag !== 'trending') updates.base_tag = locations[idx].tag
  }
  locations[idx] = { ...locations[idx], ...updates }
  writeLocations(locations)
  return NextResponse.json({ ok: true })
}

// DELETE: remove an approved location by id
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  writeLocations(readLocations().filter((l) => l.id !== id))
  return NextResponse.json({ ok: true })
}
