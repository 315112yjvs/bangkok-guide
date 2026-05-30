'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { IconPin } from './icons/CategoryIcons'
import type { Location, Source } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

const SOURCE_BADGE: Record<Source, { label: keyof typeof strings.zh; icon: string; color: string }> = {
  tiktok:     { label: 'sourceTikTok',    icon: '🎵', color: 'bg-emerald-500' },
  instagram:  { label: 'sourceIG',        icon: '📷', color: 'bg-purple-500' },
  pantip:     { label: 'sourcePantip',    icon: '💬', color: 'bg-orange-500' },
  wongnai:    { label: 'sourceWongnai',   icon: '🍽️', color: 'bg-red-500' },
  googlemaps: { label: 'sourceGoogleMaps',icon: '📍', color: 'bg-blue-500' },
  manual:     { label: 'sourceManual',    icon: '✍️', color: 'bg-amber-500' },
}

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

type Props = { location: Location; lang: Lang; distanceKm?: number }

export function LocationCard({ location, lang, distanceKm }: Props) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem('saved_locations') ?? '[]')
    setSaved(ids.includes(location.id))
  }, [location.id])

  function toggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ids: string[] = JSON.parse(localStorage.getItem('saved_locations') ?? '[]')
    const next = saved ? ids.filter((id) => id !== location.id) : [...ids, location.id]
    localStorage.setItem('saved_locations', JSON.stringify(next))
    setSaved(!saved)
  }

  const badge = SOURCE_BADGE[location.source]
  const name = lang === 'zh' ? location.name_zh : location.name_en
  const desc = lang === 'zh' ? location.description_zh : location.description_en

  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th

  const mapsUrl = location.source_url?.includes('place_id:')
    ? location.source_url
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name_en + (location.address ? ' ' + location.address : ' Bangkok'))}`

  const rawPhoto = location.photos[0] ?? ''
  const photo = rawPhoto.startsWith('places/')
    ? `https://places.googleapis.com/v1/${rawPhoto}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : rawPhoto || 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=300&fit=crop'

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
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Photo */}
      <div className="relative h-28 w-full">
        <Image src={photo} alt={name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" unoptimized={rawPhoto.startsWith('places/')} />
        {/* Source badge */}
        <div className="absolute top-1.5 left-1.5">
          <span className={`inline-flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm ${badge.color}`}>
            {badge.icon} {strings[lang][badge.label] as string}
          </span>
        </div>
        {/* Trending badge */}
        {location.trending && (
          <div className="absolute top-1.5 right-1.5">
            <span className="inline-flex items-center gap-0.5 text-[8px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
              本週熱門
            </span>
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
            <span className="shrink-0 text-[7px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              {lang === 'zh' ? '營業中' : 'Open'}
            </span>
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
        <p className="text-[10px] text-gray-500 mb-1.5 line-clamp-1">{desc}</p>

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
            {location.price_range > 0 && (
              <span className="text-[9px] text-gray-300 font-semibold">{'฿'.repeat(location.price_range)}</span>
            )}
            {distanceKm !== undefined && (
              <span className="text-[9px] font-bold text-indigo-400">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleSave}
              className={`p-1.5 rounded-xl transition-colors ${saved ? 'text-red-500 bg-red-50' : 'text-gray-300 bg-gray-50 hover:text-red-400 hover:bg-red-50'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-[#1e1b4b] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl hover:bg-[#2d2a6e] transition-colors active:scale-95"
              onClick={(e) => e.stopPropagation()}
            >
              <IconPin size={11} />
              {strings[lang].navigate as string}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
