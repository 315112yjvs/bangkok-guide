'use client'
import { useRef, type ReactNode } from 'react'

type Props = { className?: string; children: ReactNode }

/**
 * 橫向捲動容器：手機照常用手指滑，電腦版可以按住滑鼠左鍵拖拉。
 * 拖拉超過門檻就攔掉後續 click，避免拖到一半誤開卡片連結。
 */
export function DragScroll({ className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, dragged: false, startX: 0, startScroll: 0 })

  const endDrag = () => {
    drag.current.down = false
    if (ref.current) {
      ref.current.style.userSelect = ''
      ref.current.classList.remove('drag-scrolling')
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      onPointerDown={(e) => {
        // 只處理滑鼠左鍵；觸控交給瀏覽器原生捲動
        if (e.pointerType !== 'mouse' || e.button !== 0) return
        drag.current = { down: true, dragged: false, startX: e.clientX, startScroll: ref.current!.scrollLeft }
      }}
      onPointerMove={(e) => {
        const s = drag.current
        if (!s.down || !ref.current) return
        // 左鍵已放開（例如移出容器後在外面放開，pointerup 沒送到這裡）就結束，
        // 不然游標滑回來時會在沒按鍵的狀態下繼續捲動
        if ((e.buttons & 1) === 0) { endDrag(); return }
        const dx = e.clientX - s.startX
        if (!s.dragged) {
          if (Math.abs(dx) < 5) return
          s.dragged = true
          ref.current.setPointerCapture(e.pointerId)
          ref.current.style.userSelect = 'none'
          ref.current.classList.add('drag-scrolling')
        }
        ref.current.scrollLeft = s.startScroll - dx
      }}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        endDrag()
        drag.current.dragged = false
      }}
      onClickCapture={(e) => {
        // 剛拖拉完的那一下 click 吃掉，不讓它觸發卡片連結
        if (drag.current.dragged) {
          e.preventDefault()
          e.stopPropagation()
          drag.current.dragged = false
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}
