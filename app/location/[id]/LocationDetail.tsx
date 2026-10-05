'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IconPin } from '@/components/icons/CategoryIcons'
import type { Location, LocationTag } from '@/lib/types'
import type { WeekHours } from '@/lib/placeInfo'
import type { NearestStation } from '@/lib/transit'
import { useLanguage } from '@/hooks/useLanguage'
import { SocialEmbed } from '@/components/SocialEmbed'
import { buildMapsUrl } from '@/lib/maps'
import { photoUrl, FALLBACK_PHOTO } from '@/lib/photo'
import { TAG_ICON } from '@/components/icons/TagIcons'
import { DragScroll } from '@/components/DragScroll'
import { LocationCard } from '@/components/LocationCard'

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

const TAG_META: Record<LocationTag, { emoji: string; zh: string; en: string; color: string }> = {
  trending:    { emoji: '🔥', zh: '話題爆紅', en: 'Trending',   color: 'bg-orange-500' },
  hidden_gem:  { emoji: '🗺', zh: '在地私藏', en: 'Hidden Gem', color: 'bg-emerald-600' },
  new_opening: { emoji: '✨', zh: '新開幕',   en: 'New',        color: 'bg-violet-500' },
  evergreen:   { emoji: '📌', zh: '經典必訪', en: 'Must Visit', color: 'bg-sky-500' },
}

const CATEGORY_LABEL: Record<string, { zh: string; en: string }> = {
  food:       { zh: '餐廳',   en: 'Restaurant' },
  cafe:       { zh: '咖啡廳', en: 'Cafe' },
  shopping:   { zh: '購物',   en: 'Shopping' },
  nightlife:  { zh: '夜生活', en: 'Nightlife' },
  hotel:      { zh: '飯店',   en: 'Hotel' },
  attraction: { zh: '景點',   en: 'Attraction' },
}

function resolveTag(loc: Location): LocationTag {
  if (loc.tag) return loc.tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((loc as any).trending === true) return 'trending'
  return 'evergreen'
}

type Nearby = { location: Location; km: number }

type Props = {
  location: Location
  nearby?: Nearby[]
  hours?: WeekHours | 'always' | null
  station?: NearestStation | null
}

const DAYS = { zh: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }

// 把營業時間相同的連續幾天併成一列（例：週一至週五 11:00–22:00）
function groupHours(week: WeekHours, lang: 'zh' | 'en'): { days: string; hours: string; from: number; to: number }[] {
  const closed = lang === 'zh' ? '公休' : 'Closed'
  const text = week.map((d) => (d.length ? d.join(lang === 'zh' ? '、' : ', ') : closed))
  const rows: { days: string; hours: string; from: number; to: number }[] = []
  for (let i = 0; i < 7; i++) {
    const last = rows[rows.length - 1]
    if (last && last.hours === text[i] && last.to === i - 1) last.to = i
    else rows.push({ days: '', hours: text[i], from: i, to: i })
  }
  const d = DAYS[lang]
  for (const r of rows) {
    r.days = r.from === 0 && r.to === 6 ? (lang === 'zh' ? '每天' : 'Daily')
      : r.from === r.to ? d[r.from]
      : `${d[r.from]}${lang === 'zh' ? '至' : '–'}${d[r.to]}`
  }
  return rows
}

export function LocationDetail({ location, nearby = [], hours = null, station = null }: Props) {
  const router = useRouter()
  const { lang } = useLanguage()
  const [activePhoto, setActivePhoto] = useState(0)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  // 這個分頁來過首頁就正常返回（保留捲動/篩選）；直接從外部分享連結進來的就導去首頁
  function goBack() {
    if (typeof window !== 'undefined' && sessionStorage.getItem('bkk_visited_home')) router.back()
    else router.push('/')
  }

  async function shareLocation() {
    const url = `https://www.bkk-local.com/location/${location.slug ?? location.id}`
    const text = lang === 'zh'
      ? `${name} — 曼谷人 BKK LOCAL 推薦`
      : `${name} — Recommended by BKK LOCAL`
    if (navigator.share) {
      await navigator.share({ title: name, text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 1500)
    }
  }

  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th

  const name = lang === 'zh' ? location.name_zh : location.name_en
  const desc = lang === 'zh' ? location.description_zh : location.description_en

  const mapsUrl = buildMapsUrl(location)

  // Load saved state
  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem('saved_locations') ?? '[]') as string[]
      setSaved(ids.includes(location.id))
    } catch { /* ignore */ }
  }, [location.id])

  // 照片：用爬蟲時已存的 refs（不再即時打 Google Place Details 省費用）；全部走 /api/photo 代理
  const allRefs = location.photos.filter(Boolean)
  const allPhotos = allRefs.map((r) => photoUrl(r, 800))

  // 照片載入失敗（例如 Google 帳單停用導致 403）時換成預設圖，避免破圖
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set())
  const srcOf = (url: string) => (brokenUrls.has(url) ? FALLBACK_PHOTO : url)
  const markBroken = (url: string) => setBrokenUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))

  function toggleSave() {
    try {
      const ids = JSON.parse(localStorage.getItem('saved_locations') ?? '[]') as string[]
      const next = saved ? ids.filter((x) => x !== location.id) : [...ids, location.id]
      localStorage.setItem('saved_locations', JSON.stringify(next))
      setSaved(!saved)
    } catch { /* ignore */ }
  }

  function copyThai() {
    const text = [thaiName, thaiAddress].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const cleanDesc = desc?.replace(/^必點：[^。]*。\s*/, '') ?? ''

  // 今天是曼谷的星期幾（0=週一），用來標出今天的營業時間；只在瀏覽器端算，避免 SSR 與使用者時區不一致
  const [today, setToday] = useState<number | null>(null)
  useEffect(() => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(new Date())
    setToday(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd))
  }, [])

  const listedAt = location.approved_at ? new Date(location.approved_at) : null
  const sectionTitle = 'text-[12px] font-bold text-muted mb-1.5 tracking-[0.08em]'

  return (
    <div className="max-w-md lg:max-w-5xl mx-auto bg-white min-h-screen lg:border-x lg:border-line">
      <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:p-8 lg:items-start">

        {/* 照片欄（桌機固定在左側） */}
        <div className="lg:sticky lg:top-8">
          <div className="relative w-full h-72 lg:h-[460px] bg-gray-100 lg:rounded-lg lg:overflow-hidden">
            {allPhotos.length > 0 ? (
              <Image
                src={srcOf(allPhotos[activePhoto] ?? allPhotos[0])}
                alt={name}
                fill
                className="object-cover"
                unoptimized
                priority
                onError={() => markBroken(allPhotos[activePhoto] ?? allPhotos[0])}
              />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

            <button
              onClick={goBack}
              aria-label={lang === 'zh' ? '返回' : 'Back'}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/45 flex items-center justify-center text-white hover:bg-black/65 transition-colors"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              onClick={shareLocation}
              aria-label={lang === 'zh' ? '分享' : 'Share'}
              className="absolute top-4 right-16 w-10 h-10 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/65 transition-colors"
            >
              {shared
                ? <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>

            <button
              onClick={toggleSave}
              aria-label={saved ? (lang === 'zh' ? '取消收藏' : 'Unsave') : (lang === 'zh' ? '收藏' : 'Save')}
              aria-pressed={saved}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/65 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : 'white'} strokeWidth={2.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {(() => {
              const tag = resolveTag(location)
              const meta = TAG_META[tag]
              const TagIcon = TAG_ICON[tag]
              return (
                <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 text-[11px] font-bold bg-white text-ink px-2 py-1 rounded-sm">
                  <TagIcon size={12} className="shrink-0 text-brand" /> {lang === 'zh' ? meta.zh : meta.en}
                </span>
              )
            })()}
          </div>

          {allPhotos.length > 1 && (
            <DragScroll className="flex gap-2 px-4 lg:px-0 py-2.5 overflow-x-auto no-scrollbar border-b border-line lg:border-b-0">
              {allPhotos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  aria-label={lang === 'zh' ? `第 ${i + 1} 張照片` : `Photo ${i + 1}`}
                  className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${i === activePhoto ? 'border-brand' : 'border-transparent'}`}
                >
                  <Image src={srcOf(url)} alt="" width={64} height={64} className="object-cover w-full h-full" unoptimized onError={() => markBroken(url)} />
                </button>
              ))}
            </DragScroll>
          )}
        </div>

        {/* 內容欄 */}
        <div className="px-4 lg:px-0 pt-4 lg:pt-0 pb-6 lg:pb-0">

          {(thaiName || thaiAddress) && (
            <div className="flex justify-end mb-1">
              <button
                onClick={copyThai}
                className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-sm border border-line text-muted hover:text-ink hover:border-ink/40 transition-colors"
              >
                {copied ? (lang === 'zh' ? '已複製' : 'Copied!') : 'ภาษาไทย'}
              </button>
            </div>
          )}

          <h1 className="font-liufen text-[26px] lg:text-[32px] text-ink leading-tight mt-1 mb-1.5">{name}</h1>

          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-line">
            <span className="text-base font-bold text-ink"><span className="text-amber-500">★</span> {location.rating.toFixed(1)}</span>
            {location.price_range > 0 && (
              <span className="text-sm text-muted">{'฿'.repeat(location.price_range)}</span>
            )}
            <span className="text-sm text-muted">{CATEGORY_LABEL[location.category]?.[lang] ?? location.category}</span>
          </div>

          {location.curator_note && (
            <div className="mb-5 border-l-2 border-brand pl-4 py-1">
              <p className="text-[11px] font-bold text-brand tracking-wide mb-1">
                {lang === 'zh' ? '在地人怎麼說' : "Local's Take"}
              </p>
              <p className="text-[15px] text-ink leading-relaxed">{location.curator_note}</p>
            </div>
          )}

          {cleanDesc && (
            <div className="mb-6">
              <h2 className={sectionTitle}>{lang === 'zh' ? '關於' : 'About'}</h2>
              <p className="text-[15px] text-ink/85 leading-[1.75]">{cleanDesc}</p>
            </div>
          )}

          {(location.highlights?.length ?? 0) > 0 && (
            <div className="mb-6">
              <h2 className={sectionTitle}>{lang === 'zh' ? '必點' : 'Must Try'}</h2>
              <div className="flex flex-wrap gap-2">
                {location.highlights!.map((h) => (
                  <span key={h} className="text-[12px] text-ink border border-line px-2.5 py-1 rounded-sm">{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* 營業時間（來源 Google，30 天更新一次） */}
          {hours && (
            <div className="mb-6">
              <h2 className={sectionTitle}>{lang === 'zh' ? '營業時間' : 'Hours'}</h2>
              {hours === 'always' ? (
                <p className="text-[14px] text-ink">{lang === 'zh' ? '24 小時營業' : 'Open 24 hours'}</p>
              ) : (
                <dl className="text-[14px]">
                  {groupHours(hours, lang).map((r) => {
                    const isToday = today !== null && today >= r.from && today <= r.to
                    return (
                      <div key={r.from} className={`flex gap-4 py-0.5 ${isToday ? 'text-ink font-bold' : 'text-ink/75'}`}>
                        <dt className="w-24 shrink-0">{r.days}{isToday ? (lang === 'zh' ? '（今天）' : ' (today)') : ''}</dt>
                        <dd>{r.hours}</dd>
                      </div>
                    )
                  })}
                </dl>
              )}
              <p className="text-[11px] text-muted mt-1.5">
                {lang === 'zh' ? '時間取自 Google 地圖，節日可能調整，出發前建議再確認。' : 'From Google Maps. Hours may change on holidays.'}
              </p>
            </div>
          )}

          {(location.address || station) && (
            <div className="mb-6">
              <h2 className={sectionTitle}>{lang === 'zh' ? '怎麼去' : 'Getting there'}</h2>
              {station && (
                <p className="text-[14px] text-ink mb-1">
                  {station.sys === 'ARL' ? (lang === 'zh' ? '機場快線' : 'Airport Rail Link') : station.sys} {station.name}
                  <span className="text-muted">
                    {lang === 'zh' ? `　步行約 ${station.walkMinutes} 分鐘（直線 ${station.meters} 公尺）` : ` · about ${station.walkMinutes} min walk (${station.meters} m)`}
                  </span>
                </p>
              )}
              {location.address && <p className="text-[13px] text-ink/75 leading-relaxed">{location.address}</p>}
              {station && (
                <p className="text-[11px] text-muted mt-1.5">
                  {lang === 'zh' ? '步行時間依直線距離估算。車站位置 © OpenStreetMap 貢獻者。' : 'Walking time estimated from straight-line distance. Station data © OpenStreetMap contributors.'}
                </p>
              )}
              {thaiAddress && <p className="text-[13px] text-muted mt-0.5">{thaiAddress}</p>}
            </div>
          )}

          {location.social_embed_url && (
            <div className="mb-6">
              <h2 className="text-[12px] font-bold text-muted mb-2.5 tracking-[0.08em]">{lang === 'zh' ? '社群影片' : 'Social Video'}</h2>
              <SocialEmbed url={location.social_embed_url} />
            </div>
          )}

          {listedAt && (
            <p className="text-[12px] text-muted mb-6">
              {lang === 'zh'
                ? `收錄於 ${listedAt.getFullYear()} 年 ${listedAt.getMonth() + 1} 月`
                : `Listed ${listedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}`}
            </p>
          )}

          {/* 桌機：導航按鈕放在內容欄裡 */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center justify-center gap-2 w-full py-3.5 bg-brand text-white font-bold text-[15px] rounded-lg hover:bg-brand-dark transition-colors"
          >
            <IconPin size={16} />
            {lang === 'zh' ? '在 Google Maps 導航' : 'Navigate with Google Maps'}
          </a>
        </div>
      </div>

      {/* 附近還有：看完這家可以順路去的其他地點 */}
      {nearby.length > 0 && (
        <div className="px-4 lg:px-8 pt-6 pb-6 lg:pb-10 border-t border-line">
          <h2 className="text-[12px] font-bold text-muted mb-2.5 tracking-[0.08em]">{lang === 'zh' ? '附近還有' : 'Also nearby'}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {nearby.map((n) => (
              <LocationCard key={n.location.id} location={n.location} lang={lang} distanceKm={n.km} compact />
            ))}
          </div>
        </div>
      )}

      {/* 手機：底部固定導航按鈕（上面留一段空白，內容才不會被按鈕蓋住） */}
      <div className="h-24 lg:hidden" />
      <div className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-3 bg-white border-t border-line">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-brand text-white font-bold text-[15px] rounded-lg hover:bg-brand-dark transition-colors"
        >
          <IconPin size={16} />
          {lang === 'zh' ? '在 Google Maps 導航' : 'Navigate with Google Maps'}
        </a>
      </div>
    </div>
  )
}
