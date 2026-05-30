'use client'
import { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { LocationCard } from '@/components/LocationCard'
import { LocationMap } from '@/components/LocationMap'
import type { Location, Category } from '@/lib/types'

type Props = { locations: Location[] }

type SpecialFilter = 'all' | 'trending' | 'local'

const NEIGHBORHOODS = [
  'Sukhumvit', 'Silom', 'Sathorn', 'Siam', 'Ari', 'Thonglor',
  'Ekkamai', 'Phrom Phong', 'Asok', 'Nana', 'Ratchada',
  'Chatuchak', 'Yaowarat', 'Chinatown',
]

function detectArea(address: string): string | null {
  const lower = address.toLowerCase()
  for (const n of NEIGHBORHOODS) {
    if (lower.includes(n.toLowerCase())) return n
  }
  return null
}

export function PublicHomepage({ locations }: Props) {
  const { lang, setLang } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>('all')
  const [activeArea, setActiveArea] = useState('all')
  const [query, setQuery] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)

  const availableAreas = useMemo(() => {
    const areas = new Set<string>()
    for (const loc of locations) {
      const a = detectArea(loc.address)
      if (a) areas.add(a)
    }
    return Array.from(areas).sort()
  }, [locations])

  const filtered = useMemo(() => {
    return locations.filter((loc) => {
      const matchCat = activeCategory === 'all' || loc.category === activeCategory
      const matchArea = activeArea === 'all' || detectArea(loc.address) === activeArea
      const matchSpecial =
        specialFilter === 'all' ||
        (specialFilter === 'trending' && loc.trending) ||
        (specialFilter === 'local' && (
          loc.source === 'pantip' || loc.source === 'wongnai' || (loc.local_ratio ?? 0) >= 60
        ))
      const q = query.toLowerCase()
      const matchSearch = !q || [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en, loc.address]
        .some((s) => s?.toLowerCase().includes(q))
      return matchCat && matchArea && matchSpecial && matchSearch
    })
  }, [locations, activeCategory, activeArea, specialFilter, query])

  const trending = useMemo(() =>
    specialFilter !== 'all' ? [] : filtered.filter((l) => l.trending).slice(0, 6),
    [filtered, specialFilter]
  )
  const rest = useMemo(() =>
    specialFilter !== 'all' ? filtered : filtered.filter((l) => !l.trending),
    [filtered, specialFilter]
  )

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen overflow-hidden relative shadow-xl">

      {/* HERO + MAP layer (fixed behind sheet) */}
      <div className="sticky top-0 z-0 h-[55vw] max-h-60 min-h-40">
        {/* Hero image */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&fit=crop"
            alt="Bangkok"
            fill className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f1428]/90 via-[#0f1428]/50 to-transparent" />
        </div>

        {/* Hero text + search */}
        <div className="relative z-10 p-4 pb-2 flex flex-col h-full">
          <div className="flex justify-between items-start mb-1">
            <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{strings[lang].siteName as string}</span>
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
          <h1 className="text-white text-xl font-black leading-tight">
            {strings[lang].heroTitle as string}{' '}
            <span className="text-amber-400">{strings[lang].heroTitleAccent as string}</span>
          </h1>
          <p className="text-white/60 text-[11px] mt-0.5 mb-2">{strings[lang].heroSubtitle as string}</p>
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-2xl px-3 py-2.5 shadow-lg">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
            </svg>
            <input
              className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
              placeholder={strings[lang].searchPlaceholder as string}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 text-sm font-bold">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* MAP strip */}
      <div className="h-36">
        <LocationMap locations={filtered} lang={lang} />
      </div>

      {/* BOTTOM SHEET */}
      <div ref={sheetRef} className="relative z-10 bg-gray-50 rounded-t-3xl -mt-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-100">
          <CategoryTabs active={activeCategory} onChange={(cat) => { setActiveCategory(cat); setSpecialFilter('all') }} lang={lang} />
        </div>

        {/* Special filter chips */}
        <div className="bg-white border-b border-gray-100 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {([
              { id: 'all',      label: lang === 'zh' ? '全部顯示' : 'All',          icon: '' },
              { id: 'trending', label: lang === 'zh' ? '📈 本週熱門' : '📈 Trending', icon: '' },
              { id: 'local',    label: lang === 'zh' ? '🇹🇭 在地私藏' : '🇹🇭 Local Picks', icon: '' },
            ] as { id: SpecialFilter; label: string; icon: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSpecialFilter(id)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                  specialFilter === id
                    ? 'bg-[#1e1b4b] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-0.5" />
            {/* Area chips */}
            {availableAreas.map((area) => (
              <button
                key={area}
                onClick={() => setActiveArea(activeArea === area ? 'all' : area)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                  activeArea === area
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* TREND RADAR */}
        {trending.length > 0 && (
          <section className="px-3 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1">
                🔥 {strings[lang].trendingSection as string}
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-orange-200 to-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {trending.map((loc) => <LocationCard key={loc.id} location={loc} lang={lang} />)}
            </div>
          </section>
        )}

        {/* Main list */}
        {rest.length > 0 && (
          <section className="px-3 pt-3 pb-10">
            {trending.length > 0 && (
              <div className="flex items-center gap-2 mb-3 mt-1">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[11px] text-gray-400 font-semibold">
                  {lang === 'zh' ? '更多地點' : 'More Places'}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {rest.map((loc) => <LocationCard key={loc.id} location={loc} lang={lang} />)}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-sm">{strings[lang].emptyState as string}</p>
          </div>
        )}
      </div>
    </div>
  )
}
