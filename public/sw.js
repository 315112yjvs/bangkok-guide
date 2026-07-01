// 曼谷人 PWA service worker — 保守策略：頁面/資料一律網路優先（線上永遠看到最新）。
// 靜態資源分兩種：有內容雜湊的（/_next/static、/fonts）走快取優先；
// 根目錄圖檔（favicon/icon/logo/hero 等，網址不會變）走 stale-while-revalidate，
// 先回快取但背景抓新版，換圖後下次就會更新，不會卡舊 icon。
const CACHE = 'bkk-local-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      // 清掉所有舊版快取（含卡住的舊 icon）
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
)

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 內容雜湊、永不變 → 快取優先
  const isImmutable =
    url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')

  if (isImmutable) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })
    )
    return
  }

  // 根目錄圖檔（網址固定但內容會換）→ stale-while-revalidate
  const isImage = /\.(?:png|jpg|jpeg|webp|svg|ico|gif)$/.test(url.pathname)
  if (isImage) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        const fetching = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || fetching
      })
    )
    return
  }

  // 頁面與資料 → 網路優先，離線時才回快取
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === 'navigate') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req))
  )
})
