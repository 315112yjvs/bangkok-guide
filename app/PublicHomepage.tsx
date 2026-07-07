'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { TAG_ICON } from '@/components/icons/TagIcons'
import { seededShuffle } from '@/lib/shuffle'
import { useShuffleSeed } from '@/hooks/useShuffleSeed'
import { type Landmark } from '@/lib/landmarks'
import { MIcon } from '@/components/icons/MaterialIcons'
import { LocationCard } from '@/components/LocationCard'
import { DragScroll } from '@/components/DragScroll'
import { LocationMap } from '@/components/LocationMap'
import { Reveal } from '@/components/Reveal'
import { getArea } from '@/lib/area'
import type { Location, Category, LocationTag } from '@/lib/types'

type Props = { locations: Location[] }

const TAG_META: Record<LocationTag, { emoji: string; zh: string; en: string; color: string }> = {
  trending:    { emoji: '🔥', zh: '話題爆紅', en: 'Trending Now',    color: 'from-orange-600 to-amber-500' },
  hidden_gem:  { emoji: '🗺', zh: '在地私藏', en: 'Hidden Gems',     color: 'from-emerald-700 to-teal-500' },
  new_opening: { emoji: '✨', zh: '新開幕',   en: 'Just Opened',     color: 'from-violet-600 to-purple-400' },
  evergreen:   { emoji: '📌', zh: '經典必訪', en: 'Must Visit',      color: 'from-blue-700 to-sky-500' },
}

const TAG_ORDER: LocationTag[] = ['trending', 'hidden_gem', 'new_opening', 'evergreen']

// 每個首頁分區最多顯示幾筆（其餘按「看全部」進完整清單）
const SECTION_LIMIT = 15
// 篩選/搜尋的網格視圖一次顯示幾筆（其餘按「載入更多」），避免一次渲染上百張卡片
const GRID_PAGE = 30

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
  const [activeArea, setActiveArea] = useState<string>('all')
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>('all')
  const [query, setQuery] = useState('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [landmark, setLandmark] = useState<Landmark | null>(null)
  // 附近的中心點：選了地標就用地標座標，否則用 GPS
  const nearbyAnchor = landmark ? { lat: landmark.lat, lng: landmark.lng } : userLocation
  const [locating, setLocating] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [mapExpanded, setMapExpanded] = useState(false)
  // 地圖只在使用者開過後才掛載，避免每次進首頁就載入 Google 地圖（省 Dynamic Maps 用量）
  const [mapEverOpened, setMapEverOpened] = useState(false)
  // 網格視圖目前顯示的筆數（篩選/搜尋條件一變就重置回第一頁）
  const [gridLimit, setGridLimit] = useState(GRID_PAGE)
  // 每分頁一個洗牌種子：一進站隨機，之後同分頁返回維持同樣順序（不會重洗）
  const shuffleSeed = useShuffleSeed()

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem('saved_locations') ?? '[]')
    setSavedIds(new Set(ids))
    // 標記「這個分頁來過首頁」，地點頁的返回鈕用它判斷要 router.back() 還是回首頁
    try { sessionStorage.setItem('bkk_visited_home', '1') } catch {}
  }, [])

  // 進地點頁再返回時，還原先前的篩選狀態（含「附近」的定位座標），
  // 不然元件重新掛載會重置回「全部」。用 sessionStorage 限本次造訪。
  const FILTER_KEY = 'bkk_home_filters'
  const skipFirstSave = useRef(true)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? 'null')
      if (saved) {
        if (saved.specialFilter) setSpecialFilter(saved.specialFilter)
        if (saved.activeCategory) setActiveCategory(saved.activeCategory)
        if (saved.activeTag) setActiveTag(saved.activeTag)
        if (saved.activeArea) setActiveArea(saved.activeArea)
        if (saved.query) setQuery(saved.query)
        if (saved.userLocation) setUserLocation(saved.userLocation)
        if (saved.landmark) setLandmark(saved.landmark)
      }
    } catch {}
  }, [])

  useEffect(() => {
    // 跳過掛載時的第一次（避免用預設值覆蓋掉剛還原的內容）
    if (skipFirstSave.current) { skipFirstSave.current = false; return }
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({
        specialFilter, activeCategory, activeTag, activeArea, query, userLocation, landmark,
      }))
    } catch {}
  }, [specialFilter, activeCategory, activeTag, activeArea, query, userLocation, landmark])

  useEffect(() => {
    if (specialFilter === 'nearby') { setMapExpanded(true); setMapEverOpened(true) }
  }, [specialFilter])

  // 篩選/搜尋條件一變，網格視圖回到第一頁
  useEffect(() => {
    setGridLimit(GRID_PAGE)
  }, [activeCategory, activeTag, activeArea, specialFilter, query, landmark])

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
    setLandmark(null) // GPS 附近：清掉地標
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
      const matchArea = activeArea === 'all' || getArea(loc) === activeArea
      const matchSpecial =
        specialFilter === 'all' ||
        specialFilter === 'nearby' ||
        (specialFilter === 'saved' && savedIds.has(loc.id))
      const q = query.toLowerCase()
      const matchSearch = !q || [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en, loc.address, ...(loc.highlights ?? [])]
        .some((s) => s?.toLowerCase().includes(q))
      return matchCat && matchTag && matchArea && matchSpecial && matchSearch
    })
    if (specialFilter === 'nearby' && nearbyAnchor) {
      return [...base]
        .filter((l) => haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, l.lat, l.lng) <= 5)
        .sort((a, b) =>
          haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, a.lat, a.lng) -
          haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, b.lat, b.lng)
        )
    }
    return base
  }, [locations, activeCategory, activeTag, activeArea, specialFilter, query, userLocation, landmark, savedIds])

  const areas = useMemo(() => {
    const counts = new Map<string, number>()
    for (const loc of locations) {
      const a = getArea(loc)
      if (a !== 'Bangkok') counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([a]) => a)
  }, [locations])

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<Category | 'all', number>> = { all: locations.length }
    for (const loc of locations) {
      counts[loc.category] = (counts[loc.category] ?? 0) + 1
    }
    return counts
  }, [locations])

  const showSections = specialFilter === 'all' && activeTag === 'all' && activeArea === 'all' && !query

  const sectionsByTag = useMemo(() => {
    if (!showSections) return null
    const map: Partial<Record<LocationTag, Location[]>> = {}
    for (const tag of TAG_ORDER) {
      const items = filtered.filter((l) => resolveTag(l) === tag)
      // 用分頁種子洗牌：一進站隨機，返回維持同序；每個分區用不同 offset 避免四區洗法一致
      if (items.length > 0) map[tag] = shuffleSeed != null ? seededShuffle(items, shuffleSeed + TAG_ORDER.indexOf(tag)) : items
    }
    return map
  }, [filtered, showSections, shuffleSeed])

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto bg-white min-h-screen overflow-hidden relative shadow-xl lg:shadow-2xl">

      {/* HERO */}
      <div className="sticky top-0 z-0 h-[72vw] max-h-96 min-h-60 lg:h-[440px] lg:max-h-[440px] overflow-hidden">
        <Image
          src="/hero-bangkok.jpg"
          alt="Bangkok"
          fill className="object-cover object-center scale-105"
          priority
        />
        {/* layered gradient: subtle top bar darkening + heavy title backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/90" />

        <div className="relative z-10 h-full flex flex-col">
          {/* Top bar */}
          <div className="flex justify-end items-center px-4 pt-5">
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>

          <div className="flex-1" />

          {/* Bottom editorial block */}
          <div className="px-5 pb-5 lg:px-12 lg:pb-10 lg:max-w-3xl lg:mx-auto lg:text-center">
            {/* Live badge + subtitle — 共用同一顆紅色膠囊 */}
            <div className="hero-rise hero-rise-1 flex mb-3 lg:justify-center">
              <span className="inline-flex items-center gap-2 bg-rose-600 text-white px-3 py-1.5 rounded-full shadow-lg">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
                <span className="text-[11px] tracking-wide text-white/95">{lang === 'zh' ? '每週更新 · 泰國社群精選' : 'Weekly updates · Thai social picks'}</span>
              </span>
            </div>

            {/* Title — 六分糖字型 */}
            <h1 className="hero-rise hero-rise-2 leading-[1.15] mb-4">
              <span className="font-liufen text-[32px] lg:text-[52px] text-white drop-shadow-lg block">{strings[lang].heroTitle as string}</span>
              <span className="font-liufen text-[32px] lg:text-[52px] text-amber-400 drop-shadow-lg block">{strings[lang].heroTitleAccent as string}</span>
            </h1>

            {/* Search bar */}
            <div className="hero-rise hero-rise-3 flex items-center gap-2.5 bg-white/15 backdrop-blur-xl border border-white/25 rounded-2xl px-4 py-3 shadow-lg">
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input
                className="flex-1 text-[14px] text-left outline-none text-white placeholder-white/45 bg-transparent"
                placeholder={strings[lang].searchPlaceholder as string}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label={lang === 'zh' ? '清除搜尋' : 'Clear search'} className="text-white/60 hover:text-white text-sm leading-none transition-colors">✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAP strip — collapsible */}
      <div className={`overflow-hidden transition-[height] duration-300 ease-in-out ${mapExpanded ? 'h-56 lg:h-96' : 'h-0'}`}>
        {mapEverOpened && (
          <LocationMap
            locations={filtered}
            lang={lang}
            userLocation={nearbyAnchor}
            nearbyMode={specialFilter === 'nearby'}
          />
        )}
      </div>

      {/* BOTTOM SHEET */}
      <div className="relative z-10 bg-gray-50 rounded-t-3xl -mt-5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex justify-center items-center pt-3 pb-1 relative">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
          <button
            onClick={() => { setMapExpanded(v => !v); setMapEverOpened(true) }}
            className="absolute right-3 flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-[#1e1b4b] transition-colors active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7M9 20l6-3M9 20V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7M15 20V7M9 7l6-3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {lang === 'zh' ? (mapExpanded ? '收起地圖' : '查看地圖') : (mapExpanded ? 'Hide Map' : 'Map')}
            <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${mapExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-100">
          <CategoryTabs
            active={activeCategory}
            onChange={(cat) => { setActiveCategory(cat); setActiveTag('all') }}
            lang={lang}
            counts={categoryCounts}
          />
        </div>

        {/* Filter row */}
        <div className="bg-white border-b border-gray-100 py-2 relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
          <DragScroll className="flex gap-2 overflow-x-auto no-scrollbar px-3 lg:justify-center">
            {/* All */}
            <button
              onClick={() => { setSpecialFilter('all'); setActiveTag('all'); setActiveArea('all'); setLandmark(null) }}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                specialFilter === 'all' && activeTag === 'all' && activeArea === 'all'
                  ? 'bg-[#1e1b4b] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {lang === 'zh' ? '全部' : 'All'}
            </button>
            <div className="w-px bg-gray-200 mx-0.5" />
            {/* Nearby */}
            <button
              onClick={() => {
                if (specialFilter === 'nearby' && !landmark) { setSpecialFilter('all'); return }
                requestLocation()
              }}
              disabled={locating}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                specialFilter === 'nearby' && !landmark
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
              const Icon = TAG_ICON[tag]
              return (
                <button
                  key={tag}
                  onClick={() => { setActiveTag(activeTag === tag ? 'all' : tag); setSpecialFilter('all') }}
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                    activeTag === tag
                      ? 'bg-[#1e1b4b] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={13} className="shrink-0" /> {lang === 'zh' ? m.zh : m.en}
                </button>
              )
            })}
          </DragScroll>
        </div>

        {/* Area chips */}
        {areas.length > 0 && (
          <div className="bg-white border-b border-gray-100 py-2 relative">
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
            <DragScroll className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3">
              <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5"/>
              </svg>
              <button
                onClick={() => { setActiveArea('all'); setSpecialFilter('all'); setLandmark(null) }}
                className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                  activeArea === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {lang === 'zh' ? '所有區域' : 'All Areas'}
              </button>
              {areas.map((a) => (
                <button
                  key={a}
                  onClick={() => { setActiveArea(activeArea === a ? 'all' : a); setSpecialFilter('all'); setLandmark(null) }}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                    activeArea === a ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </DragScroll>
          </div>
        )}

        {/* 4-section view (default) */}
        {showSections && sectionsByTag && (
          <div className="pb-10">
            {TAG_ORDER.map((tag) => {
              const items = sectionsByTag[tag]
              if (!items || items.length === 0) return null
              const meta = TAG_META[tag]
              const Icon = TAG_ICON[tag]
              return (
                <section key={tag} className="mt-4">
                  {/* Section header */}
                  <Reveal>
                  <div className={`mx-3 rounded-2xl bg-gradient-to-r ${meta.color} px-4 py-3 flex items-center justify-between mb-2`}>
                    <div>
                      <p className="flex items-center gap-1.5 text-white font-black text-[15px] tracking-tight leading-tight">
                        <Icon size={17} className="shrink-0" /> {lang === 'zh' ? meta.zh : meta.en}
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
                  </Reveal>
                  {/* Horizontal scroll cards — 每區隨機抽 SECTION_LIMIT 筆，其餘按「看全部」進完整清單 */}
                  <DragScroll className="flex gap-3 overflow-x-auto no-scrollbar px-3 pb-1 lg:cursor-grab">
                    {items.slice(0, SECTION_LIMIT).map((loc, i) => (
                      <Reveal key={loc.id} delay={i < 4 ? i * 60 : 0} className="shrink-0 w-44 lg:w-52 h-[260px] lg:h-[300px]">
                        <LocationCard
                          location={loc}
                          lang={lang}
                          distanceKm={nearbyAnchor ? haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, loc.lat, loc.lng) : undefined}
                          saved={savedIds.has(loc.id)}
                          onToggleSave={handleToggleSave}
                          compact
                        />
                      </Reveal>
                    ))}
                    {items.length > SECTION_LIMIT && (
                      <button
                        onClick={() => { setActiveTag(tag); setSpecialFilter('all'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="shrink-0 w-32 lg:w-36 h-[260px] lg:h-[300px] rounded-2xl bg-gray-100 hover:bg-gray-200 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500"
                      >
                        <span className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span className="text-[12px] font-bold">{lang === 'zh' ? '看全部' : 'See all'}</span>
                        <span className="text-[11px] text-gray-400">{items.length} {lang === 'zh' ? '筆' : 'places'}</span>
                      </button>
                    )}
                  </DragScroll>
                </section>
              )
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-8">
                <span className="mb-4 text-gray-300">
                  <MIcon name={({ hotel: 'hotel', attraction: 'attractions', shopping: 'shopping_bag', nightlife: 'local_bar', food: 'restaurant', cafe: 'local_cafe' } as Record<string, string>)[activeCategory] ?? 'search'} size={56} />
                </span>
                <p className="text-sm font-bold text-gray-400 mb-1">
                  {lang === 'zh' ? '這個類別暫無推薦' : 'No picks in this category yet'}
                </p>
                <p className="text-xs text-gray-300 text-center">
                  {lang === 'zh' ? '持續更新中，敬請期待！' : 'We are curating picks — check back soon!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filtered / search view */}
        {!showSections && (
          <section className="px-3 pt-3 pb-10">
            {filtered.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filtered.slice(0, gridLimit).map((loc, i) => (
                    <Reveal key={loc.id} delay={(i % 2) * 60}>
                      <LocationCard
                        location={loc}
                        lang={lang}
                        distanceKm={nearbyAnchor ? haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, loc.lat, loc.lng) : undefined}
                        saved={savedIds.has(loc.id)}
                        onToggleSave={handleToggleSave}
                        compact
                      />
                    </Reveal>
                  ))}
                </div>
                {filtered.length > gridLimit && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setGridLimit((n) => n + GRID_PAGE)}
                      className="flex items-center gap-1.5 text-[13px] font-bold text-[#1e1b4b] bg-white border border-gray-200 rounded-full px-6 py-2.5 shadow-sm hover:bg-gray-50 transition-colors active:scale-95"
                    >
                      {lang === 'zh' ? '載入更多' : 'Load more'}
                      <span className="text-[11px] text-gray-400 font-semibold">
                        {Math.min(gridLimit, filtered.length)} / {filtered.length}
                      </span>
                    </button>
                  </div>
                )}
              </>
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
