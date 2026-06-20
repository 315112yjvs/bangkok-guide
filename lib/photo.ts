// 預設後備圖（照片載入失敗或無照片時）
export const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1552911180-2a7279af1b85?w=400&h=300&fit=crop'

// 把 Google Places 照片 ref 轉成自家代理網址（經 /api/photo + CDN 快取，
// Google 只會被打一次，且不外露 API key）。已是完整網址的就原樣回傳。
export function photoUrl(ref: string | undefined | null, w = 800): string {
  if (!ref) return FALLBACK_PHOTO
  if (ref.startsWith('places/')) return `/api/photo?ref=${encodeURIComponent(ref)}&w=${w}`
  return ref
}
