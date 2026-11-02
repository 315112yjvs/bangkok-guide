'use client'
import type { Category } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'
import { DragScroll } from './DragScroll'

type Tab = { id: Category | 'all'; labelKey: keyof typeof strings.zh }

const TABS: Tab[] = [
  { id: 'all',       labelKey: 'categoryAll' },
  { id: 'food',      labelKey: 'categoryFood' },
  { id: 'cafe',      labelKey: 'categoryCafe' },
  { id: 'shopping',  labelKey: 'categoryShopping' },
  { id: 'nightlife', labelKey: 'categoryNightlife' },
  { id: 'hotel',     labelKey: 'categoryHotel' },
  { id: 'attraction', labelKey: 'categoryAttraction' },
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
    <DragScroll className="flex gap-1 px-3 overflow-x-auto no-scrollbar">
      {visibleTabs.map(({ id, labelKey }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`ed-press ed-serif shrink-0 px-3 py-2 text-[20px] whitespace-nowrap transition-colors ${
            active === id ? 'text-[var(--ed-ink)] ed-current' : 'text-[var(--ed-muted)] hover:text-[var(--ed-ink)]'
          }`}
        >
          {strings[lang][labelKey] as string}
        </button>
      ))}
    </DragScroll>
  )
}
