import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { transact } from '@/lib/store'
import { sortDiary, type DiaryEntry } from '@/lib/diary'
import { withErrors } from '@/lib/apiError'

// 每次都讀最新資料，不在建置時先跑
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

const FILE = 'data/diary.json'
const save = (list: DiaryEntry[]) => JSON.stringify(list, null, 2)

async function handleGET() {
  return NextResponse.json(sortDiary(await transact('read', (tx) => tx.readJson<DiaryEntry[]>(FILE, []))))
}

// 新增一篇：{ date, text, place?, photo: data:image/jpeg;base64,... }（照片在瀏覽器端先縮好）
async function handlePOST(req: NextRequest) {
  const { date, text, place, photo } = await req.json()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !text?.trim() || !photo?.startsWith('data:image/jpeg;base64,')) {
    return NextResponse.json({ error: '日期、文字、照片都要填' }, { status: 400 })
  }
  const id = randomUUID().slice(0, 8)
  const entry: DiaryEntry = { id, date, text: text.trim(), photo: `/diary/${id}.jpg`, ...(place?.trim() ? { place: place.trim() } : {}) }
  await transact(`日記 ${date}`, async (tx) => {
    tx.writeBase64(`public/diary/${id}.jpg`, photo.split(',')[1])
    tx.writeText(FILE, save([...await tx.readJson<DiaryEntry[]>(FILE, []), entry]))
  })
  return NextResponse.json({ ok: true, entry })
}

async function handleDELETE(req: NextRequest) {
  const { id } = await req.json()
  const found = await transact(`刪除日記 ${id}`, async (tx) => {
    const list = await tx.readJson<DiaryEntry[]>(FILE, [])
    const entry = list.find((e) => e.id === id)
    if (!entry) return false
    if ((await tx.list('public/diary')).includes(entry.photo.split('/').pop()!)) tx.remove(`public${entry.photo}`)
    tx.writeText(FILE, save(list.filter((e) => e.id !== id)))
    return true
  })
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export const GET = withErrors(handleGET)
export const POST = withErrors(handlePOST)
export const DELETE = withErrors(handleDELETE)
