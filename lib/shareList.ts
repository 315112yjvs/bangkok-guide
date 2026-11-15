// 收藏清單分享：網址只帶每間店 id 的前 8 碼（用 . 隔開），20 間店約 180 字，LINE 也貼得下
export const LIST_ID_LEN = 8

export function encodeList(ids: string[]): string {
  return ids.map((id) => id.slice(0, LIST_ID_LEN)).join('.')
}

export function decodeList(p: string | undefined): string[] {
  if (!p) return []
  return Array.from(new Set(p.split('.').filter((s) => /^[0-9a-f]{8}$/.test(s)))).slice(0, 100)
}
