import { NextRequest, NextResponse } from 'next/server'
import { transact, isOnline } from '@/lib/store'
import { txPending, txWritePending, txRemovePhotos } from '@/lib/data'
import { withErrors } from '@/lib/apiError'

// 每次都讀最新資料，不在建置時先跑
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 60

async function handleGET() {
  return NextResponse.json(await transact('read', txPending))
}

async function handlePATCH(req: NextRequest) {
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
async function handleDELETE(req: NextRequest) {
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

export const GET = withErrors(handleGET)
export const PATCH = withErrors(handlePATCH)
export const DELETE = withErrors(handleDELETE)
