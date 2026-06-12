// 從 Google Maps source_url 取出 place_id（同時支援 place_id: 與 query_place_id= 兩種格式）
export function extractPlaceId(sourceUrl?: string): string | null {
  if (!sourceUrl) return null
  return (
    sourceUrl.match(/place_id:([^&\s]+)/)?.[1] ??
    sourceUrl.match(/query_place_id=([^&\s]+)/)?.[1] ??
    null
  )
}

// 產生會「精確開到該店家」的 Google Maps 連結。有 place_id 就鎖定店家，否則退回名稱+地址搜尋。
export function buildMapsUrl(opts: { name_en: string; address?: string; source_url?: string }): string {
  const query = encodeURIComponent(opts.name_en + (opts.address ? ' ' + opts.address : ' Bangkok'))
  const placeId = extractPlaceId(opts.source_url)
  return placeId
    ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`
}
