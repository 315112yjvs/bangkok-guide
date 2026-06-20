'use client'
import { IconAll, IconFood, IconCafe, IconShopping, IconNightlife, IconHotel } from './icons/CategoryIcons'
import type { Category } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

type Tab = { id: Category | 'all'; labelKey: keyof typeof strings.zh; Icon: React.ComponentType<{ size?: number }> }

const TABS: Tab[] = [
  { id: 'all',       labelKey: 'categoryAll',       Icon: IconAll },
  { id: 'food',      labelKey: 'categoryFood',      Icon: IconFood },
  { id: 'cafe',      labelKey: 'categoryCafe',      Icon: IconCafe },
  { id: 'shopping',  labelKey: 'categoryShopping',  Icon: IconShopping },
  { id: 'nightlife', labelKey: 'categoryNightlife', Icon: IconNightlife },
  { id: 'hotel',     labelKey: 'categoryHotel',     Icon: IconHotel },
]

const TAB_COLORS: Record<string, string> = {
  all:       'bg-[#1e1b4b]',
  food:      'bg-gradient-to-br from-red-600 to-orange-500',
  cafe:      'bg-gradient-to-br from-amber-900 to-amber-600',
  shopping:  'bg-gradient-to-br from-emerald-800 to-emerald-500',
  nightlife: 'bg-gradient-to-br from-indigo-900 to-violet-700',
  hotel:     'bg-gradient-to-br from-sky-700 to-sky-400',
}

type Props = {
  active: Category | 'all'
  onChange: (cat: Category | 'all') => void
  lang: Lang
  counts?: Partial<Record<Category | 'all', number>>
}

export function CategoryTabs({ active, onChange, lang, counts }: Props) {
  const visibleTabs = counts
    ? TABS.filter(({ id }) => id === 'all' || (counts[id] ?? 0) > 0)
    : TABS

  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto bg-white border-b border-gray-100 no-scrollbar lg:justify-center">
      {visibleTabs.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="flex flex-col items-center gap-1.5 min-w-[52px] group"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-transform group-hover:scale-105 ${
            active === id ? TAB_COLORS[id] + ' scale-105 ring-2 ring-offset-1 ring-current' : TAB_COLORS[id] + ' opacity-70'
          }`}>
            <Icon size={22} />
          </div>
          <span className={`text-[10px] font-semibold ${active === id ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>
            {strings[lang][labelKey] as string}
          </span>
        </button>
      ))}
    </div>
  )
}
