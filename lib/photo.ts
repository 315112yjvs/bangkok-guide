import type { CSSProperties } from 'react'
// 預設後備圖（照片載入失敗或無照片時）
export const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1552911180-2a7279af1b85?w=400&h=300&fit=crop'

// 照片網址有兩種來源：
// 1) 本機檔 `/photos/<地點 id>/<n>.jpg`：已用 scripts/download-photos.py 下載的店，直接由網站提供，
//    不經過 Google，沒有照片費。封面另有一張 480px 的小圖 `0-480.jpg` 給卡片用。
// 2) Google Places 照片 ref（`places/...`）：新上架還沒下載的店，走 /api/photo 代理，每張向 Google 計費。
export function photoUrl(ref: string | undefined | null, w = 800): string {
  if (!ref) return FALLBACK_PHOTO
  // 有 480px 小圖的：Google 下載的封面 0.jpg、後台上傳的 u-xxxx.jpg
  if (ref.startsWith('/photos/')) return w <= 480 ? ref.replace(/\/(0|u-[0-9a-f]+)\.jpg$/, '/$1-480.jpg') : ref
  if (ref.startsWith('places/')) return `/api/photo?ref=${encodeURIComponent(ref)}&w=${w}`
  return ref
}

// 直的照片放進橫的框只露出中間一段；有記錄文字位置（photo_focus）就把那一段移到畫面中間。
// 以卡片大約露出照片高度 42% 估算 object-position，讓文字中心落在框的正中央
export function photoPosition(focus: Record<string, number> | undefined, ref: string | undefined): CSSProperties | undefined {
  const c = ref ? focus?.[ref] : undefined
  if (c === undefined) return undefined
  const v = 0.42
  const pos = Math.max(0, Math.min(1, (c / 100 - v / 2) / (1 - v)))
  return { objectPosition: `50% ${Math.round(pos * 100)}%` }
}
