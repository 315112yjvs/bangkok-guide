'use client'
import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { LocationCard } from '@/components/LocationCard'
import { LocationMap } from '@/components/LocationMap'
import type { Location, Category } from '@/lib/types'

type Props = { locations: Location[] }

// Known Bangkok neighborhoods (match against address)
const NEIGHBORHOODS = [
  'Sukhumvit', 'Silom', 'Sathorn', 'Siam', 'Ari', 'Thonglor',
  'Ekkamai', 'Phrom Phong', 'Asok', 'Nana', 'Ratchada',
  'Chatuchak', 'Yaowarat', 'Chinatown', 'Rattanakosin',
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
  const [activeArea, setActiveArea] = useState<string>('all')
  const [query, setQuery] = useState('')

  // Compute available areas from data
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
      const q = query.toLowerCase()
      const matchSearch = !q || [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en, loc.address]
        .some((s) => s?.toLowerCase().includes(q))
      return matchCat && matchArea && matchSearch
    })
  }, [locations, activeCategory, activeArea, query])

  const trending = useMemo(() => filtered.filter((l) => l.trending).slice(0, 6), [filtered])
  const rest = useMemo(() => filtered.filter((l) => !l.trending), [filtered])

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen shadow-xl">
      {/* HERO */}
      <div className="relative h-52 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&fit=crop"
          alt="Bangkok skyline"
          fill className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1428]/80 via-[#0f1428]/50 to-[#0f1428]/70" />
        <div className="relative z-10 p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-auto">
            <span className="text-white/60 text-xs font-bold uppercase tracking-widest">{strings[lang].siteName as string}</span>
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
          <div>
            <h1 className="text-white text-2xl font-black leading-tight">
              {strings[lang].heroTitle as string}{' '}
              <span className="text-amber-400">{strings[lang].heroTitleAccent as string}</span>
            </h1>
            <p className="text-white/60 text-xs mt-1 mb-3">{strings[lang].heroSubtitle as string}</p>
            {/* Search bar */}
            <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-lg">
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
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <CategoryTabs active={activeCategory} onChange={setActiveCategory} lang={lang} />
      </div>

      {/* AREA FILTER */}
      {availableAreas.length > 0 && (
        <div className="bg-white px-3 py-2 border-b border-gray-100 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            <button
              onClick={() => setActiveArea('all')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                activeArea === 'all'
                  ? 'bg-[#1e1b4b] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {strings[lang].areaAll as string}
            </button>
            {availableAreas.map((area) => (
              <button
                key={area}
                onClick={() => setActiveArea(activeArea === area ? 'all' : area)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                  activeArea === area
                    ? 'bg-[#1e1b4b] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MAP */}
      <LocationMap locations={filtered} lang={lang} />

      {/* TREND RADAR */}
      {trending.length > 0 && (
        <section className="px-3 pt-5 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[11px] font-black px-3 py-1 rounded-full">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C10 7 5 8 5 13c0 4.5 3 7 7 7s7-2.5 7-7c0-5-5-6-7-11z"/>
              </svg>
              {strings[lang].trendingSection as string}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-orange-200 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {trending.map((loc) => <LocationCard key={loc.id} location={loc} lang={lang} />)}
          </div>
        </section>
      )}

      {/* REST */}
      {rest.length > 0 && (
        <section className="px-3 pt-4 pb-8">
          {trending.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
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
  )
}
