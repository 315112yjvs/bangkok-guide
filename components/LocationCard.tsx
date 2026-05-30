'use client'
import Image from 'next/image'
import { useState } from 'react'
import { IconPin } from './icons/CategoryIcons'
import type { Location, Source } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

const SOURCE_BADGE: Record<Source, { label: keyof typeof strings.zh; icon: string; style: string }> = {
  tiktok:     { label: 'sourceTikTok',    icon: '🎵', style: 'bg-green-50 text-green-700 border border-green-200' },
  instagram:  { label: 'sourceIG',        icon: '📷', style: 'bg-purple-50 text-purple-700 border border-purple-200' },
  pantip:     { label: 'sourcePantip',    icon: '💬', style: 'bg-orange-50 text-orange-700 border border-orange-200' },
  wongnai:    { label: 'sourceWongnai',   icon: '🍽️', style: 'bg-red-50 text-red-700 border border-red-200' },
  googlemaps: { label: 'sourceGoogleMaps',icon: '⭐', style: 'bg-blue-50 text-blue-700 border border-blue-200' },
  manual:     { label: 'sourceManual',    icon: '✍️', style: 'bg-amber-50 text-amber-700 border border-amber-200' },
}

// Extract Thai characters from a string (e.g. "Baannok Bangkok | บ้านนอกเข้ากรุง")
function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

type Props = { location: Location; lang: Lang; distanceKm?: number }

export function LocationCard({ location, lang, distanceKm }: Props) {
  const [copied, setCopied] = useState(false)

  const badge = SOURCE_BADGE[location.source]
  const name = lang === 'zh' ? location.name_zh : location.name_en
  const desc = lang === 'zh' ? location.description_zh : location.description_en

  // Thai name: explicit field first, then extract from name
  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th

  const mapsUrl = location.source_url?.includes('place_id:')
    ? location.source_url
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name_en + (location.address ? ' ' + location.address : ' Bangkok'))}`

  const rawPhoto = location.photos[0] ?? ''
  const photo = rawPhoto.startsWith('places/')
    ? `https://places.googleapis.com/v1/${rawPhoto}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : rawPhoto || 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=300&fit=crop'

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
        {/* Source badge overlay */}
        <div className="absolute top-1.5 left-1.5">
          <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-lg ${badge.style}`}>
            <span>{badge.icon}</span>
            {strings[lang][badge.label] as string}
          </span>
        </div>
        {/* Local ratio badge */}
        {location.local_ratio !== undefined && location.local_ratio >= 60 && (
          <div className="absolute top-1.5 right-1.5">
            <span className="inline-block text-[8px] font-bold bg-[#1a1a2e]/80 text-white px-1.5 py-0.5 rounded-lg">
              {strings[lang].localLabel as string} {location.local_ratio}%
            </span>
          </div>
        )}
      </div>

      <div className="p-2.5">
        {/* Name row + Thai copy */}
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="text-[13px] font-bold text-[#1a1a2e] leading-tight line-clamp-1 flex-1">{name}</h3>
          {(thaiName || thaiAddress) && (
            <button
              onClick={copyThai}
              title={strings[lang].copyThai as string}
              className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-lg bg-[#f0edff] text-[#5b4fcf] hover:bg-[#e0daff] transition-colors"
            >
              {copied ? (strings[lang].copied as string) : 'ภาษาไทย'}
            </button>
          )}
        </div>

        {/* Thai name preview */}
        {thaiName && (
          <p className="text-[10px] text-gray-400 leading-tight mb-0.5 line-clamp-1">{thaiName}</p>
        )}

        <p className="text-[10px] text-gray-500 mb-1.5 line-clamp-2">{desc}</p>

        {/* Highlights */}
        {location.highlights && location.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {location.highlights.map((h) => (
              <span key={h} className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full font-semibold">
                {h}
              </span>
            ))}
          </div>
        )}

        {/* Hashtags */}
        {location.hashtags && location.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {location.hashtags.map((tag) => (
              <span key={tag} className="text-[8px] text-indigo-500 font-semibold">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: rating + price + navigate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
            {location.price_range > 0 && (
              <span className="text-[9px] text-gray-400 font-semibold">
                {'฿'.repeat(location.price_range)}
              </span>
            )}
            {distanceKm !== undefined && (
              <span className="text-[9px] font-bold text-indigo-500">
                📍 {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
              </span>
            )}
          </div>
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
  )
}
