import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// 營業時間存在 data/hours.json，由 scripts/refresh-hours.mjs 從 Google 抓下來（一個月跑一次即可）。
// 網站只讀檔，不在執行或建置時呼叫 Google：之前即時抓的做法會讓每次部署都重查三百多家店，
// 一天就把帳戶每日 500 次的上限用完。

// 週一到週日各一個陣列，每個元素是一段營業時間（如 "11:00–22:00"）；空陣列 = 當天公休
export type WeekHours = string[][]
export type OpeningHours = { week: WeekHours | 'always'; checkedAt: string }

let cache: Record<string, { week: WeekHours | 'always' | null; checked_at: string }> | null = null

export function getOpeningHours(locationId: string): OpeningHours | null {
  if (!cache) {
    try {
      const path = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'hours.json')
      cache = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {}
    } catch {
      cache = {}
    }
  }
  const h = cache![locationId]
  return h?.week ? { week: h.week, checkedAt: h.checked_at } : null
}
