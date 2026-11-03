import type { Location, LocationTag } from './types'

// 「話題爆紅」只算近兩個月在社群上被討論的店。
// trending_at 是最後一次被「找熱點」爬蟲（或站主在後台手動）標成爆紅的時間；
// 超過這個天數就自動退回 base_tag（被標成爆紅之前的分類），不用手動整理。
export const TRENDING_DAYS = 60

export function isTrendingFresh(loc: Pick<Location, 'trending_at'>, now = Date.now()): boolean {
  if (!loc.trending_at) return false
  return now - new Date(loc.trending_at).getTime() <= TRENDING_DAYS * 86400000
}

// 網站上實際顯示的標籤
export function resolveTag(loc: Location, now = Date.now()): LocationTag {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tag: LocationTag = loc.tag ?? ((loc as any).trending === true ? 'trending' : 'evergreen')
  if (tag === 'trending' && !isTrendingFresh(loc, now)) return loc.base_tag && loc.base_tag !== 'trending' ? loc.base_tag : 'hidden_gem'
  return tag
}
