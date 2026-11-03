import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { transact, isOnline } from '@/lib/store'
import { txLocations, txWriteLocations, txPending, txWritePending, txRemovePhotos } from '@/lib/data'
import { txLocalizePhotos } from '@/lib/googlePhotos'
import type { Location, PendingLocation } from '@/lib/types'
import { isTrendingFresh } from '@/lib/tags'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json(await transact('read', txLocations))
}

// POST: approve a pending item (body: { action:'approve', id:string }) OR add a manual location (body: { action:'add', ...fields })
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === 'approve') {
    const result = await transact(`上架 ${body.id}`, async (tx) => {
      const pending = await txPending(tx)
      const item = pending.find((p) => p.id === body.id)
      if (!item) return null
      const { scraped_at, ...rest } = item as PendingLocation
      void scraped_at
      let approved: Location = {
        ...rest,
        ...(body.category ? { category: body.category } : {}),
        ...(body.tag ? { tag: body.tag } : {}),
        approved_at: new Date().toISOString(),
      }
      if (approved.tag === 'trending' && !approved.trending_at) approved.trending_at = new Date().toISOString()
      if (approved.tag === 'trending' && body.tag === 'trending' && item.tag !== 'trending' && item.tag) approved.base_tag = item.tag
      // 正式站沒有 Python，上架當下就把照片存成網站自己的檔案
      if (isOnline) approved = await txLocalizePhotos(tx, approved)
      txWriteLocations(tx, [...await txLocations(tx), approved])
      txWritePending(tx, pending.filter((p) => p.id !== body.id))
      return approved
    })
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  // Manual add
  const location: Location = {
    ...body,
    id: uuidv4(),
    approved_at: new Date().toISOString(),
  }
  await transact(`新增 ${location.name_zh ?? location.name_en}`, async (tx) => {
    const loc = isOnline ? await txLocalizePhotos(tx, location) : location
    txWriteLocations(tx, [...await txLocations(tx), loc])
  })
  return NextResponse.json({ ok: true, id: location.id })
}

// PATCH: update fields on an approved location
export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const found = await transact(`修改 ${id}`, async (tx) => {
    const locations = await txLocations(tx)
    const idx = locations.findIndex((l) => l.id === id)
    if (idx === -1) return false
    // 後台手動改成「話題爆紅」：從現在起算兩個月，期滿退回原本的標籤
    // （已經過期的爆紅店重新選一次，也會重新起算）
    if (updates.tag === 'trending' && !(locations[idx].tag === 'trending' && isTrendingFresh(locations[idx]))) {
      updates.trending_at = new Date().toISOString()
      if (locations[idx].tag && locations[idx].tag !== 'trending') updates.base_tag = locations[idx].tag
    }
    locations[idx] = { ...locations[idx], ...updates }
    txWriteLocations(tx, locations)
    return true
  })
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE: remove an approved location by id
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await transact(`刪除 ${id}`, async (tx) => {
    txWriteLocations(tx, (await txLocations(tx)).filter((l) => l.id !== id))
    // 本機的照片資料夾由「存檔並上傳」時的下載腳本清理；正式站這裡直接清
    if (isOnline) await txRemovePhotos(tx, id)
  })
  return NextResponse.json({ ok: true })
}
