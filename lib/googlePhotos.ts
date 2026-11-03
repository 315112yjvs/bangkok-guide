import type { Tx } from './store'
import type { Location } from './types'

// 正式站後台上架一家店時，把它的 Google 照片下載成網站自己的檔案（跟 scripts/download-photos.py 同一套規則）。
// 本機後台不用這支：按「存檔並上傳」時 Python 腳本會做同樣的事。
const PHOTOS_PER_PLACE = 4

async function fetchPhoto(ref: string, width: number): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  const res = await fetch(`https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}&key=${key}`, {
    headers: { Referer: 'https://www.bkk-local.com/' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer()).toString('base64')
}

export async function txLocalizePhotos(tx: Tx, loc: Location): Promise<Location> {
  const photos = loc.photos ?? []
  if (!photos.some((p) => p.startsWith('places/'))) return loc
  const refs = (loc.photo_refs?.length ? loc.photo_refs : photos).filter((p) => p.startsWith('places/'))
  const dir = `public/photos/${loc.id}`
  const existing = new Set(await tx.list(dir))
  const next: string[] = []
  for (const p of photos) {
    const i = refs.indexOf(p)
    if (!p.startsWith('places/') || i === -1) { next.push(p); continue }
    if (i >= PHOTOS_PER_PLACE) continue
    if (!existing.has(`${i}.jpg`)) {
      const full = await fetchPhoto(p, 800)
      if (!full) { next.push(p); continue }   // 下載失敗就先留著 ref，網站會走照片代理
      tx.writeBase64(`${dir}/${i}.jpg`, full)
      if (i === 0) {
        const thumb = await fetchPhoto(p, 480)
        if (thumb) tx.writeBase64(`${dir}/0-480.jpg`, thumb)
      }
    }
    next.push(`/photos/${loc.id}/${i}.jpg`)
  }
  return { ...loc, photos: next, photo_refs: refs }
}
