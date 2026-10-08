// 預設後備圖（照片載入失敗或無照片時）
export const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1552911180-2a7279af1b85?w=400&h=300&fit=crop'

// 照片網址有兩種來源：
// 1) 本機檔 `/photos/<地點 id>/<n>.jpg`：已用 scripts/download-photos.py 下載的店，直接由網站提供，
//    不經過 Google，沒有照片費。封面另有一張 480px 的小圖 `0-480.jpg` 給卡片用。
// 2) Google Places 照片 ref（`places/...`）：新上架還沒下載的店，走 /api/photo 代理，每張向 Google 計費。
export function photoUrl(ref: string | undefined | null, w = 800): string {
  if (!ref) return FALLBACK_PHOTO
  if (ref.startsWith('/photos/')) return w <= 480 ? ref.replace(/\/0\.jpg$/, '/0-480.jpg') : ref
  if (ref.startsWith('places/')) return `/api/photo?ref=${encodeURIComponent(ref)}&w=${w}`
  return ref
}
