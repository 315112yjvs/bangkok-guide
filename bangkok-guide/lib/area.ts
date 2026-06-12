import type { Location } from './types'

// 從 Google 地址字串推導曼谷區域
const AREA_PATTERNS: Array<[RegExp, string]> = [
  [/thong lo|thonglor|thong lor/i, 'Thonglor'],
  [/ekkamai|ekamai/i, 'Ekkamai'],
  [/phrom phong|prompong|phrompong/i, 'Phrom Phong'],
  [/asok|asoke/i, 'Asok'],
  [/on nut|on-nut|onnut/i, 'On Nut'],
  [/udom suk/i, 'Udom Suk'],
  [/bearing|samrong/i, 'Bearing'],
  [/nana(?!\s*plaza)/i, 'Nana'],
  [/phloen chit|ploenchit|ploen chit/i, 'Ploenchit'],
  [/chit lom|chidlom/i, 'Chidlom'],
  [/siam(?!\s*paragon|\s*square|\s*center)/i, 'Siam'],
  [/ratchadamri/i, 'Ratchadamri'],
  [/silom/i, 'Silom'],
  [/surawong|surawongse/i, 'Surawong'],
  [/sathorn/i, 'Sathorn'],
  [/charoen krung|charoenkrung/i, 'Charoen Krung'],
  [/ari\b/i, 'Ari'],
  [/phahon yothin|phahonyothin/i, 'Phahonyothin'],
  [/ratchayothin/i, 'Ratchayothin'],
  [/lat phrao|ladprao|lad phrao/i, 'Lat Phrao'],
  [/ratchadaphisek|ratchada\b/i, 'Ratchada'],
  [/huai khwang|huay kwang|huaikhwang/i, 'Huai Khwang'],
  [/chatuchak/i, 'Chatuchak'],
  [/mo chit/i, 'Mo Chit'],
  [/don mueang|don muang/i, 'Don Mueang'],
  [/yaowarat/i, 'Yaowarat'],
  [/khao san|khaosan|ko san/i, 'Khao San'],
  [/bang rak|bangrak/i, 'Bang Rak'],
  [/pratunam/i, 'Pratunam'],
  [/ratchathewi/i, 'Ratchathewi'],
  [/bang phlat|bangphlat/i, 'Bang Phlat'],
  [/thon buri|thonburi/i, 'Thon Buri'],
  [/khlong san/i, 'Khlong San'],
  [/phra khanong/i, 'Phra Khanong'],
  [/wang thong lang/i, 'Wang Thong Lang'],
  [/min buri/i, 'Min Buri'],
  // 區級 fallback
  [/watthana/i, 'Sukhumvit'],
  [/khlong toei/i, 'Sukhumvit'],
  [/phra nakhon/i, 'Old City'],
  [/samphanthawong/i, 'Yaowarat'],
  [/pathum wan|pathumwan/i, 'Siam'],
  [/phaya thai/i, 'Phaya Thai'],
  [/bang sue/i, 'Bang Sue'],
]

export function extractArea(address: string): string {
  for (const [pattern, area] of AREA_PATTERNS) {
    if (pattern.test(address)) return area
  }
  return 'Bangkok'
}

// 取得地點區域：優先用已存的 area，沒有就從地址即時推導
export function getArea(loc: Pick<Location, 'area' | 'address'>): string {
  if (loc.area && loc.area.trim()) return loc.area
  if (loc.address) return extractArea(loc.address)
  return 'Bangkok'
}
