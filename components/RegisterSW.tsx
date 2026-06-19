'use client'
import { useEffect } from 'react'

export function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    if (isLocal) {
      // 本機開發不要註冊 Service Worker，並清掉舊的 SW 與快取，
      // 否則舊 SW 會餵過期的資源檔，造成樣式不見 / 路由 404 等怪問題。
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
      if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      return
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
