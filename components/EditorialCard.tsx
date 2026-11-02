'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import type { Location } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'
import { buildMapsUrl } from '@/lib/maps'
import { photoUrl, FALLBACK_PHOTO } from '@/lib/photo'
import { openStatus, openStatusText } from '@/lib/openStatus'
import { useBangkokMinute } from '@/lib/useBangkokMinute'

// 首頁文青版的店家卡：照片為主、不畫框線，文字直接排在照片下。
// 其他頁面仍用 LocationCard；這張卡確定採用後再取代它。

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

// 介紹裡偶爾夾著 emoji（舊資料），版面上拿掉
const EMOJI = new RegExp('[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}\\u{1F3FB}-\\u{1F3FF}]', 'gu')
const stripEmoji = (s: string) => s.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim()

type Props = {
  location: Location
  lang: Lang
  distanceKm?: number
  saved?: boolean
  onToggleSave?: (id: string) => void
}

export function EditorialCard({ location, lang, distanceKm, saved = false, onToggleSave }: Props) {
  const [copied, setCopied] = useState(false)
  const minute = useBangkokMinute()
  const status = location.hours && minute !== null ? openStatus(location.hours, minute) : null

  const name = stripEmoji(lang === 'zh' ? location.name_zh : location.name_en)
  const rawDesc = (lang === 'zh' ? location.description_zh : location.description_en) ?? ''
  const desc = stripEmoji(rawDesc.replace(/^必點：[^。]*。\s*/, '') || rawDesc)
  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th
  const highlights = (location.highlights ?? []).slice(0, 2).map(stripEmoji)

  const photo = photoUrl(location.photos[0], 480)
  const [imgSrc, setImgSrc] = useState(photo)
  const retried = useRef(false)
  function handleImgError() {
    if (!retried.current && photo.startsWith('/api/photo')) {
      retried.current = true
      setImgSrc(`${photo}&t=${Date.now()}`)
    } else if (imgSrc !== FALLBACK_PHOTO) {
      setImgSrc(FALLBACK_PHOTO)
    }
  }

  // 橫向列裡的卡片原生 lazy loading 無效，接近畫面才掛圖片（同 LocationCard）
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

  function copyThai(e: React.MouseEvent) {
    e.preventDefault()
    navigator.clipboard.writeText([thaiName, thaiAddress].filter(Boolean).join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function toggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggleSave?.(location.id)
  }

  const meta = [
    location.price_range > 0 ? '฿'.repeat(location.price_range) : null,
    location.area && location.area !== 'Bangkok' ? location.area : null,
    distanceKm !== undefined ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`) : null,
  ].filter(Boolean)

  return (
    <article className="ed-card group relative flex flex-col h-full">
      <Link href={`/location/${location.slug ?? location.id}`} aria-label={name} className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-4" />

      <div ref={photoBox} className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--ed-surface)]">
        {nearView && (
          <Image
            src={imgSrc}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 66vw, 280px"
            unoptimized
            onError={handleImgError}
          />
        )}
        {onToggleSave && (
          <button
            onClick={toggleSave}
            aria-label={saved ? (lang === 'zh' ? '取消收藏' : 'Unsave') : (lang === 'zh' ? '收藏' : 'Save')}
            aria-pressed={saved}
            className="ed-press absolute z-20 right-2 bottom-2 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 text-[var(--ed-ink)] hover:bg-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
      </div>

      <div className="pt-3 flex flex-col flex-1">
        <h3 className="ed-serif text-[20px] leading-snug text-[var(--ed-ink)] line-clamp-1">{name}</h3>
        <p className="mt-1 text-[16px] leading-relaxed text-[var(--ed-ink)] line-clamp-2">{desc}</p>

        {highlights.length > 0 && (
          <p className="mt-1.5 text-[13px] text-[var(--ed-muted)] line-clamp-1">{highlights.join('・')}</p>
        )}

        <div className="mt-auto pt-2.5 flex items-center gap-x-2 text-[13px] text-[var(--ed-muted)] tabular-nums whitespace-nowrap overflow-hidden">
          <span className="shrink-0 text-[var(--ed-ink)]">
            {location.rating.toFixed(1)}
            {location.reviews ? <span className="text-[var(--ed-muted)]">（{location.reviews.toLocaleString('en-US')}）</span> : null}
          </span>
          {meta.map((m) => <span key={m as string} className="shrink-0">{m}</span>)}
        </div>

        {location.hours && (
          <p className={`h-[20px] text-[13px] line-clamp-1 ${status?.open ? 'text-[var(--ed-open)]' : 'text-[var(--ed-muted)]'}`}>
            {status ? openStatusText(status, lang) : ''}
          </p>
        )}

        <div className="relative z-20 mt-2 flex items-center gap-4 text-[13px]">
          <a
            href={buildMapsUrl(location)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${strings[lang].navigate as string}：${name}`}
            className="ed-link py-1.5 text-[var(--ed-ink)]"
          >
            {strings[lang].navigate as string}
          </a>
          {(thaiName || thaiAddress) && (
            <button onClick={copyThai} className="ed-link py-1.5 text-[var(--ed-ink)]">
              {copied ? (strings[lang].copied as string) : (strings[lang].copyThai as string)}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
