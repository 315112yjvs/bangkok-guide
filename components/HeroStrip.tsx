'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Location } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { photoUrl } from '@/lib/photo'
import { DragScroll } from './DragScroll'

// 首屏的照片底片條：一排真實店家照片橫跨畫面，最靠中間那張全亮、其餘調暗，
// 正下方寫出那家店的名字。可以滑、可以拖，不攔截直向捲動。

// 照片原圖比例不一，用固定的幾種寬窄輪替，排起來像一條底片
const RATIOS = [0.8, 1.5, 1, 0.75, 1.33, 0.8, 1.5, 1, 0.75, 1.33, 1, 0.8]

export function HeroStrip({ items, lang }: { items: Location[]; lang: Lang }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const row = wrap.current?.firstElementChild as HTMLElement | null
    if (!row) return
    let raf = 0
    const pick = () => {
      raf = 0
      const mid = row.getBoundingClientRect().left + row.clientWidth / 2
      let best = 0, bestD = Infinity
      row.querySelectorAll<HTMLElement>('[data-frame]').forEach((f, i) => {
        const r = f.getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - mid)
        if (d < bestD) { bestD = d; best = i }
      })
      setActive(best)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick) }
    // 一開始把第三張捲到正中間，讓左右兩邊都有被裁切的照片
    const third = row.querySelectorAll<HTMLElement>('[data-frame]')[2]
    if (third) row.scrollLeft = third.offsetLeft + third.offsetWidth / 2 - row.clientWidth / 2
    pick()
    row.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { row.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [items.length])

  const cur = items[active]

  return (
    <div ref={wrap}>
      <DragScroll className="relative flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory lg:cursor-grab">
        {items.map((loc, i) => {
          const name = lang === 'zh' ? loc.name_zh : loc.name_en
          return (
            <Link
              key={loc.id}
              data-frame
              href={`/location/${loc.slug ?? loc.id}`}
              onFocus={(e) => e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })}
              className="relative shrink-0 snap-center h-[44svh] max-h-[340px] min-h-[240px] lg:h-[34vh] overflow-hidden bg-white/5"
              style={{ aspectRatio: RATIOS[i % RATIOS.length] }}
              aria-label={name}
            >
              <Image
                src={photoUrl(loc.photos[0], 640)}
                alt={name}
                fill
                unoptimized
                sizes="(max-width: 768px) 70vw, 420px"
                priority={i < 5}
                className={`object-cover transition-opacity duration-500 ${i === active ? 'opacity-100 strip-drift' : 'opacity-40 hover:opacity-80'}`}
              />
            </Link>
          )
        })}
      </DragScroll>
      <p className="mt-3 min-h-[24px] text-[16px] text-white/90 text-center" aria-live="polite">
        {cur && (
          <>
            {lang === 'zh' ? cur.name_zh : cur.name_en}
            {cur.area && cur.area !== 'Bangkok' && <span className="text-white/60">　{cur.area}</span>}
          </>
        )}
      </p>
    </div>
  )
}
