// IG 頁面（經 Firecrawl 轉成 markdown）的解析，給 lib/igSync.ts 用；不依賴其他模組，方便測試

export type ProfilePost = { code: string; url: string; posted?: string; title: string }

export const postUrl = (code: string) => `https://www.instagram.com/p/${code}/`
export const igCode = (url?: string) => url?.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1] ?? null

// 個人頁的 markdown：「- [文案開頭…](https://instagram.com/p/CODE) · 2026-11-17 · 1,103 likes …」
export function parseProfile(md: string): ProfilePost[] {
  const posts: ProfilePost[] = []
  const seen = new Set<string>()
  const re = /\[([^\]]*)\]\((https?:\/\/(?:www\.)?instagram\.com\/(?:[^/)]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)\/?[^)]*)\)([^\n]*)/g
  for (const m of Array.from(md.matchAll(re))) {
    const code = m[3]
    if (seen.has(code)) continue
    seen.add(code)
    posts.push({ code, url: postUrl(code), title: m[1].trim().slice(0, 40), posted: m[4].match(/(\d{4}-\d{2}-\d{2})/)?.[1] })
  }
  return posts
}

// 單篇貼文 markdown：第一行是「# Reel by …」，最後一行是日期與按讚數，中間是文案
export function parseCaption(md: string): { caption: string; posted?: string } {
  const lines = md.split('\n')
  const posted = md.match(/^(\d{4}-\d{2}-\d{2}) · /m)?.[1]
  const caption = lines
    .filter((l) => !/^# /.test(l) && !/^\d{4}-\d{2}-\d{2} · /.test(l))
    .join('\n')
    .trim()
  return { caption, posted }
}

// 座標後備比對用的店名比對，比 nameMatches 嚴：Google 常回百貨本身（Central Chidlom），
// 不能因為百貨裡的店名字含百貨名稱（MUJI Coffee (Central Chidlom)）就當成同一間
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F\u4E00-\u9FFF]+/g, '')
export function sameName(google: string, site: string): boolean {
  const g = normName(google), t = normName(site)
  if (!g || !t) return false
  if (g === t) return true
  const [short, long] = g.length <= t.length ? [g, t] : [t, g]
  // 「Ganesha Shrine」對「Ganesha Shrine (CentralWorld)」：開頭相同、後面接分店名 → 同一間
  // 「Central Chidlom」對「MUJI Coffee (Central Chidlom)」：百貨名接在店名後面 → 不同
  if (short.length >= 5 && long.startsWith(short)) return true
  return long.includes(short) && short.length / long.length >= 0.8
}
