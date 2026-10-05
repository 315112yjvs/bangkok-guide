import stations from './stations.json'
import { haversineKm } from './geo'

// 車站座標來自 OpenStreetMap（© OpenStreetMap contributors, ODbL），
// 只收 BTS、MRT（含粉紅/黃線單軌）與機場快線。要更新就重抓一次覆蓋 lib/stations.json。
type Station = { name: string; th: string; sys: 'BTS' | 'MRT' | 'ARL'; lat: number; lng: number }

export type NearestStation = { name: string; sys: Station['sys']; meters: number; walkMinutes: number }

// 直線距離換算步行：實際路徑約多三成，步行每分鐘約 80 公尺
export function nearestStation(lat: number, lng: number): NearestStation | null {
  let best: Station | null = null
  let bestKm = Infinity
  for (const s of stations as Station[]) {
    const km = haversineKm(lat, lng, s.lat, s.lng)
    if (km < bestKm) { bestKm = km; best = s }
  }
  // 超過 1.5 公里就不算「走得到」，不顯示
  if (!best || bestKm > 1.5) return null
  const meters = Math.round((bestKm * 1000) / 10) * 10
  return { name: best.name, sys: best.sys, meters, walkMinutes: Math.max(1, Math.round((bestKm * 1000 * 1.3) / 80)) }
}
