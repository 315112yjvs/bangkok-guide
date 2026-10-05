'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IconPin } from '@/components/icons/CategoryIcons'
import type { Location, LocationTag } from '@/lib/types'
import { useLanguage } from '@/hooks/useLanguage'
import { SocialEmbed } from '@/components/SocialEmbed'
import { buildMapsUrl } from '@/lib/maps'
import { photoUrl, FALLBACK_PHOTO } from '@/lib/photo'
import { TAG_ICON } from '@/components/icons/TagIcons'
import { Reveal } from '@/components/Reveal'
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

export function LocationDetail({ location, nearby = [] }: { location: Location; nearby?: Nearby[] }) {
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

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen lg:border-x lg:border-line">

      {/* Hero photo */}
      <div className="relative w-full h-72 bg-gray-100">
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
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Back */}
        <button
          onClick={goBack}
          aria-label={lang === 'zh' ? '返回' : 'Back'}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Share */}
        <button
          onClick={shareLocation}
          aria-label={lang === 'zh' ? '分享' : 'Share'}
          className="absolute top-4 right-16 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          {shared
            ? <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </button>

        {/* Save */}
        <button
          onClick={toggleSave}
          aria-label={saved ? (lang === 'zh' ? '取消收藏' : 'Unsave') : (lang === 'zh' ? '收藏' : 'Save')}
          aria-pressed={saved}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : 'white'} strokeWidth={2.5}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Tag badge */}
        {(() => {
          const tag = resolveTag(location)
          const meta = TAG_META[tag]
          const TagIcon = TAG_ICON[tag]
          return (
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-ink px-2 py-1 rounded-sm">
                <TagIcon size={12} className="shrink-0 text-brand" /> {lang === 'zh' ? meta.zh : meta.en}
              </span>
            </div>
          )
        })()}
      </div>

      {/* Thumbnail strip */}
      {allPhotos.length > 1 && (
        <DragScroll className="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-line">
          {allPhotos.map((url, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${i === activePhoto ? 'border-brand' : 'border-transparent'}`}
            >
              <Image src={srcOf(url)} alt="" width={64} height={64} className="object-cover w-full h-full" unoptimized onError={() => markBroken(url)} />
            </button>
          ))}
        </DragScroll>
      )}

      <div className="px-4 pt-4 pb-24">

        {/* Thai copy button */}
        {(thaiName || thaiAddress) && (
          <div className="flex items-start justify-end gap-2 mb-1">
            <button
              onClick={copyThai}
              className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-sm border border-line text-muted hover:text-ink hover:border-ink/40 transition-colors"
            >
              {copied ? (lang === 'zh' ? '已複製' : 'Copied!') : 'ภาษาไทย'}
            </button>
          </div>
        )}

        <h1 className="font-liufen text-[26px] text-ink leading-tight mt-1 mb-1.5">{name}</h1>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-line">
          <span className="text-base font-bold text-ink"><span className="text-amber-500">★</span> {location.rating.toFixed(1)}</span>
          {location.price_range > 0 && (
            <span className="text-sm text-gray-400 font-semibold">{'฿'.repeat(location.price_range)}</span>
          )}
          <span className="text-xs text-gray-400">{CATEGORY_LABEL[location.category]?.[lang] ?? location.category}</span>
        </div>

        {/* Curator note */}
        {location.curator_note && (
          <Reveal className="mb-5 border-l-2 border-brand pl-4 py-1">
            <p className="text-[11px] font-bold text-brand tracking-wide mb-1">
              {lang === 'zh' ? '在地人怎麼說' : "Local's Take"}
            </p>
            <p className="text-[15px] text-ink leading-relaxed">{location.curator_note}</p>
          </Reveal>
        )}

        {/* Description */}
        {cleanDesc && (
          <Reveal delay={60} className="mb-4">
            <h2 className="text-[12px] font-bold text-muted mb-1.5 tracking-[0.08em]">
              {lang === 'zh' ? '關於' : 'About'}
            </h2>
            <p className="text-[15px] text-ink/85 leading-[1.75]">{cleanDesc}</p>
          </Reveal>
        )}

        {/* Highlights */}
        {(location.highlights?.length ?? 0) > 0 && (
          <Reveal delay={120} className="mb-4">
            <h2 className="text-[12px] font-bold text-muted mb-1.5 tracking-[0.08em]">
              {lang === 'zh' ? '必點' : 'Must Try'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {location.highlights!.map((h) => (
                <span key={h} className="text-[12px] text-ink border border-line px-2.5 py-1 rounded-sm">
                  {h}
                </span>
              ))}
            </div>
          </Reveal>
        )}

        {/* Address */}
        {location.address && (
          <Reveal delay={180} className="mb-4">
            <h2 className="text-[12px] font-bold text-muted mb-1.5 tracking-[0.08em]">
              {lang === 'zh' ? '地址' : 'Address'}
            </h2>
            <p className="text-[13px] text-ink/75 leading-relaxed">{location.address}</p>
            {thaiAddress && (
              <p className="text-[12px] text-gray-400 mt-0.5">{thaiAddress}</p>
            )}
          </Reveal>
        )}

        {/* Social embed */}
        {location.social_embed_url && (
          <Reveal className="mb-4">
            <h2 className="text-[12px] font-bold text-muted mb-2.5 tracking-[0.08em]">
              {lang === 'zh' ? '社群影片' : 'Social Video'}
            </h2>
            <SocialEmbed url={location.social_embed_url} />
          </Reveal>
        )}

        {/* 附近還有：看完這家可以順路去的其他地點 */}
        {nearby.length > 0 && (
          <Reveal className="mt-8 pt-6 border-t border-line">
            <h2 className="text-[12px] font-bold text-muted mb-2.5 tracking-[0.08em]">
              {lang === 'zh' ? '附近還有' : 'Also nearby'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {nearby.map((n) => (
                <LocationCard key={n.location.id} location={n.location} lang={lang} distanceKm={n.km} compact />
              ))}
            </div>
          </Reveal>
        )}

      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-3 bg-white border-t border-line">
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
