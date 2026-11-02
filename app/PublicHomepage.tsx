'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { seededShuffle } from '@/lib/shuffle'
import { useShuffleSeed } from '@/hooks/useShuffleSeed'
import { LANDMARKS, type Landmark } from '@/lib/landmarks'
import { THEMES } from '@/lib/themes'
import { haversineKm } from '@/lib/geo'
import { expandQuery } from '@/lib/searchTerms'
import { EditorialCard } from '@/components/EditorialCard'
import { HeroStrip } from '@/components/HeroStrip'
import { openStatus } from '@/lib/openStatus'
import { useBangkokMinute } from '@/lib/useBangkokMinute'
import { DragScroll } from '@/components/DragScroll'
import { LocationMap } from '@/components/LocationMap'
import { Reveal } from '@/components/Reveal'
import { getArea } from '@/lib/area'
import type { Location, Category, LocationTag } from '@/lib/types'

type Props = { locations: Location[] }

const TAG_META: Record<LocationTag, { zh: string; en: string; subZh: string; subEn: string }> = {
  trending:    { zh: '話題爆紅', en: 'Trending now', subZh: '曼谷社群最近在聊的店', subEn: 'What Bangkok is talking about' },
  hidden_gem:  { zh: '在地私藏', en: 'Hidden gems',  subZh: '在地人才知道的地方',   subEn: "Locals' best-kept secrets" },
  new_opening: { zh: '新開幕',   en: 'Just opened',  subZh: '剛開幕，先去看看',     subEn: 'Newly opened, worth a look' },
  evergreen:   { zh: '經典必訪', en: 'Must visit',   subZh: '經典不敗，值得回訪',   subEn: 'Timeless, always worth it' },
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
  // 只看現在有開的店（沒有營業時間資料的店無法判斷，開啟時不列出）
  const [openNow, setOpenNow] = useState(false)
  const minute = useBangkokMinute()
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
  }, [activeCategory, activeTag, activeArea, specialFilter, query, landmark, openNow])

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
      const matchOpen = !openNow || minute === null || (!!loc.hours && openStatus(loc.hours, minute).open)
      return matchCat && matchTag && matchArea && matchSpecial && matchSearch && matchOpen
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
  }, [locations, activeCategory, activeTag, activeArea, specialFilter, query, userLocation, landmark, savedIds, openNow, minute])

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

  const showSections = specialFilter === 'all' && activeTag === 'all' && activeArea === 'all' && !query && !openNow

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

  // 首屏底片條：話題爆紅的店優先，取有照片的前 12 家（資料順序固定，伺服器與瀏覽器一致）
  const heroItems = useMemo(() => {
    const withPhoto = locations.filter((l) => l.photos?.length)
    const trending = withPhoto.filter((l) => resolveTag(l) === 'trending')
    return [...trending, ...withPhoto.filter((l) => resolveTag(l) !== 'trending')].slice(0, 12)
  }, [locations])

  // 曼谷此刻有幾家開著（只算有營業時間資料的店）
  const openCount = useMemo(() => {
    if (minute === null) return null
    return locations.filter((l) => l.hours && openStatus(l.hours, minute).open).length
  }, [locations, minute])
  const clock = minute === null ? null : `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

  const themeCounts = useMemo(() => THEMES.map((t) => locations.filter(t.match).length), [locations])

  const chip = (on: boolean) =>
    `ed-press inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-[16px] whitespace-nowrap transition-colors ${
      on ? 'bg-[var(--ed-ink)] text-white' : 'bg-[var(--ed-surface)] text-[var(--ed-ink)] hover:bg-[var(--ed-surface-2)]'
    }`

  const showAll = (tag: LocationTag) => {
    setActiveTag(tag); setSpecialFilter('all')
    filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="ed-page min-h-[100svh]">

      {/* HERO：深色底＋一條真實店家照片 */}
      <header className="ed-hero">
        <div className="ed-wrap flex items-center justify-between pt-5 lg:pt-8">
          <Link href="/" className="flex items-center gap-2.5 text-white text-[16px]">
            <Image src="/logo-circle.png" alt="" width={28} height={28} className="rounded-full" />
            曼谷人 BKK LOCAL
          </Link>
          <span className="[&>div]:text-[13px]"><LanguageToggle lang={lang} setLang={setLang} /></span>
        </div>

        <div className="ed-wrap pt-10 lg:pt-14 pb-8 lg:pb-10">
          <h1 className="hero-rise hero-rise-1 ed-serif ed-display text-white">
            <span className="sr-only">曼谷人 BKK LOCAL：</span>
            <span className="block">{strings[lang].heroTitle as string}</span>
            <span className="block">{strings[lang].heroTitleAccent as string}</span>
          </h1>
          <p className="hero-rise hero-rise-2 mt-5 max-w-[34em] text-[16px] lg:text-[20px] leading-relaxed text-white/80">
            {lang === 'zh'
              ? `在地人挑的曼谷美食、咖啡廳、酒吧與私藏地點，目前收錄 ${locations.length} 家。`
              : `Bangkok food, cafes, bars and hidden spots picked by locals. ${locations.length} places so far.`}
          </p>
        </div>

        <div className="hero-rise hero-rise-3">
          <HeroStrip items={heroItems} lang={lang} />
        </div>

        <div className="ed-wrap pt-8 pb-10 lg:pb-14 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
          <div ref={searchRef} className="flex items-center gap-3 h-14 bg-white px-5 lg:w-[520px] rounded-full">
            <svg className="w-5 h-5 text-[var(--ed-muted)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
            </svg>
            <input
              aria-label={lang === 'zh' ? '搜尋店家' : 'Search places'}
              className="flex-1 text-[16px] outline-none text-[var(--ed-ink)] placeholder:text-[var(--ed-muted)] bg-transparent"
              placeholder={strings[lang].searchPlaceholder as string}
              value={query}
              onChange={(e) => {
                const v = e.target.value
                if (!query && v && searchRef.current) {
                  window.scrollTo({ top: searchRef.current.getBoundingClientRect().top + window.scrollY - 8, behavior: 'smooth' })
                }
                setQuery(v)
              }}
              enterKeyHint="search"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label={lang === 'zh' ? '清除搜尋' : 'Clear search'} className="text-[var(--ed-muted)] hover:text-[var(--ed-ink)] p-1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/></svg></button>
            )}
          </div>
          {/* 曼谷此刻：幾點、幾家開著，按了直接看營業中的店 */}
          <button
            onClick={() => { setOpenNow(true); filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
            className="ed-press inline-flex items-center justify-center gap-2 h-14 px-6 rounded-full bg-[var(--ed-accent)] text-white text-[16px] hover:bg-[#323d91] self-start lg:self-auto"
          >
            {clock && openCount !== null
              ? (lang === 'zh' ? `曼谷現在 ${clock}，有 ${openCount} 家開著` : `${clock} in Bangkok, ${openCount} places open`)
              : (lang === 'zh' ? '看現在有開的店' : 'See what is open now')}
            <span aria-hidden> →</span>
          </button>
        </div>
      </header>

      {/* MAP strip — collapsible */}
      <div className={`overflow-hidden transition-[height] duration-300 ease-in-out ${mapExpanded ? 'h-64 lg:h-[420px]' : 'h-0'}`}>
        {mapEverOpened && (
          <LocationMap
            locations={filtered}
            lang={lang}
            userLocation={nearbyAnchor}
            nearbyMode={specialFilter === 'nearby'}
          />
        )}
      </div>

      <main>
        {/* 篩選 */}
        <div ref={filterRef} className="ed-wrap scroll-mt-2 pt-8 lg:pt-10">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0 -mx-3">
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
              className={chip(mapExpanded)}
            >
              {lang === 'zh' ? (mapExpanded ? '收起地圖' : '地圖') : (mapExpanded ? 'Hide map' : 'Map')}
            </button>
          </div>

          <DragScroll className="mt-4 -mx-5 px-5 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap">
            <button
              onClick={() => { setSpecialFilter('all'); setActiveTag('all'); setActiveArea('all'); setLandmark(null); setGeoError(false); setOpenNow(false) }}
              className={chip(specialFilter === 'all' && activeTag === 'all' && activeArea === 'all' && !openNow)}
            >
              {lang === 'zh' ? '全部' : 'All'}
            </button>
            <button
              onClick={() => {
                if (specialFilter === 'nearby' && !landmark) { setSpecialFilter('all'); return }
                requestLocation()
              }}
              disabled={locating}
              className={chip(specialFilter === 'nearby' && !landmark)}
            >
              {locating && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
              {lang === 'zh' ? '附近' : 'Near me'}
            </button>
            <button onClick={() => setOpenNow((v) => !v)} aria-pressed={openNow} className={chip(openNow)}>
              {lang === 'zh' ? '營業中' : 'Open now'}
            </button>
            <button onClick={() => setSpecialFilter(specialFilter === 'saved' ? 'all' : 'saved')} className={chip(specialFilter === 'saved')}>
              {lang === 'zh' ? '我的收藏' : 'Saved'}
              {savedIds.size > 0 && <span className="tabular-nums opacity-70">{savedIds.size}</span>}
            </button>
            {areas.length > 0 && (
              <button
                onClick={() => setAreaOpen((v) => !v)}
                aria-expanded={areaOpen || activeArea !== 'all'}
                className={chip(activeArea !== 'all')}
              >
                {activeArea !== 'all' ? activeArea : (lang === 'zh' ? '區域' : 'Area')}
              </button>
            )}
            {TAG_ORDER.map((tag) => (
              <button
                key={tag}
                onClick={() => { setActiveTag(activeTag === tag ? 'all' : tag); setSpecialFilter('all') }}
                className={chip(activeTag === tag)}
              >
                {lang === 'zh' ? TAG_META[tag].zh : TAG_META[tag].en}
              </button>
            ))}
          </DragScroll>

          {areas.length > 0 && (
            <div className={`mt-5 ${areaOpen || activeArea !== 'all' ? '' : 'hidden'}`}>
              <DragScroll className="-mx-5 px-5 md:mx-0 md:px-0 flex items-center gap-x-5 gap-y-1 overflow-x-auto no-scrollbar md:flex-wrap text-[16px]">
                <button
                  onClick={() => { setActiveArea('all'); setSpecialFilter('all'); setLandmark(null) }}
                  className={`ed-press whitespace-nowrap py-2 ${activeArea === 'all' ? 'text-[var(--ed-ink)] ed-current' : 'text-[var(--ed-muted)] hover:text-[var(--ed-ink)]'}`}
                >
                  {lang === 'zh' ? '所有區域' : 'All areas'}
                </button>
                {areas.map((a) => (
                  <button
                    key={a}
                    onClick={() => { setActiveArea(activeArea === a ? 'all' : a); setSpecialFilter('all'); setLandmark(null) }}
                    className={`ed-press whitespace-nowrap py-2 ${activeArea === a ? 'text-[var(--ed-ink)] ed-current' : 'text-[var(--ed-muted)] hover:text-[var(--ed-ink)]'}`}
                  >
                    {a}
                  </button>
                ))}
              </DragScroll>
            </div>
          )}

          {(specialFilter === 'nearby' || geoError) && (
            <div className="mt-5">
              {geoError && (
                <p className="pb-2 text-[15px] text-rose-700">
                  {lang === 'zh' ? '拿不到你的定位，可以改選一個地標：' : "Couldn't get your location. Pick a landmark instead:"}
                </p>
              )}
              <DragScroll className="-mx-5 px-5 md:mx-0 md:px-0 flex items-center gap-2 overflow-x-auto no-scrollbar md:flex-wrap">
                <span className="shrink-0 text-[16px] text-[var(--ed-muted)] whitespace-nowrap pr-1">
                  {lang === 'zh' ? '或選地標' : 'Or near'}
                </span>
                {LANDMARKS.map((lm) => (
                  <button key={lm.id} onClick={() => pickLandmark(lm)} className={chip(landmark?.id === lm.id)}>
                    {lang === 'zh' ? lm.zh : lm.en}
                  </button>
                ))}
              </DragScroll>
            </div>
          )}
        </div>

        {/* 四個分區（預設） */}
        {showSections && sectionsByTag && (
          <div>
            {TAG_ORDER.map((tag) => {
              const items = sectionsByTag[tag]
              if (!items || items.length === 0) return null
              const meta = TAG_META[tag]
              return (
                <section key={tag} className="pt-24 lg:pt-32" aria-labelledby={`sec-${tag}`}>
                  <Reveal className="ed-wrap mb-6 lg:mb-8">
                    <h2 id={`sec-${tag}`} className="ed-serif ed-head text-[var(--ed-ink)]">{lang === 'zh' ? meta.zh : meta.en}</h2>
                    <p className="mt-2 text-[16px] text-[var(--ed-ink)]">
                      {lang === 'zh' ? meta.subZh : meta.subEn}
                      <button onClick={() => showAll(tag)} className="ed-link ml-3 text-[var(--ed-accent)] whitespace-nowrap">
                        {lang === 'zh' ? `看全部 ${items.length} 家` : `All ${items.length}`} →
                      </button>
                    </p>
                  </Reveal>
                  <div className="ed-wrap"><DragScroll className="flex gap-5 lg:gap-6 overflow-x-auto no-scrollbar snap-x lg:cursor-grab pb-2">
                    {items.slice(0, SECTION_LIMIT).map((loc, i) => (
                      <Reveal key={loc.id} delay={Math.min(i, 5) * 70} className="snap-start shrink-0 w-[64vw] max-w-[260px] lg:w-[260px]">
                        <EditorialCard
                          location={loc}
                          lang={lang}
                          distanceKm={nearbyAnchor ? haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, loc.lat, loc.lng) : undefined}
                          saved={savedIds.has(loc.id)}
                          onToggleSave={handleToggleSave}
                        />
                      </Reveal>
                    ))}
                    {items.length > SECTION_LIMIT && (
                      <button
                        onClick={() => showAll(tag)}
                        className="ed-press snap-start shrink-0 w-[44vw] max-w-[200px] aspect-[4/5] self-start flex flex-col items-start justify-end p-5 bg-[var(--ed-surface)] hover:bg-[var(--ed-surface-2)] text-left"
                      >
                        <span className="ed-serif text-[28px] text-[var(--ed-ink)] leading-tight">{lang === 'zh' ? '看全部' : 'See all'}</span>
                        <span className="mt-1 text-[16px] text-[var(--ed-ink)] tabular-nums">{items.length} {lang === 'zh' ? '家' : 'places'} →</span>
                      </button>
                    )}
                  </DragScroll></div>
                </section>
              )
            })}

            {/* 主題玩法：一欄清單，左邊名稱、右邊家數 */}
            {activeCategory === 'all' && filtered.length > 0 && (
              <section className="ed-wrap pt-20 lg:pt-32" aria-labelledby="sec-themes">
                <div className="grid lg:grid-cols-12 gap-8">
                  <Reveal className="lg:col-span-4">
                    <h2 id="sec-themes" className="ed-serif ed-head text-[var(--ed-ink)]">{lang === 'zh' ? '主題玩法' : 'By theme'}</h2>
                    <p className="mt-2 text-[16px] text-[var(--ed-ink)] max-w-[22em]">
                      {lang === 'zh' ? '照心情挑：想拍照、想看夜景、想吃早午餐。' : 'Pick by mood: photos, skyline drinks, brunch.'}
                    </p>
                  </Reveal>
                  <ul className="lg:col-span-7 lg:col-start-6">
                    {THEMES.map((t, i) => (
                      <li key={t.slug}>
                        <Reveal delay={i * 60}>
                          <Link href={`/theme/${t.slug}`} className="ed-theme group flex items-baseline justify-between gap-6 py-3.5">
                            <span className="ed-serif text-[20px] lg:text-[28px] text-[var(--ed-ink)] transition-transform duration-300 group-hover:translate-x-1.5">
                              {lang === 'zh' ? t.h1Zh.replace(/^曼谷\s*/, '') : t.h1En.replace(/^Bangkok('s)?\s*/, '')}
                            </span>
                            <span className="text-[16px] text-[var(--ed-muted)] tabular-nums whitespace-nowrap">
                              {themeCounts[i]} {lang === 'zh' ? '家' : 'places'}
                            </span>
                          </Link>
                        </Reveal>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            {filtered.length === 0 && (
              <div className="ed-wrap py-24 text-center">
                <p className="ed-serif ed-head text-[var(--ed-ink)] mb-2">{lang === 'zh' ? '這個類別暫無推薦' : 'No picks in this category yet'}</p>
                <p className="text-[16px] text-[var(--ed-muted)]">{lang === 'zh' ? '持續更新中。' : 'More coming soon.'}</p>
              </div>
            )}
          </div>
        )}

        {/* 篩選／搜尋結果 */}
        {!showSections && (
          <section className="ed-wrap pt-10 lg:pt-14" aria-labelledby="sec-results">
            {filtered.length > 0 ? (
              <>
                <div className="flex items-end justify-between gap-4 mb-6">
                  <h2 id="sec-results" className="ed-serif ed-head text-[var(--ed-ink)]" aria-live="polite">
                    {lang === 'zh' ? `${filtered.length} 家` : `${filtered.length} places`}
                  </h2>
                  <label className="flex items-center gap-1.5 text-[16px]">
                    <span className="sr-only">{lang === 'zh' ? '排序' : 'Sort'}</span>
                    <select
                      value={sortBy === 'distance' && !nearbyAnchor ? 'default' : sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="h-11 bg-[var(--ed-surface)] rounded-full px-4 text-[16px] text-[var(--ed-ink)] outline-none"
                    >
                      <option value="default">{lang === 'zh' ? '預設排序' : 'Default'}</option>
                      <option value="rating">{lang === 'zh' ? '評分高到低' : 'Top rated'}</option>
                      {nearbyAnchor && <option value="distance">{lang === 'zh' ? '距離近到遠' : 'Nearest'}</option>}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-10 lg:gap-x-6">
                  {gridItems.slice(0, gridLimit).map((loc, i) => (
                    <Reveal key={loc.id} delay={(i % 5) * 60}>
                      <EditorialCard
                        location={loc}
                        lang={lang}
                        distanceKm={nearbyAnchor ? haversineKm(nearbyAnchor.lat, nearbyAnchor.lng, loc.lat, loc.lng) : undefined}
                        saved={savedIds.has(loc.id)}
                        onToggleSave={handleToggleSave}
                      />
                    </Reveal>
                  ))}
                </div>
                {filtered.length > gridLimit && (
                  <div className="flex justify-center mt-12">
                    <button
                      onClick={() => setGridLimit((n) => n + GRID_PAGE)}
                      className="ed-press h-12 px-8 rounded-full bg-[var(--ed-ink)] text-white text-[16px]"
                    >
                      {lang === 'zh' ? '載入更多' : 'Load more'}
                      <span className="ml-2 opacity-70 tabular-nums">{Math.min(gridLimit, filtered.length)} / {filtered.length}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-24 text-center">
                <h2 id="sec-results" className="ed-serif ed-head text-[var(--ed-ink)] mb-2">
                  {specialFilter === 'saved'
                    ? (lang === 'zh' ? '還沒有收藏任何地點' : 'No saved places yet')
                    : specialFilter === 'nearby'
                      ? (!nearbyAnchor
                          ? (lang === 'zh' ? '選一個地標看看附近有什麼' : 'Pick a landmark to see what is nearby')
                          : (lang === 'zh' ? '5 公里內沒有符合的地點' : 'Nothing matches within 5 km'))
                      : (strings[lang].emptyState as string)}
                </h2>
                <p className="text-[16px] text-[var(--ed-muted)]">
                  {specialFilter === 'saved'
                    ? (lang === 'zh' ? '在店家照片上按愛心，就會收在這裡。' : 'Tap the heart on any photo to save it here.')
                    : specialFilter === 'nearby' && nearbyAnchor
                      ? (lang === 'zh' ? '換個地標，或清掉分類篩選試試。' : 'Try another landmark or clear the category filter.')
                      : (lang === 'zh' ? '換個關鍵字試試。' : 'Try another word.')}
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="ed-wrap pt-40 pb-8 grid gap-2 lg:grid-cols-[1fr_auto_1fr] lg:items-baseline text-[16px] text-[var(--ed-muted)]">
        <span>{lang === 'zh' ? '曼谷人，住在曼谷的人推薦的店' : 'BKK LOCAL, picks from people who live here'}</span>
        <nav aria-label={lang === 'zh' ? '分類' : 'Categories'} className="flex flex-wrap gap-x-6 gap-y-1">
          {(['food', 'cafe', 'nightlife', 'shopping'] as const).map((c) => (
            <Link key={c} href={`/category/${c}`} className="ed-link text-[var(--ed-ink)]">
              {strings[lang][`category${c[0].toUpperCase()}${c.slice(1)}` as keyof typeof strings.zh] as string}
            </Link>
          ))}
        </nav>
        <span className="lg:text-right">© {new Date().getFullYear()} BKK LOCAL</span>
      </footer>
    </div>
  )
}
