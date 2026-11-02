// 換頁轉場：點卡片時，卡片照片放大移動成地點頁最上面的大圖（瀏覽器原生 View Transitions）。
// 不支援的瀏覽器、或使用者關閉動態效果時，直接換頁。
type Router = { push: (href: string) => void }

let pendingReady: (() => void) | null = null

export function navigateWithPhoto(router: Router, href: string, photoEl: HTMLElement | null) {
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    router.push(href)
    return
  }
  if (photoEl) photoEl.style.viewTransitionName = 'loc-photo'
  doc.startViewTransition(() => new Promise<void>((resolve) => {
    const done = () => { pendingReady = null; resolve() }
    pendingReady = done
    // 新頁面太慢出來時不要一直卡在轉場裡
    setTimeout(done, 1500)
    router.push(href)
  }))
}

// 地點頁畫好時呼叫，轉場才拍下新畫面
export function markPhotoPageReady() {
  pendingReady?.()
}
