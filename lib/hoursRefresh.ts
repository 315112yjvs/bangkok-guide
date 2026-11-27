import { transact, isOnline, publish } from './store'
import { txLocations } from './data'
import { extractPlaceId } from './maps'

// 每天由 Vercel Cron 打 /api/refresh-hours：挑最久沒更新的 DAILY_LIMIT 間店，向 Google 重抓營業時間、營業狀態、評分。
// 一天 30 間，六百多間店約三週輪完一遍，遠低於帳戶每日 500 次的 Place Details 上限（爬蟲、後台也要用額度）。
// 寫法跟 scripts/refresh-hours.mjs 一樣（那支仍可在本機手動全部重跑）。
export const HOURS_FILE = 'data/hours.json'
const DAILY_LIMIT = 30

type Period = { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }
export type HoursEntry = {
  week: string[][] | 'always' | null
  status: string | null
  rating: number | null
  reviews: number | null
  checked_at: string
}

const hhmm = (p: { hour: number; minute: number }) => `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`

function toWeek(periods?: Period[]): HoursEntry['week'] {
  if (!periods?.length) return null
  if (periods.length === 1 && !periods[0].close && periods[0].open.hour === 0 && periods[0].open.minute === 0) return 'always'
  const week: string[][] = Array.from({ length: 7 }, () => [])
  for (const p of [...periods].sort((a, b) => a.open.day - b.open.day || a.open.hour - b.open.hour || a.open.minute - b.open.minute)) {
    week[(p.open.day + 6) % 7].push(p.close ? `${hhmm(p.open)}–${hhmm(p.close)}` : `${hhmm(p.open)}–`)
  }
  return week
}

async function fetchPlace(placeId: string): Promise<HoursEntry | 'quota' | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('沒有 GOOGLE_MAPS_API_KEY')
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours.periods,businessStatus,rating,userRatingCount', Referer: 'https://www.bkk-local.com/' },
    cache: 'no-store',
  })
  if (res.status === 429) return 'quota'
  if (!res.ok) return null
  const d = await res.json()
  return {
    week: toWeek(d.regularOpeningHours?.periods),
    status: d.businessStatus ?? null,
    rating: d.rating ?? null,
    reviews: d.userRatingCount ?? null,
    checked_at: new Date().toISOString(),
  }
}

export type HoursResult = { checked: number; changed: string[]; closed: string[]; quotaHit: boolean; deployed: boolean }

export async function refreshHours(opts: { deploy?: boolean; limit?: number } = {}): Promise<HoursResult> {
  const { locations, hours } = await transact('read', async (tx) => ({
    locations: await txLocations(tx),
    hours: await tx.readJson<Record<string, HoursEntry>>(HOURS_FILE, {}),
  }))
  const todo = locations
    .filter((l) => extractPlaceId(l.source_url))
    .sort((a, b) => new Date(hours[a.id]?.checked_at ?? 0).getTime() - new Date(hours[b.id]?.checked_at ?? 0).getTime())
    .slice(0, opts.limit ?? DAILY_LIMIT)

  const updates: Record<string, HoursEntry> = {}
  const changed: string[] = []   // 營業時間或狀態有變的店（要重新部署才會顯示）
  const closed: string[] = []    // Google 顯示歇業的店（後台會標出來，由站主決定要不要下架）
  let quotaHit = false
  for (const loc of todo) {
    const r = await fetchPlace(extractPlaceId(loc.source_url)!)
    if (r === 'quota') { quotaHit = true; break }
    if (!r) continue
    const prev = hours[loc.id]
    updates[loc.id] = r
    if (!prev || JSON.stringify(prev.week) !== JSON.stringify(r.week) || prev.status !== r.status) changed.push(loc.name_zh || loc.name_en)
    if (r.status && r.status !== 'OPERATIONAL' && prev?.status !== r.status) closed.push(`${loc.name_zh || loc.name_en}（${r.status === 'CLOSED_PERMANENTLY' ? '永久歇業' : '暫停營業'}）`)
  }

  if (Object.keys(updates).length) {
    await transact(`更新營業時間 ${Object.keys(updates).length} 間`, async (tx) => {
      const current = await tx.readJson<Record<string, HoursEntry>>(HOURS_FILE, {})
      const ids = new Set(locations.map((l) => l.id))
      const next = { ...current, ...updates }
      for (const id of Object.keys(next)) if (!ids.has(id)) delete next[id]   // 已下架的店順手清掉
      tx.writeText(HOURS_FILE, JSON.stringify(next, null, 1) + '\n')
    })
  }

  // 只有營業時間或狀態真的變了才部署；只是更新檢查時間就累積在 "admin:" commit 裡，下次部署一起帶上
  let deployed = false
  if (opts.deploy && isOnline && changed.length) {
    await publish(`data: 營業時間更新 ${new Date().toISOString().slice(0, 10)}`)
    deployed = true
  }
  return { checked: Object.keys(updates).length, changed, closed, quotaHit, deployed }
}
