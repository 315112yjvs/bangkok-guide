'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { TAG_ICON } from '@/components/icons/TagIcons'
import { seededShuffle } from '@/lib/shuffle'
import { useShuffleSeed } from '@/hooks/useShuffleSeed'
import { LANDMARKS, type Landmark } from '@/lib/landmarks'
import { THEMES } from '@/lib/themes'
import { haversineKm } from '@/lib/geo'
import { expandQuery } from '@/lib/searchTerms'
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
  // 定位失敗（拒絕權限/逾時/不支援）：提示改選地標，不要讓「附近」按了沒反應
  const [geoError, setGeoError] = useState(false)
  // 分類/篩選列的位置：按「看全部」時捲回這裡
  const filterRef = useRef<HTMLDivElement>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [mapExpanded, setMapExpanded] = useState(false)
  // 地圖只在使用者開過後才掛載，避免每次進首頁就載入 Google 地圖（省 Dynamic Maps 用量）
  const [mapEverOpened, setMapEverOpened] = useState(false)
  // 網格視圖目前顯示的筆數（篩選/搜尋條件一變就重置回第一頁）
  const [gridLimit, setGridLimit] = useState(GRID_PAGE)
  // 區域列預設收起（手機第一個畫面要先看到店家），按「區域」才展開；已選了區域就保持展開
  const [areaOpen, setAreaOpen] = useState(false)
  // 篩選結果的排序
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'distance'>('default')
  const searchRef = useRef<HTMLDivElement>(null)
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
    setGeoError(false)
    if (userLocation) { setSpecialFilter('nearby'); return }
    if (!navigator.geolocation) { setGeoError(true); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        setSpecialFilter('nearby')
      },
      () => { setLocating(false); setGeoError(true) },
      { timeout: 10000 }
    )
  }

  function pickLandmark(lm: Landmark) {
    setGeoError(false)
    if (landmark?.id === lm.id) { setLandmark(null); setSpecialFilter('all'); return }
    setLandmark(lm)
    setSpecialFilter('nearby')
  }

  const filtered = useMemo(() => {
    // 中文搜尋詞展開成英文/泰文寫法（搜「燒肉」也找得到 Mookata）
    const terms = expandQuery(query)
    const base = locations.filter((loc) => {
      const matchCat = activeCategory === 'all' || loc.category === activeCategory
      const matchTag = activeTag === 'all' || resolveTag(loc) === activeTag
      const matchArea = activeArea === 'all' || getArea(loc) === activeArea
      const matchSpecial =
        specialFilter === 'all' ||
        specialFilter === 'nearby' ||
        (specialFilter === 'saved' && savedIds.has(loc.id))
      const haystack = terms.length
        ? [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en, loc.address, getArea(loc), ...(loc.highlights ?? [])].join('\n').toLowerCase()
        : ''
      const matchSearch = terms.length === 0 || terms.some((t) => haystack.includes(t))
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

  // 篩選結果的排序：預設順序（附近模式已由近到遠）、評分高到低、距離近到遠（要有定位或地標才有）
  const gridItems = useMemo(() => {
    if (sortBy === 'rating') return [...filtered].sort((a, b) => b.rating - a.rating)
    if (sortBy === 'distance' && nearbyAnchor) {
      return [...filtered].sort((a, b) =>
        haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, a.lat, a.lng) - haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, b.lat, b.lng))
    }
    return filtered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortBy, userLocation, landmark])

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
    <div className="max-w-md lg:max-w-6xl mx-auto bg-white min-h-screen overflow-hidden relative lg:border-x lg:border-line">

      {/* HERO */}
      <div className="relative h-[60vw] max-h-80 min-h-[232px] lg:h-[400px] lg:max-h-[400px] overflow-hidden">
        <Image
          src="/hero-bangkok.jpg"
          alt="Bangkok"
          fill className="object-cover object-center"
          priority
        />
        {/* layered gradient: subtle top bar darkening + heavy title backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/35" />

        <div className="relative z-10 h-full flex flex-col">
          {/* Top bar */}
          <div className="flex justify-end items-center px-4 pt-5">
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>

          <div className="flex-1" />

          {/* Bottom editorial block */}
          <div className="px-5 pb-5 lg:px-12 lg:pb-10 lg:max-w-3xl lg:mx-auto lg:text-center">
            {/* 副標 */}
            <p className="hero-rise hero-rise-1 text-[12px] tracking-[0.12em] text-white/80 mb-2">
              {lang === 'zh' ? '泰國社群精選 · 在地人推薦' : 'THAI SOCIAL PICKS · CHOSEN BY LOCALS'}
            </p>

            {/* Title — 六分糖字型 */}
            <h1 className="hero-rise hero-rise-2 leading-[1.15] mb-3.5">
              <span className="font-liufen text-[30px] lg:text-[46px] text-white block">{strings[lang].heroTitle as string}</span>
              <span className="font-liufen text-[30px] lg:text-[46px] text-white block">{strings[lang].heroTitleAccent as string}</span>
            </h1>

            {/* Search bar */}
            <div ref={searchRef} className="hero-rise hero-rise-3 flex items-center gap-2.5 bg-white rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input
                className="flex-1 text-[15px] text-left outline-none text-ink placeholder:text-muted bg-transparent"
                placeholder={strings[lang].searchPlaceholder as string}
                value={query}
                onChange={(e) => {
                  const v = e.target.value
                  // 開始輸入時把搜尋框捲到畫面最上方，結果才會出現在鍵盤上方看得到的地方
                  if (!query && v && searchRef.current) {
                    window.scrollTo({ top: searchRef.current.getBoundingClientRect().top + window.scrollY - 8, behavior: 'smooth' })
                  }
                  setQuery(v)
                }}
                enterKeyHint="search"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label={lang === 'zh' ? '清除搜尋' : 'Clear search'} className="text-muted hover:text-ink text-sm leading-none transition-colors">✕</button>
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

      {/* 內容區 */}
      <div className="relative bg-white">
        {/* 分類頁籤 + 地圖開關 */}
        <div ref={filterRef} className="flex items-stretch border-b border-line scroll-mt-2">
          <div className="flex-1 min-w-0">
            <CategoryTabs
              active={activeCategory}
              onChange={(cat) => { setActiveCategory(cat); setActiveTag('all') }}
              lang={lang}
              counts={categoryCounts}
            />
          </div>
          <button
            onClick={() => { setMapExpanded(v => !v); setMapEverOpened(true) }}
            aria-pressed={mapExpanded}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 border-l border-line text-[13px] transition-colors ${mapExpanded ? 'text-brand font-bold' : 'text-muted hover:text-ink'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7M9 20l6-3M9 20V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7M15 20V7M9 7l6-3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {lang === 'zh' ? (mapExpanded ? '收起' : '地圖') : (mapExpanded ? 'Hide' : 'Map')}
          </button>
        </div>

        {/* Filter row */}
        <div className="bg-white border-b border-line py-2.5 relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
          <DragScroll className="flex gap-2 overflow-x-auto no-scrollbar px-3 lg:justify-center">
            {/* All */}
            <button
              onClick={() => { setSpecialFilter('all'); setActiveTag('all'); setActiveArea('all'); setLandmark(null); setGeoError(false) }}
              className={`text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                specialFilter === 'all' && activeTag === 'all' && activeArea === 'all'
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-ink/70 border-line hover:border-ink/40'
              }`}
            >
              {lang === 'zh' ? '全部' : 'All'}
            </button>
            <div className="w-px bg-line mx-0.5 my-1.5" />
            {/* Nearby */}
            <button
              onClick={() => {
                if (specialFilter === 'nearby' && !landmark) { setSpecialFilter('all'); return }
                requestLocation()
              }}
              disabled={locating}
              className={`flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                specialFilter === 'nearby' && !landmark
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-ink/70 border-line hover:border-ink/40'
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
              className={`flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                specialFilter === 'saved'
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-ink/70 border-line hover:border-ink/40'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={specialFilter === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {lang === 'zh' ? '我的收藏' : 'Saved'}
              {savedIds.size > 0 && <span className={`text-[9px] font-black ${specialFilter === 'saved' ? 'text-white/70' : 'text-muted'}`}>{savedIds.size}</span>}
            </button>
            {/* 區域：預設收起，點了才展開下面那一列 */}
            {areas.length > 0 && (
              <button
                onClick={() => setAreaOpen((v) => !v)}
                aria-expanded={areaOpen || activeArea !== 'all'}
                className={`lg:hidden flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  activeArea !== 'all' ? 'bg-ink text-white border-ink' : 'bg-white text-ink/70 border-line hover:border-ink/40'
                }`}
              >
                {activeArea !== 'all' ? activeArea : (lang === 'zh' ? '區域' : 'Area')}
                <svg className={`w-2.5 h-2.5 transition-transform ${areaOpen || activeArea !== 'all' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            <div className="w-px bg-line mx-0.5 my-1.5" />
            {/* Tag filters */}
            {TAG_ORDER.map((tag) => {
              const m = TAG_META[tag]
              const Icon = TAG_ICON[tag]
              return (
                <button
                  key={tag}
                  onClick={() => { setActiveTag(activeTag === tag ? 'all' : tag); setSpecialFilter('all') }}
                  className={`inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    activeTag === tag
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-ink/70 border-line hover:border-ink/40'
                  }`}
                >
                  <Icon size={13} className="shrink-0" /> {lang === 'zh' ? m.zh : m.en}
                </button>
              )
            })}
          </DragScroll>
        </div>

        {/* Area chips（手機預設收起，桌機常駐） */}
        {areas.length > 0 && (
          <div className={`bg-white border-b border-line py-2.5 relative ${areaOpen || activeArea !== 'all' ? '' : 'hidden lg:block'}`}>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
            <DragScroll className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3">
              <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5"/>
              </svg>
              <button
                onClick={() => { setActiveArea('all'); setSpecialFilter('all'); setLandmark(null) }}
                className={`text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  activeArea === 'all' ? 'bg-ink text-white border-ink' : 'bg-white text-ink/70 border-line hover:border-ink/40'
                }`}
              >
                {lang === 'zh' ? '所有區域' : 'All Areas'}
              </button>
              {areas.map((a) => (
                <button
                  key={a}
                  onClick={() => { setActiveArea(activeArea === a ? 'all' : a); setSpecialFilter('all'); setLandmark(null) }}
                  className={`text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    activeArea === a ? 'bg-ink text-white border-ink' : 'bg-white text-ink/70 border-line hover:border-ink/40'
                  }`}
                >
                  {a}
                </button>
              ))}
            </DragScroll>
          </div>
        )}

        {/* 地標列：按了「附近」或定位失敗時出現，選一個地標就以它為中心找 5 公里內的店 */}
        {(specialFilter === 'nearby' || geoError) && (
          <div className="bg-white border-b border-line py-2.5 relative">
            {geoError && (
              <p className="px-3 pb-1.5 text-[12px] font-bold text-rose-600">
                {lang === 'zh' ? '拿不到你的定位，可以改選一個地標：' : "Couldn't get your location. Pick a landmark instead:"}
              </p>
            )}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
            <DragScroll className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3">
              <span className="shrink-0 text-[11px] font-bold text-gray-400 whitespace-nowrap">
                {lang === 'zh' ? '或選地標' : 'Or near'}
              </span>
              {LANDMARKS.map((lm) => (
                <button
                  key={lm.id}
                  onClick={() => pickLandmark(lm)}
                  className={`inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    landmark?.id === lm.id ? 'bg-ink text-white border-ink' : 'bg-white text-ink/70 border-line hover:border-ink/40'
                  }`}
                >
                  <MIcon name={lm.icon} size={13} className="shrink-0" /> {lang === 'zh' ? lm.zh : lm.en}
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
                <section key={tag} className="mt-8 pt-7 border-t border-line first:border-t-0 first:mt-0 first:pt-5">
                  {/* Section header */}
                  <div className="flex items-end justify-between gap-3 px-4 mb-3">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 font-liufen text-[20px] lg:text-[24px] text-ink leading-tight">
                        <Icon size={18} className="shrink-0 text-brand" /> {lang === 'zh' ? meta.zh : meta.en}
                      </h2>
                      <p className="text-[12px] text-muted mt-1">
                        {lang === 'zh'
                          ? tag === 'trending' ? '曼谷社群話題精選' : tag === 'hidden_gem' ? '在地人才知道的地方' : tag === 'new_opening' ? '最新開幕，搶先體驗' : '經典不敗，值得回訪'
                          : tag === 'trending' ? 'What Bangkok is buzzing about' : tag === 'hidden_gem' ? "Locals' best-kept secrets" : tag === 'new_opening' ? 'Be the first to visit' : 'Timeless picks, always worth it'}
                      </p>
                    </div>
                    <button
                      onClick={() => { setActiveTag(tag); setSpecialFilter('all'); filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                      className="shrink-0 text-[12px] text-brand hover:text-brand-dark hover:underline underline-offset-4 whitespace-nowrap"
                    >
                      {lang === 'zh' ? `看全部 ${items.length} 筆` : `See all ${items.length}`} →
                    </button>
                  </div>
                  {/* Horizontal scroll cards — 每區隨機抽 SECTION_LIMIT 筆，其餘按「看全部」進完整清單 */}
                  <DragScroll className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1 lg:cursor-grab">
                    {items.slice(0, SECTION_LIMIT).map((loc) => (
                      <Reveal key={loc.id} className="shrink-0 w-44 lg:w-52 h-[250px] lg:h-[290px]">
                        <LocationCard
                          location={loc}
                          lang={lang}
                          distanceKm={nearbyAnchor ? haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, loc.lat, loc.lng) : undefined}
                          saved={savedIds.has(loc.id)}
                          onToggleSave={handleToggleSave}
                          compact
                          hideTag
                        />
                      </Reveal>
                    ))}
                    {items.length > SECTION_LIMIT && (
                      <button
                        onClick={() => { setActiveTag(tag); setSpecialFilter('all'); filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                        className="shrink-0 w-32 lg:w-36 h-[250px] lg:h-[290px] rounded-lg border border-line hover:border-ink/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted"
                      >
                        <span className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-ink">
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
            {/* 主題玩法：放在分區之後，不擠掉第一個畫面的店家 */}
            {activeCategory === 'all' && filtered.length > 0 && (
              <section className="mt-8 pt-7 border-t border-line px-4">
                <h2 className="font-liufen text-[20px] lg:text-[24px] text-ink leading-tight mb-3">{lang === 'zh' ? '主題玩法' : 'Browse by theme'}</h2>
                <div className="flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/theme/${t.slug}`}
                      className="inline-flex items-center gap-1.5 text-[13px] text-ink border border-line rounded-full px-3.5 py-2 hover:border-ink/40 transition-colors"
                    >
                      <MIcon name={t.icon} size={15} className="shrink-0 text-brand" />
                      {lang === 'zh' ? t.h1Zh.replace(/^曼谷\s*/, '') : t.h1En.replace(/^Bangkok('s)?\s*/, '')}
                    </Link>
                  ))}
                </div>
              </section>
            )}
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
          <section className="px-4 pt-4 pb-10">
            {filtered.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] text-muted" aria-live="polite">
                    {lang === 'zh' ? `找到 ${filtered.length} 家` : `${filtered.length} places`}
                  </p>
                  <label className="flex items-center gap-1.5 text-[13px] text-muted">
                    <span className="sr-only">{lang === 'zh' ? '排序' : 'Sort'}</span>
                    <select
                      value={sortBy === 'distance' && !nearbyAnchor ? 'default' : sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="bg-white border border-line rounded-md px-2 py-1.5 text-[13px] text-ink outline-none focus:border-ink/40"
                    >
                      <option value="default">{lang === 'zh' ? '預設排序' : 'Default'}</option>
                      <option value="rating">{lang === 'zh' ? '評分高到低' : 'Top rated'}</option>
                      {nearbyAnchor && <option value="distance">{lang === 'zh' ? '距離近到遠' : 'Nearest'}</option>}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {gridItems.slice(0, gridLimit).map((loc) => (
                    <Reveal key={loc.id}>
                      <LocationCard
                        location={loc}
                        lang={lang}
                        distanceKm={nearbyAnchor ? haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, loc.lat, loc.lng) : undefined}
                        saved={savedIds.has(loc.id)}
                        onToggleSave={handleToggleSave}
                        compact
                        hideTag={activeTag !== 'all'}
                      />
                    </Reveal>
                  ))}
                </div>
                {filtered.length > gridLimit && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setGridLimit((n) => n + GRID_PAGE)}
                      className="flex items-center gap-1.5 text-[13px] font-bold text-ink bg-white border border-line rounded-full px-6 py-2.5 hover:border-ink/40 transition-colors"
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
            ) : specialFilter === 'nearby' ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-8">
                <span className="mb-4 text-gray-200"><MIcon name="near_me" size={48} /></span>
                <p className="text-sm font-bold text-gray-400 mb-1">
                  {!nearbyAnchor
                    ? (lang === 'zh' ? '選一個地標看看附近有什麼' : 'Pick a landmark to see what is nearby')
                    : (lang === 'zh' ? '5 公里內沒有符合的地點' : 'Nothing matches within 5 km')}
                </p>
                {nearbyAnchor && (
                  <p className="text-xs text-gray-300 text-center">
                    {lang === 'zh' ? '換個地標，或清掉分類篩選試試' : 'Try another landmark or clear the category filter'}
                  </p>
                )}
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
