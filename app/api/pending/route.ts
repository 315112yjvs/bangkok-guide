import { NextRequest, NextResponse } from 'next/server'
import { transact, isOnline } from '@/lib/store'
import { txPending, txWritePending, txRemovePhotos } from '@/lib/data'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json(await transact('read', txPending))
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const found = await transact(`修改待審 ${id}`, async (tx) => {
    const pending = await txPending(tx)
    const idx = pending.findIndex((p) => p.id === id)
    if (idx === -1) return false
    pending[idx] = { ...pending[idx], ...updates }
    txWritePending(tx, pending)
    return true
  })
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// 駁回：本機的照片資料夾由「存檔並上傳」時的下載腳本清理；正式站這裡直接清
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  if (!body.all && !body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await transact(body.all ? '清空待審' : `駁回 ${body.id}`, async (tx) => {
    const pending = await txPending(tx)
    const removed = body.all ? pending : pending.filter((p) => p.id === body.id)
    txWritePending(tx, body.all ? [] : pending.filter((p) => p.id !== body.id))
    if (isOnline) for (const p of removed) await txRemovePhotos(tx, p.id)
  })
  return NextResponse.json({ ok: true })
}
