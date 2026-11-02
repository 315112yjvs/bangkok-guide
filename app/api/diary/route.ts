import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { readDiary, writeDiary, type DiaryEntry } from '@/lib/diary'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(readDiary())
}

// 新增一篇：{ date, text, place?, photo: data:image/jpeg;base64,... }（照片在瀏覽器端先縮好）
export async function POST(req: NextRequest) {
  const { date, text, place, photo } = await req.json()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !text?.trim() || !photo?.startsWith('data:image/jpeg;base64,')) {
    return NextResponse.json({ error: '日期、文字、照片都要填' }, { status: 400 })
  }
  const id = randomUUID().slice(0, 8)
  writeFileSync(join(process.cwd(), 'public', 'diary', `${id}.jpg`), Buffer.from(photo.split(',')[1], 'base64'))
  const entry: DiaryEntry = { id, date, text: text.trim(), photo: `/diary/${id}.jpg`, ...(place?.trim() ? { place: place.trim() } : {}) }
  writeDiary([...readDiary(), entry])
  return NextResponse.json({ ok: true, entry })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const list = readDiary()
  const entry = list.find((e) => e.id === id)
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const file = join(process.cwd(), 'public', entry.photo)
  if (existsSync(file)) unlinkSync(file)
  writeDiary(list.filter((e) => e.id !== id))
  return NextResponse.json({ ok: true })
}
