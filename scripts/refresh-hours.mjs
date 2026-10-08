// 把每家店的營業時間從 Google 抓下來存進 data/hours.json，網站直接讀這個檔。
//
// 為什麼不在網站執行時即時抓：每次部署 Next 都會在建置階段把三百多個地點頁重新產生一次，
// 等於每部署一次就向 Google 查三百多次，一天部署兩次就超過帳戶的每日 500 次上限。
// 改成這支腳本手動跑，查幾次完全由我們控制。
//
//   node scripts/refresh-hours.mjs          只查「沒有資料」或「超過 30 天沒更新」的店
//   node scripts/refresh-hours.mjs --all    全部重查
//
// 用到 Google Place Details（營業時間、營業狀態、評分），一家店一次查詢。
import { readFileSync, writeFileSync, existsSync } from 'fs'

const env = readFileSync('.env.local', 'utf-8')
const key = env.match(/^GOOGLE_MAPS_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
if (!key) { console.error('找不到 GOOGLE_MAPS_API_KEY'); process.exit(1) }

const OUT = 'data/hours.json'
const STALE_DAYS = 30
const all = process.argv.includes('--all')
const locations = JSON.parse(readFileSync('data/locations.json', 'utf-8'))
const hours = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {}

const placeIdOf = (url) => url?.match(/place_id:([^&\s]+)/)?.[1] ?? url?.match(/query_place_id=([^&\s]+)/)?.[1] ?? null
const hhmm = (p) => `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`

// 回傳：週一到週日各一個陣列（空陣列 = 公休）、'always'（24 小時）、或 null（Google 沒有資料）
function toWeek(periods) {
  if (!periods?.length) return null
  if (periods.length === 1 && !periods[0].close && periods[0].open.hour === 0 && periods[0].open.minute === 0) return 'always'
  const week = Array.from({ length: 7 }, () => [])
  for (const p of [...periods].sort((a, b) => a.open.day - b.open.day || a.open.hour - b.open.hour || a.open.minute - b.open.minute)) {
    week[(p.open.day + 6) % 7].push(p.close ? `${hhmm(p.open)}–${hhmm(p.close)}` : `${hhmm(p.open)}–`)
  }
  return week
}

const now = Date.now()
const todo = locations.filter((l) => {
  if (!placeIdOf(l.source_url)) return false
  const h = hours[l.id]
  return all || !h || now - new Date(h.checked_at).getTime() > STALE_DAYS * 86400000
})
console.log(`共 ${locations.length} 家，這次要查 ${todo.length} 家`)

const stats = { ok: 0, noHours: 0, failed: 0 }
let quotaHit = false
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < todo.length && !quotaHit) {
    const loc = todo[next++]
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeIdOf(loc.source_url)}`, {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours.periods,businessStatus,rating,userRatingCount', 'Referer': 'https://www.bkk-local.com/' },
      })
      if (res.status === 429) { quotaHit = true; break }
      if (!res.ok) { stats.failed++; continue }
      const data = await res.json()
      const week = toWeek(data.regularOpeningHours?.periods)
      // 順便記下營業狀態與目前評分，用來找出已歇業或評分大幅變動的店（同一次查詢，不另外計費）
      hours[loc.id] = {
        week,
        status: data.businessStatus ?? null,
        rating: data.rating ?? null,
        reviews: data.userRatingCount ?? null,
        checked_at: new Date().toISOString(),
      }
      if (week) stats.ok++
      else stats.noHours++
    } catch {
      stats.failed++
    }
  }
}))

// 已下架的店順手清掉
const ids = new Set(locations.map((l) => l.id))
for (const id of Object.keys(hours)) if (!ids.has(id)) delete hours[id]

writeFileSync(OUT, JSON.stringify(hours, null, 1) + '\n')
console.log(`有營業時間 ${stats.ok}、Google 沒資料 ${stats.noHours}、失敗 ${stats.failed}`)
if (quotaHit) console.log('Google 當日查詢額度（每日 500 次）已用完，剩下的明天再跑一次即可，已查到的都存好了。')
