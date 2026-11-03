import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

// 後台上傳自己的照片：{ id: 地點 id, photo: data:image/jpeg;base64,... }（瀏覽器端已縮好）
// 存成 public/photos/<id>/u-<亂碼>.jpg，跟 Google 下載的照片放在同一個資料夾，存檔並上傳時一起推上去
export async function POST(req: NextRequest) {
  const { id, photo, thumb } = await req.json() as { id?: string; photo?: string; thumb?: string }
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'id 不正確' }, { status: 400 })
  if (!photo?.startsWith('data:image/jpeg;base64,')) return NextResponse.json({ error: '照片格式不正確' }, { status: 400 })
  const dir = join(process.cwd(), 'public', 'photos', id)
  mkdirSync(dir, { recursive: true })
  const base = `u-${randomBytes(4).toString('hex')}`
  const name = `${base}.jpg`
  writeFileSync(join(dir, name), Buffer.from(photo.split(',')[1], 'base64'))
  // 卡片用的小圖（lib/photo.ts 會自動換成 -480 版）
  if (thumb?.startsWith('data:image/jpeg;base64,')) writeFileSync(join(dir, `${base}-480.jpg`), Buffer.from(thumb.split(',')[1], 'base64'))
  return NextResponse.json({ ok: true, path: `/photos/${id}/${name}` })
}
