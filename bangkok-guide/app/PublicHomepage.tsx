'use client'
import { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { LocationCard } from '@/components/LocationCard'
import { LocationMap } from '@/components/LocationMap'
import { SocialEmbed } from '@/components/SocialEmbed'
import type { Location, Category } from '@/lib/types'

type Props = { locations: Location[] }

type SpecialFilter = 'all' | 'trending' | 'local' | 'nearby'

const PAGE_SIZE = 12

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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [restPage, setRestPage] = useState(1)
  const sheetRef = useRef<HTMLDivElement>(null)

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  function requestLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        setSpecialFilter('nearby')
        setRestPage(1)
      },
      () => {
        setLocating(false)
        alert(lang === 'zh' ? '無法取得位置，請確認已開啟定位權限' : 'Could not get location. Please allow location access.')
      },
      { timeout: 10000 }
    )
  }

  function changeFilter(f: SpecialFilter) {
    setSpecialFilter(f)
    setRestPage(1)
  }

  const availableAreas = useMemo(() => {
    const areas = new Set<string>()
    for (const loc of locations) {
      const a = detectArea(loc.address)
      if (a) areas.add(a)
    }
    return Array.from(areas).sort()
  }, [locations])

  const filtered = useMemo(() => {
    const base = locations.filter((loc) => {
      const matchCat = activeCategory === 'all' || loc.category === activeCategory
      const matchArea = activeArea === 'all' || detectArea(loc.address) === activeArea
      const matchSpecial =
        specialFilter === 'all' ||
        specialFilter === 'nearby' ||
        (specialFilter === 'trending' && loc.trending) ||
        (specialFilter === 'local' && (
          loc.source === 'pantip' || loc.source === 'wongnai' || (loc.local_ratio ?? 0) >= 60
        ))
      const q = query.toLowerCase()
      const matchSearch = !q || [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en, loc.address]
        .some((s) => s?.toLowerCase().includes(q))
      return matchCat && matchArea && matchSpecial && matchSearch
    })
    if (specialFilter === 'nearby' && userLocation) {
      return [...base].sort((a, b) =>
        haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      )
    }
    return base
  }, [locations, activeCategory, activeArea, specialFilter, query, userLocation])

  const trending = useMemo(() =>
    specialFilter !== 'all' ? [] : filtered.filter((l) => l.trending).slice(0, 6),
    [filtered, specialFilter]
  )
  const restAll = useMemo(() =>
    specialFilter !== 'all' ? filtered : filtered.filter((l) => !l.trending),
    [filtered, specialFilter]
  )
  const restVisible = restAll.slice(0, restPage * PAGE_SIZE)
  const hasMore = restVisible.length < restAll.length

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen overflow-hidden relative shadow-xl">

      {/* HERO */}
      <div className="sticky top-0 z-0 h-[55vw] max-h-60 min-h-40">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&fit=crop"
            alt="Bangkok"
            fill className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f1428]/90 via-[#0f1428]/50 to-transparent" />
        </div>
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
              onChange={(e) => { setQuery(e.target.value); setRestPage(1) }}
            />
            {query && (
              <button onClick={() => { setQuery(''); setRestPage(1) }} className="text-gray-400 text-sm font-bold">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* MAP strip */}
      <div className="h-36">
        <LocationMap
          locations={filtered}
          lang={lang}
          userLocation={userLocation}
          nearbyMode={specialFilter === 'nearby'}
        />
      </div>

      {/* BOTTOM SHEET */}
      <div ref={sheetRef} className="relative z-10 bg-gray-50 rounded-t-3xl -mt-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="bg-white border-b border-gray-100">
          <CategoryTabs active={activeCategory} onChange={(cat) => { setActiveCategory(cat); changeFilter('all') }} lang={lang} />
        </div>

        <div className="bg-white border-b border-gray-100 py-2 relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-3">
            {([
              { id: 'all',      label: lang === 'zh' ? '全部顯示' : 'All' },
              { id: 'trending', label: lang === 'zh' ? '📈 本週熱門' : '📈 Trending' },
              { id: 'local',    label: lang === 'zh' ? '🇹🇭 在地私藏' : '🇹🇭 Local Picks' },
            ] as { id: SpecialFilter; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => changeFilter(id)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                  specialFilter === id
                    ? 'bg-[#1e1b4b] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                if (specialFilter === 'nearby') { changeFilter('all'); return }
                if (userLocation) { changeFilter('nearby'); return }
                requestLocation()
              }}
              disabled={locating}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                specialFilter === 'nearby'
                  ? 'bg-[#1e1b4b] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {locating ? '⏳' : '📍'} {lang === 'zh' ? '附近' : 'Near Me'}
            </button>
            <div className="w-px bg-gray-200 mx-0.5" />
            {availableAreas.map((area) => (
              <button
                key={area}
                onClick={() => { setActiveArea(activeArea === area ? 'all' : area); setRestPage(1) }}
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
          <section className="mx-3 mt-4 mb-2 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="bg-[#1a1a2e] px-4 py-3.5">
              <p className="text-white font-black text-[15px] tracking-tight leading-tight">{strings[lang].trendingSection as string}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{lang === 'zh' ? '本週曼谷最夯打卡點' : 'Most-talked spots this week'}</p>
            </div>
            <div className="bg-gray-50">
              <div className="flex gap-3 overflow-x-auto no-scrollbar p-3 pb-4">
                {trending.map((loc) => (
                  <div key={loc.id} className="shrink-0 w-44">
                    <LocationCard location={loc} lang={lang} distanceKm={userLocation ? haversineKm(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : undefined} />
                  </div>
                ))}
              </div>
              {trending.some((l) => l.social_embed_url) && (
                <div className="px-3 pb-4 space-y-4 border-t border-gray-100 pt-3">
                  {trending.filter((l) => l.social_embed_url).map((loc) => (
                    <div key={loc.id}>
                      <p className="text-[11px] font-bold text-gray-500 mb-2">{lang === 'zh' ? loc.name_zh : loc.name_en}</p>
                      <SocialEmbed url={loc.social_embed_url!} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Main list */}
        {restVisible.length > 0 && (
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
              {restVisible.map((loc) => <LocationCard key={loc.id} location={loc} lang={lang} distanceKm={userLocation ? haversineKm(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : undefined} />)}
            </div>
            {hasMore && (
              <button
                onClick={() => setRestPage((p) => p + 1)}
                className="mt-4 w-full py-3 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {lang === 'zh' ? `顯示更多 (${restAll.length - restVisible.length} 筆)` : `Load more (${restAll.length - restVisible.length})`}
              </button>
            )}
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
