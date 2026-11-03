import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { transact } from '@/lib/store'
import { withErrors } from '@/lib/apiError'

export const runtime = 'nodejs'

// 後台上傳自己的照片：{ id: 地點 id, photo: data:image/jpeg;base64,..., thumb? }（瀏覽器端已縮好）
// 存成 public/photos/<id>/u-<亂碼>.jpg，跟 Google 下載的照片放在同一個資料夾
async function handlePOST(req: NextRequest) {
  const { id, photo, thumb } = await req.json() as { id?: string; photo?: string; thumb?: string }
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'id 不正確' }, { status: 400 })
  if (!photo?.startsWith('data:image/jpeg;base64,')) return NextResponse.json({ error: '照片格式不正確' }, { status: 400 })
  const base = `u-${randomBytes(4).toString('hex')}`
  await transact(`上傳照片 ${id}`, async (tx) => {
    tx.writeBase64(`public/photos/${id}/${base}.jpg`, photo.split(',')[1])
    // 卡片用的小圖（lib/photo.ts 會自動換成 -480 版）
    if (thumb?.startsWith('data:image/jpeg;base64,')) tx.writeBase64(`public/photos/${id}/${base}-480.jpg`, thumb.split(',')[1])
  })
  return NextResponse.json({ ok: true, path: `/photos/${id}/${base}.jpg` })
}

export const POST = withErrors(handlePOST)
