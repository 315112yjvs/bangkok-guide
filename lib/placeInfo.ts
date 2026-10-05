import { extractPlaceId } from './maps'

// 營業時間：向 Google Place Details 只要 regularOpeningHours，並放進 Next Data Cache 30 天
// （跨部署保留）。每家店一個月最多查一次，全站三百家左右都在 Google 每月免費額度內。
const CACHE_SECONDS = 60 * 60 * 24 * 30

type Point = { day: number; hour: number; minute: number }
type Period = { open: Point; close?: Point }

// 週一到週日各一個陣列，每個元素是一段營業時間（如 "11:00–22:00"）；空陣列 = 當天公休
export type WeekHours = string[][]

const hhmm = (p: Point) => `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`

export function periodsToWeek(periods: Period[]): WeekHours | 'always' | null {
  if (!periods.length) return null
  // Google 表示 24 小時營業的方式：只有一筆、週日 00:00 開、沒有 close
  if (periods.length === 1 && !periods[0].close && periods[0].open.hour === 0 && periods[0].open.minute === 0) return 'always'
  const week: WeekHours = Array.from({ length: 7 }, () => [])
  for (const p of [...periods].sort((a, b) => a.open.day - b.open.day || a.open.hour - b.open.hour || a.open.minute - b.open.minute)) {
    // Google 的 day：0=週日；這裡轉成 0=週一
    const idx = (p.open.day + 6) % 7
    week[idx].push(p.close ? `${hhmm(p.open)}–${hhmm(p.close)}` : `${hhmm(p.open)}–`)
  }
  return week
}

export async function getOpeningHours(sourceUrl?: string): Promise<WeekHours | 'always' | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  const placeId = extractPlaceId(sourceUrl)
  if (!key || !placeId) return null
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'regularOpeningHours.periods',
        'Referer': 'https://www.bkk-local.com/',
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: CACHE_SECONDS },
    })
    if (!res.ok) return null
    const data = await res.json()
    return periodsToWeek((data.regularOpeningHours?.periods ?? []) as Period[])
  } catch {
    return null
  }
}
