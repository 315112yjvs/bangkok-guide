// 曼谷人 PWA service worker — 保守策略：頁面/資料一律網路優先（線上永遠看到最新），
// 只有靜態資源走快取優先，離線時才用快取備援。避免線上看到舊內容。
const CACHE = 'bkk-local-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|otf|woff2?)$/.test(url.pathname)

  if (isStatic) {
    // 靜態資源（內容雜湊、不會變）→ 快取優先
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
