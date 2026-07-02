'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// 滑動進場動畫：元素捲進視窗時淡入上移一次。
// 全站共用一個 IntersectionObserver（幾百張卡片也只有一個 observer，省效能），
// prefers-reduced-motion 時由 globals.css 直接停用動畫。
let sharedObserver: IntersectionObserver | null = null
const onEnter = new WeakMap<Element, () => void>()

function observe(el: Element, cb: () => void) {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          onEnter.get(e.target)?.()
          sharedObserver!.unobserve(e.target)
          onEnter.delete(e.target)
        }
      },
      // 底部預留 32px：元素稍微進畫面才觸發，避免邊緣半格就閃動畫
      { rootMargin: '0px 0px -32px 0px', threshold: 0.05 }
    )
  }
  onEnter.set(el, cb)
  sharedObserver.observe(el)
}

type Props = {
  children: ReactNode
  /** 進場延遲（ms），用來做同排卡片的錯落感 */
  delay?: number
  className?: string
}

export function Reveal({ children, delay = 0, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 不支援 IO 的舊瀏覽器直接顯示，不做動畫
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    observe(el, () => setShown(true))
    return () => { sharedObserver?.unobserve(el); onEnter.delete(el) }
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'reveal-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
