'use client'
import { IconAll, IconFood, IconCafe, IconShopping, IconNightlife, IconHotel, IconTemple } from './icons/CategoryIcons'
import { isHiddenCategory } from '@/lib/site'
import type { Category } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'
import { useLayoutEffect, useRef, useState } from 'react'
import { DragScroll } from './DragScroll'
import { Icon, MIcon } from './icons/Icon'

function IconAttraction({ size = 24 }: { size?: number }) {
  return <MIcon name="attractions" size={size} />
}

function IconRoutes({ size = 24 }: { size?: number }) {
  return <Icon name="route" size={size} strokeWidth={1.8} />
}

// 首頁頁籤：各分類 + 一日路線（路線不是店的分類，點了改列路線卡片）
export type HomeTab = Category | 'all' | 'routes'

type Tab = { id: HomeTab; labelKey: keyof typeof strings.zh; Icon: React.ComponentType<{ size?: number }> }

const TABS: Tab[] = [
  { id: 'all',       labelKey: 'categoryAll',       Icon: IconAll },
  { id: 'temple',    labelKey: 'categoryTemple',    Icon: IconTemple },
  { id: 'food',      labelKey: 'categoryFood',      Icon: IconFood },
  { id: 'cafe',      labelKey: 'categoryCafe',      Icon: IconCafe },
  { id: 'routes',    labelKey: 'categoryRoutes',    Icon: IconRoutes },
  { id: 'shopping',  labelKey: 'categoryShopping',  Icon: IconShopping },
  { id: 'nightlife', labelKey: 'categoryNightlife', Icon: IconNightlife },
  { id: 'hotel',     labelKey: 'categoryHotel',     Icon: IconHotel },
  { id: 'attraction', labelKey: 'categoryAttraction', Icon: IconAttraction },
]

// 筆數不到這個數字的分類不放頁籤：點進去只有一兩家會讓人覺得網站是空的（地點仍會出現在「全部」）
const MIN_TAB_ITEMS = 5

type Props = {
  active: HomeTab
  onChange: (cat: HomeTab) => void
  lang: Lang
  counts?: Partial<Record<Category | 'all', number>>
}

export function CategoryTabs({ active, onChange, lang, counts }: Props) {
  const visibleTabs = TABS.filter(({ id }) =>
    id === 'all' || id === 'routes' || (!isHiddenCategory(id) && (!counts || (counts[id] ?? 0) >= MIN_TAB_ITEMS)))

  // 選中頁籤底下的藍線：量出選中按鈕的位置，用 transform 滑過去（量到之前先用按鈕自己的底線）
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current.get(active)
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    // 字型載入或視窗寬度改變時重量
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure)
    return () => window.removeEventListener('resize', measure)
  }, [active, visibleTabs.length, lang])

  return (
    <DragScroll className="relative flex gap-1 px-3 overflow-x-auto no-scrollbar lg:justify-center">
      {bar && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 w-[100px] bg-brand origin-left transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w / 100})` }}
        />
      )}
      {visibleTabs.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          ref={(el) => { if (el) tabRefs.current.set(id, el); else tabRefs.current.delete(id) }}
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`tap shrink-0 flex items-center gap-1.5 px-3 pt-3.5 pb-3 text-[14px] whitespace-nowrap border-b-2 ${
            active === id ? `${bar ? 'border-transparent' : 'border-brand'} text-ink font-bold` : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <Icon size={17} />
          {strings[lang][labelKey] as string}
        </button>
      ))}
    </DragScroll>
  )
}
