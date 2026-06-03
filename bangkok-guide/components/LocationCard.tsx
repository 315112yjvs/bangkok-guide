'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { IconPin } from './icons/CategoryIcons'
import type { Location, Source } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

// Inline SVG icons for source badges (no emoji)
const SOURCE_SVG: Record<Source, string> = {
  tiktok:     '<path d="M9 12a3 3 0 1 0 3 3V4a5 5 0 0 0 5 5" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>',
  instagram:  '<rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="2" fill="none"/><circle cx="17.5" cy="6.5" r="1" fill="white"/>',
  pantip:     '<path d="M4 4h16v12H4z M8 16l4 4 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  wongnai:    '<path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="10" r="2.5" fill="white"/>',
  googlemaps: '<path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="white"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/>',
  manual:     '<path d="M11 4H4v14h14v-7M18 2l-8 8M15 2h5v5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
}

const SOURCE_BADGE: Record<Source, { label: keyof typeof strings.zh; color: string }> = {
  tiktok:     { label: 'sourceTikTok',    color: 'bg-emerald-500' },
  instagram:  { label: 'sourceIG',        color: 'bg-purple-500' },
  pantip:     { label: 'sourcePantip',    color: 'bg-orange-500' },
  wongnai:    { label: 'sourceWongnai',   color: 'bg-red-500' },
  googlemaps: { label: 'sourceGoogleMaps',color: 'bg-blue-500' },
  manual:     { label: 'sourceManual',    color: 'bg-amber-500' },
}

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}


type Props = { location: Location; lang: Lang; distanceKm?: number; saved?: boolean; onToggleSave?: (id: string) => void; compact?: boolean }

export function LocationCard({ location, lang, distanceKm, saved = false, onToggleSave, compact = false }: Props) {
  const [copied, setCopied] = useState(false)

  function toggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggleSave?.(location.id)
  }

  const badge = SOURCE_BADGE[location.source]
  const name = lang === 'zh' ? location.name_zh : location.name_en
  // Strip "必點：..." prefix from description since highlights shown separately as pills
  const rawDesc = lang === 'zh' ? location.description_zh : location.description_en
  const desc = rawDesc?.replace(/^必點：[^。]*。\s*/, '') || rawDesc

  const isNewThisWeek = location.approved_at
    ? Date.now() - new Date(location.approved_at).getTime() < 7 * 24 * 60 * 60 * 1000
    : false

  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th

  const queryStr = encodeURIComponent(location.name_en + (location.address ? ' ' + location.address : ' Bangkok'))
  const placeId = location.source_url?.match(/place_id:([^&\s]+)/)?.[1]
  const mapsUrl = placeId
    ? `https://www.google.com/maps/search/?api=1&query=${queryStr}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${queryStr}`

  const rawPhoto = location.photos[0] ?? ''
  const photo = rawPhoto.startsWith('places/')
    ? `https://places.googleapis.com/v1/${rawPhoto}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : rawPhoto || 'https://images.unsplash.com/photo-1552911180-2a7279af1b85?w=400&h=300&fit=crop'

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
    <Link href={`/location/${location.id}`} className="block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Photo */}
      <div className="relative h-28 w-full">
        <Image src={photo} alt={name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" unoptimized={rawPhoto.startsWith('places/')} />
        {/* Source badge */}
        <div className="absolute top-1.5 left-1.5">
          <span className={`inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ${badge.color}`}>
            <svg width="9" height="9" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: SOURCE_SVG[location.source] }} />
            {strings[lang][badge.label] as string}
          </span>
        </div>
        {/* Trending / new badge */}
        {(location.trending || isNewThisWeek) && (
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-0.5">
            {location.trending && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                本週熱門
              </span>
            )}
            {isNewThisWeek && !location.trending && (
              <span className="inline-flex items-center text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                本週新增
              </span>
            )}
          </div>
        )}
        {/* Local ratio badge — only when not trending (avoid overlap) */}
        {!location.trending && location.local_ratio !== undefined && location.local_ratio >= 60 && (
          <div className="absolute top-1.5 right-1.5">
            <span className="inline-block text-[8px] font-bold bg-[#1a1a2e]/80 text-white px-1.5 py-0.5 rounded-full">
              🇹🇭 {location.local_ratio}%
            </span>
          </div>
        )}
      </div>

      <div className="p-2.5">
        {/* Name row */}
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <h3 className="text-[13px] font-bold text-[#1a1a2e] leading-tight line-clamp-1 flex-1">{name}</h3>
          </div>
          {(thaiName || thaiAddress) && (
            <button
              onClick={copyThai}
              title={strings[lang].copyThai as string}
              className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#f0edff] text-[#5b4fcf] hover:bg-[#e0daff] transition-colors"
            >
              {copied ? (strings[lang].copied as string) : 'ภาษาไทย'}
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-[10px] text-gray-500 mb-1 line-clamp-1">{desc}</p>

        {/* Curator note */}
        {location.curator_note && (
          <p className="text-[10px] text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1 mb-1 line-clamp-1 font-medium">
            💬 {location.curator_note}
          </p>
        )}

        {/* Highlights */}
        {visibleHighlights.length > 0 && (
          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            {visibleHighlights.map((h) => (
              <span key={h} className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full font-semibold">
                {h}
              </span>
            ))}
            {extraHighlights > 0 && (
              <span className="text-[8px] text-gray-400 font-semibold">+{extraHighlights}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="shrink-0 text-[10px] font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
            {location.price_range > 0 && (
              <span className="shrink-0 text-[9px] text-gray-300 font-semibold">{'฿'.repeat(location.price_range)}</span>
            )}
            {distanceKm !== undefined && (
              <span className="shrink-0 text-[9px] font-bold text-indigo-400">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
              </span>
            )}
            {location.area && location.area !== 'Bangkok' && (
              <span className="shrink-0 text-[9px] text-gray-400 font-medium truncate">{location.area}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleSave}
              className={`shrink-0 p-1.5 rounded-xl transition-colors ${saved ? 'text-red-500 bg-red-50' : 'text-gray-300 bg-gray-50 hover:text-red-400 hover:bg-red-50'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 h-7 bg-[#1e1b4b] text-white text-[10px] font-bold rounded-xl px-2.5 whitespace-nowrap hover:bg-[#2d2a6e] transition-colors active:scale-95"
              onClick={(e) => e.stopPropagation()}
            >
              <IconPin size={11} className="shrink-0" />
              {!compact && (strings[lang].navigate as string)}
            </a>
          </div>
        </div>
      </div>
    </Link>
  )
}
