'use client'
import { IconAll, IconFood, IconCafe, IconShopping, IconNightlife, IconHotel } from './icons/CategoryIcons'
import type { Category } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'
import { DragScroll } from './DragScroll'
import { MIcon } from './icons/MaterialIcons'

function IconAttraction({ size = 24 }: { size?: number }) {
  return <MIcon name="attractions" size={size} />
}

type Tab = { id: Category | 'all'; labelKey: keyof typeof strings.zh; Icon: React.ComponentType<{ size?: number }> }

const TABS: Tab[] = [
  { id: 'all',       labelKey: 'categoryAll',       Icon: IconAll },
  { id: 'food',      labelKey: 'categoryFood',      Icon: IconFood },
  { id: 'cafe',      labelKey: 'categoryCafe',      Icon: IconCafe },
  { id: 'shopping',  labelKey: 'categoryShopping',  Icon: IconShopping },
  { id: 'nightlife', labelKey: 'categoryNightlife', Icon: IconNightlife },
  { id: 'hotel',     labelKey: 'categoryHotel',     Icon: IconHotel },
  { id: 'attraction', labelKey: 'categoryAttraction', Icon: IconAttraction },
]

// 筆數不到這個數字的分類不放頁籤：點進去只有一兩家會讓人覺得網站是空的（地點仍會出現在「全部」）
const MIN_TAB_ITEMS = 5

type Props = {
  active: Category | 'all'
  onChange: (cat: Category | 'all') => void
  lang: Lang
  counts?: Partial<Record<Category | 'all', number>>
}

export function CategoryTabs({ active, onChange, lang, counts }: Props) {
  const visibleTabs = counts
    ? TABS.filter(({ id }) => id === 'all' || (counts[id] ?? 0) >= MIN_TAB_ITEMS)
    : TABS

  return (
    <DragScroll className="flex gap-1 px-3 overflow-x-auto no-scrollbar lg:justify-center">
      {visibleTabs.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`shrink-0 flex items-center gap-1.5 px-3 pt-3.5 pb-3 text-[14px] whitespace-nowrap border-b-2 transition-colors ${
            active === id ? 'border-brand text-ink font-bold' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <Icon size={17} />
          {strings[lang][labelKey] as string}
        </button>
      ))}
    </DragScroll>
  )
}
