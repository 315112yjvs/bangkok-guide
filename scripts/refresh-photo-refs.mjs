import { readFileSync, writeFileSync } from 'fs'

// Google Places 照片 ref 會過期（過期後抓圖回 403 變預設圖）。
// 這支用 ref 內含的 place id 重打 Place Details（只要 photos 欄位，最便宜的計費層），
// 把每個地點的照片 ref 換成新的。ref 又過期時可隨時重跑。
const env = readFileSync('.env.local', 'utf-8')
const key = env.match(/^GOOGLE_MAPS_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
if (!key) { console.error('找不到 GOOGLE_MAPS_API_KEY'); process.exit(1) }

const PATH = 'data/locations.json'
const MAX_PHOTOS = 6
const locations = JSON.parse(readFileSync(PATH, 'utf-8'))

function placeIdOf(loc) {
  const ref = (loc.photos ?? []).find((p) => p?.startsWith('places/'))
  return ref?.split('/')[1] ?? null
}

async function refresh(loc) {
  const pid = placeIdOf(loc)
  if (!pid) return { loc, status: 'no-place-id' }
  const res = await fetch(`https://places.googleapis.com/v1/places/${pid}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'photos',
      'Referer': 'https://www.bkk-local.com/',
    },
  })
  if (!res.ok) return { loc, status: `http-${res.status}` }
  const data = await res.json()
  const photos = (data.photos ?? []).slice(0, MAX_PHOTOS).map((p) => p.name)
  if (photos.length === 0) return { loc, status: 'no-photos' }
  loc.photos = photos
  return { loc, status: 'ok', count: photos.length }
}

const CONCURRENCY = 6
const queue = [...locations]
const stats = {}
const failures = []
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const loc = queue.shift()
    try {
      const r = await refresh(loc)
      stats[r.status] = (stats[r.status] ?? 0) + 1
      if (r.status !== 'ok') failures.push(`${loc.id} ${loc.name_en}: ${r.status}`)
    } catch (e) {
      stats.error = (stats.error ?? 0) + 1
      failures.push(`${loc.id} ${loc.name_en}: ${e.message}`)
    }
  }
}))

writeFileSync(PATH, JSON.stringify(locations, null, 2))
console.log('結果:', JSON.stringify(stats))
if (failures.length) console.log('未更新（保留舊 ref）:\n' + failures.join('\n'))
