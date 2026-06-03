'use client'
import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { LocationCard } from '@/components/LocationCard'
import { LocationMap } from '@/components/LocationMap'
import type { Location, Category, LocationTag } from '@/lib/types'

type Props = { locations: Location[] }

const TAG_META: Record<LocationTag, { emoji: string; zh: string; en: string; color: string }> = {
  trending:    { emoji: '🔥', zh: '本週熱門', en: 'Trending Now',    color: 'from-orange-600 to-amber-500' },
  hidden_gem:  { emoji: '🗺', zh: '在地私藏', en: 'Hidden Gems',     color: 'from-emerald-700 to-teal-500' },
  new_opening: { emoji: '✨', zh: '新開幕',   en: 'Just Opened',     color: 'from-violet-600 to-purple-400' },
  evergreen:   { emoji: '📌', zh: '長青推薦', en: 'Always Good',     color: 'from-blue-700 to-sky-500' },
}

const TAG_ORDER: LocationTag[] = ['trending', 'hidden_gem', 'new_opening']

function resolveTag(loc: Location): LocationTag {
  if (loc.tag) return loc.tag
  // backward-compat: old JSON has `trending: boolean`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((loc as any).trending === true) return 'trending'
  return 'evergreen'
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type SpecialFilter = 'all' | 'nearby' | 'saved'

export function PublicHomepage({ locations }: Props) {
  const { lang, setLang } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [activeTag, setActiveTag] = useState<LocationTag | 'all'>('all')
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>('all')
  const [query, setQuery] = useState('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem('saved_locations') ?? '[]')
    setSavedIds(new Set(ids))
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    let firstFix = true
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        if (firstFix) {
          firstFix = false
          setSpecialFilter('nearby')
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleToggleSave(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('saved_locations', JSON.stringify(Array.from(next)))
      return next
    })
  }

  function requestLocation() {
    if (userLocation) { setSpecialFilter('nearby'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        setSpecialFilter('nearby')
      },
      () => setLocating(false),
      { timeout: 10000 }
    )
  }

  const filtered = useMemo(() => {
    const base = locations.filter((loc) => {
      const matchCat = activeCategory === 'all' || loc.category === activeCategory
      const matchTag = activeTag === 'all' || resolveTag(loc) === activeTag
      const matchSpecial =
        specialFilter === 'all' ||
        specialFilter === 'nearby' ||
        (specialFilter === 'saved' && savedIds.has(loc.id))
      const q = query.toLowerCase()
      const matchSearch = !q || [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en, loc.address, ...(loc.highlights ?? [])]
        .some((s) => s?.toLowerCase().includes(q))
      return matchCat && matchTag && matchSpecial && matchSearch
    })
    if (specialFilter === 'nearby' && userLocation) {
      return [...base]
        .filter((l) => haversineKm(userLocation.lat, userLocation.lng, l.lat, l.lng) <= 5)
        .sort((a, b) =>
          haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
        )
    }
    return base
  }, [locations, activeCategory, activeTag, specialFilter, query, userLocation, savedIds])

  const showSections = specialFilter === 'all' && activeTag === 'all' && !query

  const sectionsByTag = useMemo(() => {
    if (!showSections) return null
    const map: Partial<Record<LocationTag, Location[]>> = {}
    for (const tag of TAG_ORDER) {
      const items = filtered.filter((l) => resolveTag(l) === tag)
      if (items.length > 0) map[tag] = items
    }
    return map
  }, [filtered, showSections])

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen overflow-hidden relative shadow-xl">

      {/* HERO */}
      <div className="sticky top-0 z-0 h-[68vw] max-h-80 min-h-52 overflow-hidden">
        {/* Photo — full brightness, gradient does the work */}
        <Image
          src="/hero-bangkok.jpg"
          alt="Bangkok"
          fill className="object-cover object-center"
          priority
        />
        {/* Gradient: dark at very top (for readability) + heavy at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />

        <div className="relative z-10 h-full flex flex-col">
          {/* Top bar */}
          <div className="flex justify-between items-center px-4 pt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-white/70 text-[9px] font-bold tracking-[0.15em] uppercase">{strings[lang].siteName as string}</span>
            </div>
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>

          {/* Push content to bottom */}
          <div className="flex-1" />

          {/* Bottom editorial block */}
          <div className="px-4 pb-4">
            {/* Live badge */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="inline-flex items-center gap-1 bg-orange-500/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="text-white/40 text-[10px]">{lang === 'zh' ? '每日更新 · 泰國社群精選' : 'Daily updates · Thai social picks'}</span>
            </div>

            {/* Title */}
            <h1 className="font-black leading-[1.1] mb-1">
              <span className="text-[26px] text-white block">{strings[lang].heroTitle as string}</span>
              <span className="text-[26px] text-amber-400 block">{strings[lang].heroTitleAccent as string}</span>
            </h1>

            {/* Search — frosted glass pill */}
            <div className="mt-3 flex items-center gap-2 bg-white/12 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5">
              <svg className="w-3.5 h-3.5 text-white/50 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input
                className="flex-1 text-[13px] outline-none text-white placeholder-white/40 bg-transparent"
                placeholder={strings[lang].searchPlaceholder as string}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-white/50 font-bold text-sm leading-none">✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAP strip */}
      <div className="h-56">
        <LocationMap
          locations={filtered}
          lang={lang}
          userLocation={userLocation}
          nearbyMode={specialFilter === 'nearby'}
        />
      </div>

      {/* BOTTOM SHEET */}
      <div className="relative z-10 bg-gray-50 rounded-t-3xl -mt-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-100">
          <CategoryTabs
            active={activeCategory}
            onChange={(cat) => { setActiveCategory(cat); setActiveTag('all') }}
            lang={lang}
          />
        </div>

        {/* Filter row */}
        <div className="bg-white border-b border-gray-100 py-2 relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-3">
            {/* Nearby */}
            <button
              onClick={() => {
                if (specialFilter === 'nearby') { setSpecialFilter('all'); return }
                if (userLocation) { setSpecialFilter('nearby'); return }
                requestLocation()
              }}
              disabled={locating}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                specialFilter === 'nearby'
                  ? 'bg-[#1e1b4b] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {locating
                ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
              }
              {lang === 'zh' ? '附近' : 'Near Me'}
            </button>
            {/* Saved */}
            <button
              onClick={() => setSpecialFilter(specialFilter === 'saved' ? 'all' : 'saved')}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                specialFilter === 'saved'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={specialFilter === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {lang === 'zh' ? '我的收藏' : 'Saved'}
              {savedIds.size > 0 && <span className={`text-[9px] font-black ${specialFilter === 'saved' ? 'text-white/80' : 'text-red-400'}`}>{savedIds.size}</span>}
            </button>
            <div className="w-px bg-gray-200 mx-0.5" />
            {/* Tag filters */}
            {TAG_ORDER.map((tag) => {
              const m = TAG_META[tag]
              return (
                <button
                  key={tag}
                  onClick={() => { setActiveTag(activeTag === tag ? 'all' : tag); setSpecialFilter('all') }}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                    activeTag === tag
                      ? 'bg-[#1e1b4b] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {m.emoji} {lang === 'zh' ? m.zh : m.en}
                </button>
              )
            })}
          </div>
        </div>

        {/* 4-section view (default) */}
        {showSections && sectionsByTag && (
          <div className="pb-10">
            {TAG_ORDER.map((tag) => {
              const items = sectionsByTag[tag]
              if (!items || items.length === 0) return null
              const meta = TAG_META[tag]
              return (
                <section key={tag} className="mt-4">
                  {/* Section header */}
                  <div className={`mx-3 rounded-2xl bg-gradient-to-r ${meta.color} px-4 py-3 flex items-center justify-between mb-2`}>
                    <div>
                      <p className="text-white font-black text-[15px] tracking-tight leading-tight">
                        {meta.emoji} {lang === 'zh' ? meta.zh : meta.en}
                      </p>
                      <p className="text-white/50 text-[10px] mt-0.5">
                        {lang === 'zh'
                          ? tag === 'trending' ? '本週曼谷話題精選' : tag === 'hidden_gem' ? '在地人才知道的地方' : tag === 'new_opening' ? '最新開幕，搶先體驗' : '經典不敗，值得回訪'
                          : tag === 'trending' ? 'Bangkok buzz this week' : tag === 'hidden_gem' ? "Locals' best-kept secrets" : tag === 'new_opening' ? 'Be the first to visit' : 'Timeless picks, always worth it'}
                      </p>
                    </div>
                    <span className="text-[10px] font-black bg-white/20 text-white px-2.5 py-1 rounded-full shrink-0">
                      {items.length} {lang === 'zh' ? '筆' : 'places'}
                    </span>
                  </div>
                  {/* Horizontal scroll cards */}
                  <div className="flex gap-3 overflow-x-auto no-scrollbar px-3 pb-1">
                    {items.map((loc) => (
                      <div key={loc.id} className="shrink-0 w-44">
                        <LocationCard
                          location={loc}
                          lang={lang}
                          distanceKm={userLocation ? haversineKm(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : undefined}
                          saved={savedIds.has(loc.id)}
                          onToggleSave={handleToggleSave}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* Filtered / search view */}
        {!showSections && (
          <section className="px-3 pt-3 pb-10">
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((loc) => (
                  <LocationCard
                    key={loc.id}
                    location={loc}
                    lang={lang}
                    distanceKm={userLocation ? haversineKm(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : undefined}
                    saved={savedIds.has(loc.id)}
                    onToggleSave={handleToggleSave}
                    compact
                  />
                ))}
              </div>
            ) : specialFilter === 'saved' ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-8">
                <svg className="w-12 h-12 mb-4 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <p className="text-sm font-bold text-gray-400 mb-1">{lang === 'zh' ? '還沒有收藏任何地點' : 'No saved places yet'}</p>
                <p className="text-xs text-gray-300 text-center">{lang === 'zh' ? '點擊卡片上的 ♡ 加入收藏清單' : 'Tap ♡ on any card to save it here'}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg className="w-12 h-12 mb-4 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
                </svg>
                <p className="text-sm">{strings[lang].emptyState as string}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
