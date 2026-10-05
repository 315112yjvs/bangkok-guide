'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { IconPin } from './icons/CategoryIcons'
import type { Location, Source, LocationTag } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'
import { buildMapsUrl } from '@/lib/maps'
import { photoUrl, FALLBACK_PHOTO } from '@/lib/photo'
import { TAG_ICON } from './icons/TagIcons'
import { MIcon } from './icons/MaterialIcons'

// Inline SVG icons for source badges (no emoji)
const SOURCE_SVG: Record<Source, string> = {
  tiktok:     '<path d="M9 12a3 3 0 1 0 3 3V4a5 5 0 0 0 5 5" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>',
  instagram:  '<rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="2" fill="none"/><circle cx="17.5" cy="6.5" r="1" fill="white"/>',
  pantip:     '<path d="M4 4h16v12H4z M8 16l4 4 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  wongnai:    '<path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="10" r="2.5" fill="white"/>',
  googlemaps: '<path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="white"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/>',
  media:      '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  manual:     '<path d="M11 4H4v14h14v-7M18 2l-8 8M15 2h5v5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
}

const SOURCE_BADGE: Record<Source, { label: keyof typeof strings.zh; color: string }> = {
  tiktok:     { label: 'sourceTikTok',    color: 'bg-emerald-500' },
  instagram:  { label: 'sourceIG',        color: 'bg-purple-500' },
  pantip:     { label: 'sourcePantip',    color: 'bg-orange-500' },
  wongnai:    { label: 'sourceWongnai',   color: 'bg-red-500' },
  googlemaps: { label: 'sourceGoogleMaps',color: 'bg-blue-500' },
  media:      { label: 'sourceMedia',     color: 'bg-teal-500' },
  manual:     { label: 'sourceManual',    color: 'bg-amber-500' },
}

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

function resolveTag(loc: Location): LocationTag {
  if (loc.tag) return loc.tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((loc as any).trending === true) return 'trending'
  return 'evergreen'
}

const TAG_BADGE: Record<LocationTag, { emoji: string; zh: string; en: string; color: string }> = {
  trending:    { emoji: '🔥', zh: '話題爆紅', en: 'Trending',   color: 'bg-orange-500' },
  hidden_gem:  { emoji: '🗺', zh: '在地私藏', en: 'Hidden Gem', color: 'bg-emerald-600' },
  new_opening: { emoji: '✨', zh: '新開幕',   en: 'New',        color: 'bg-violet-500' },
  evergreen:   { emoji: '📌', zh: '經典必訪', en: 'Must Visit', color: 'bg-sky-500' },
}


type Props = { location: Location; lang: Lang; distanceKm?: number; saved?: boolean; onToggleSave?: (id: string) => void; compact?: boolean; hideTag?: boolean }

export function LocationCard({ location, lang, distanceKm, saved: savedProp = false, onToggleSave, compact = false, hideTag = false }: Props) {
  const [copied, setCopied] = useState(false)

  // 沒有外部 onToggleSave（分類/主題/區域頁、地點頁的附近推薦）時，卡片自己讀寫 localStorage 收藏
  const [localSaved, setLocalSaved] = useState(false)
  useEffect(() => {
    if (onToggleSave) return
    try {
      const ids = JSON.parse(localStorage.getItem('saved_locations') ?? '[]') as string[]
      setLocalSaved(ids.includes(location.id))
    } catch { /* ignore */ }
  }, [onToggleSave, location.id])
  const saved = onToggleSave ? savedProp : localSaved

  function toggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (onToggleSave) { onToggleSave(location.id); return }
    try {
      const ids = JSON.parse(localStorage.getItem('saved_locations') ?? '[]') as string[]
      const next = localSaved ? ids.filter((x) => x !== location.id) : [...ids, location.id]
      localStorage.setItem('saved_locations', JSON.stringify(next))
      setLocalSaved(!localSaved)
    } catch { /* ignore */ }
  }

  const badge = SOURCE_BADGE[location.source]
  const name = lang === 'zh' ? location.name_zh : location.name_en
  // Strip "必點：..." prefix from description since highlights shown separately as pills
  const rawDesc = lang === 'zh' ? location.description_zh : location.description_en
  const desc = rawDesc?.replace(/^必點：[^。]*。\s*/, '') || rawDesc

  const tag = resolveTag(location)
  const tagMeta = TAG_BADGE[tag]
  const TagIcon = TAG_ICON[tag]

  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th

  const mapsUrl = buildMapsUrl(location)

  // 照片走 /api/photo 代理（CDN 快取、不外露 key）；載入失敗時換預設圖避免破圖
  // 卡片最寬約 330px，抓 480 就夠（原本抓 800，流量多一倍以上）
  const photo = photoUrl(location.photos[0], 480)
  const [imgSrc, setImgSrc] = useState(photo)
  // 圖片載入失敗時先重試一次（冷快取/暫時性錯誤常一試就過），第二次才換預設圖
  const retried = useRef(false)
  function handleImgError() {
    if (!retried.current && photo.startsWith('/api/photo')) {
      retried.current = true
      setImgSrc(`${photo}&t=${Date.now()}`)
    } else if (imgSrc !== FALLBACK_PHOTO) {
      setImgSrc(FALLBACK_PHOTO)
    }
  }

  // 只在卡片接近可視範圍時才掛上圖片。瀏覽器原生的 lazy loading 對「橫向滑動、但垂直位置在畫面內」
  // 的卡片無效，首頁四個分區會一次抓 60 張圖（實測首次載入 5.4MB）。
  const photoBox = useRef<HTMLDivElement>(null)
  const [nearView, setNearView] = useState(false)
  useEffect(() => {
    const el = photoBox.current
    if (!el || typeof IntersectionObserver === 'undefined') { setNearView(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNearView(true); io.disconnect() }
    }, { rootMargin: '300px 200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const visibleHighlights = (location.highlights ?? []).slice(0, 2)
  const extraHighlights = (location.highlights?.length ?? 0) - 2

  function copyThai() {
    const text = [thaiName, thaiAddress].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="group relative flex flex-col h-full bg-white rounded-lg overflow-hidden border border-line hover:border-ink/30 transition-colors duration-200">
      {/* 整卡可點的連結鋪在上層（z-10）、互動按鈕疊更高（z-20）：
          避免 <a> 巢套 <a>（無效 HTML，會導致 hydration 失敗、整頁 client 重渲染） */}
      <Link href={`/location/${location.slug ?? location.id}`} aria-label={name} className="absolute inset-0 z-10 rounded-lg" />
      {/* Photo */}
      <div ref={photoBox} className="relative h-36 w-full overflow-hidden bg-paper">
        {nearView && <Image
          src={imgSrc}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 33vw"
          unoptimized
          onError={handleImgError}
        />}
        {/* Tag label — skip evergreen */}
        {tag !== 'evergreen' && !hideTag && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold bg-white text-ink px-1.5 py-0.5 rounded-sm">
            <TagIcon size={11} className="shrink-0 text-brand" /> {lang === 'zh' ? tagMeta.zh : tagMeta.en}
          </span>
        )}
      </div>

      <div className="p-2.5 flex flex-col flex-1">
        {/* Name row */}
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <h3 className="text-[14px] font-bold text-ink leading-tight line-clamp-1 flex-1">{name}</h3>
          </div>
          {(thaiName || thaiAddress) && (
            <button
              onClick={copyThai}
              title={strings[lang].copyThai as string}
              className="relative z-20 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-line text-muted hover:text-ink hover:border-ink/40 transition-colors"
            >
              {copied ? (strings[lang].copied as string) : 'ภาษาไทย'}
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-[11px] text-muted mb-1 line-clamp-1">{desc}</p>

        {/* Curator note */}
        {location.curator_note && (
          <p className="flex items-center gap-1 text-[10px] text-brand bg-brand-soft rounded-sm px-2 py-1 mb-1 line-clamp-1 font-medium">
            <MIcon name="format_quote" size={12} className="shrink-0" /> {location.curator_note}
          </p>
        )}

        {/* Highlights */}
        {visibleHighlights.length > 0 && (
          <div className="flex items-center gap-1 mb-1.5 overflow-hidden whitespace-nowrap">
            {visibleHighlights.map((h) => (
              <span key={h} className="shrink-0 text-[10px] text-muted border border-line px-1.5 py-0.5 rounded-sm">
                {h}
              </span>
            ))}
            {extraHighlights > 0 && (
              <span className="text-[10px] text-gray-400 font-semibold">+{extraHighlights}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-1 mt-auto">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="shrink-0 text-[11px] font-bold text-ink"><span className="text-amber-500">★</span> {location.rating.toFixed(1)}</span>
            {location.price_range > 0 && (
              <span className="shrink-0 text-[10px] text-muted">{'฿'.repeat(location.price_range)}</span>
            )}
            {distanceKm !== undefined && (
              <span className="shrink-0 text-[10px] font-bold text-brand">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
              </span>
            )}
            {location.area && location.area !== 'Bangkok' && (
              <span className="min-w-0 text-[10px] text-muted truncate">{location.area}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleSave}
              aria-label={saved ? (lang === 'zh' ? '取消收藏' : 'Unsave') : (lang === 'zh' ? '收藏' : 'Save')}
              aria-pressed={saved}
              className={`relative z-20 shrink-0 w-8 h-8 flex items-center justify-center rounded-md transition-colors ${saved ? 'text-red-500' : 'text-gray-400 hover:text-ink'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${strings[lang].navigate as string} — ${name}`}
              className="relative z-20 shrink-0 flex items-center justify-center gap-1 h-8 min-w-8 border border-line text-ink text-[10px] font-bold rounded-md px-2 whitespace-nowrap hover:border-ink/40 transition-colors"
            >
              <IconPin size={13} className="shrink-0" />
              {!compact && (strings[lang].navigate as string)}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
