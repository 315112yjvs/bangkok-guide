'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IconPin } from '@/components/icons/CategoryIcons'
import type { Location } from '@/lib/types'
import { useLanguage } from '@/hooks/useLanguage'
import { SocialEmbed } from '@/components/SocialEmbed'

type PlaceData = { photos: string[]; editorial: string | null; reviewSnippets: string[] }

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

const SOURCE_LABEL: Record<string, string> = {
  tiktok: 'TikTok', instagram: 'Instagram', pantip: 'Pantip',
  wongnai: 'Wongnai', googlemaps: 'Google Maps', manual: '精選',
}
const SOURCE_COLOR: Record<string, string> = {
  tiktok: 'bg-emerald-500', instagram: 'bg-purple-500', pantip: 'bg-orange-500',
  wongnai: 'bg-red-500', googlemaps: 'bg-blue-500', manual: 'bg-amber-500',
}

export function LocationDetail({ location }: { location: Location }) {
  const router = useRouter()
  const { lang } = useLanguage()
  const [activePhoto, setActivePhoto] = useState(0)
  const [placeData, setPlaceData] = useState<PlaceData | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const thaiName = location.name_th ?? extractThai(location.name_en) ?? extractThai(location.name_zh)
  const thaiAddress = location.address_th

  const name = lang === 'zh' ? location.name_zh : location.name_en
  const desc = lang === 'zh' ? location.description_zh : location.description_en

  const placeId = location.source_url?.match(/place_id:([^&\s]+)/)?.[1] ??
    location.source_url?.match(/query_place_id=([^&\s]+)/)?.[1]

  const queryStr = encodeURIComponent(location.name_en + (location.address ? ' ' + location.address : ' Bangkok'))
  const mapsUrl = placeId
    ? `https://www.google.com/maps/search/?api=1&query=${queryStr}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${queryStr}`

  // Load saved state
  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem('saved_locations') ?? '[]') as string[]
      setSaved(ids.includes(location.id))
    } catch { /* ignore */ }
  }, [location.id])

  // Fetch extra photos + editorial from Places API
  useEffect(() => {
    if (!placeId) return
    fetch(`/api/place/${placeId}`)
      .then((r) => r.json())
      .then((d: PlaceData) => setPlaceData(d))
      .catch(() => {})
  }, [placeId])

  // Build photo list: combine stored + fetched
  const storedPhoto = location.photos[0]
    ? location.photos[0].startsWith('places/')
      ? `https://places.googleapis.com/v1/${location.photos[0]}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : location.photos[0]
    : null
  const allPhotos = placeData?.photos.length
    ? placeData.photos
    : storedPhoto ? [storedPhoto] : []

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

  const fullDesc = placeData?.editorial || desc
  const cleanDesc = fullDesc?.replace(/^必點：[^。]*。\s*/, '') ?? ''

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl">

      {/* Hero photo */}
      <div className="relative w-full h-72 bg-gray-100">
        {allPhotos.length > 0 ? (
          <Image
            src={allPhotos[activePhoto] ?? allPhotos[0]}
            alt={name}
            fill
            className="object-cover"
            unoptimized
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Save */}
        <button
          onClick={toggleSave}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : 'white'} strokeWidth={2.5}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Trending badge */}
        {location.trending && (
          <div className="absolute bottom-4 left-4">
            <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-1 rounded-full">
              本週熱門
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {allPhotos.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar bg-gray-50">
          {allPhotos.map((url, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === activePhoto ? 'border-[#1e1b4b]' : 'border-transparent'}`}
            >
              <Image src={url} alt="" width={64} height={64} className="object-cover w-full h-full" unoptimized />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-4 pb-24">

        {/* Source + name */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0 ${SOURCE_COLOR[location.source] ?? 'bg-gray-400'}`}>
            {SOURCE_LABEL[location.source] ?? location.source}
          </span>
          {(thaiName || thaiAddress) && (
            <button
              onClick={copyThai}
              className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#f0edff] text-[#5b4fcf] hover:bg-[#e0daff] transition-colors"
            >
              {copied ? '複製了！' : 'ภาษาไทย'}
            </button>
          )}
        </div>

        <h1 className="text-[22px] font-black text-[#1a1a2e] leading-tight mt-1 mb-0.5">{name}</h1>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-base font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
          {location.price_range > 0 && (
            <span className="text-sm text-gray-400 font-semibold">{'฿'.repeat(location.price_range)}</span>
          )}
          <span className="text-xs text-gray-400">{{ food: '餐廳', cafe: '咖啡廳', shopping: '購物', nightlife: '夜生活', hotel: '飯店' }[location.category] ?? location.category}</span>
        </div>

        {/* Description */}
        {cleanDesc && (
          <div className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-1.5 uppercase tracking-wide">
              {lang === 'zh' ? '關於' : 'About'}
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed">{cleanDesc}</p>
          </div>
        )}

        {/* Highlights */}
        {(location.highlights?.length ?? 0) > 0 && (
          <div className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-1.5 uppercase tracking-wide">
              {lang === 'zh' ? '必點' : 'Must Try'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {location.highlights!.map((h) => (
                <span key={h} className="text-[12px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-semibold">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Review snippets */}
        {(placeData?.reviewSnippets?.length ?? 0) > 0 && (
          <div className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-2 uppercase tracking-wide">
              {lang === 'zh' ? '旅客評論' : 'Reviews'}
            </h2>
            <div className="space-y-2">
              {placeData!.reviewSnippets.map((snippet, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-3">"{snippet}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Address */}
        {location.address && (
          <div className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-1.5 uppercase tracking-wide">
              {lang === 'zh' ? '地址' : 'Address'}
            </h2>
            <p className="text-[12px] text-gray-500 leading-relaxed">{location.address}</p>
            {thaiAddress && (
              <p className="text-[12px] text-gray-400 mt-0.5">{thaiAddress}</p>
            )}
          </div>
        )}

        {/* Social embed */}
        {location.social_embed_url && (
          <div className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-2 uppercase tracking-wide">
              {lang === 'zh' ? '社群影片' : 'Social Video'}
            </h2>
            <SocialEmbed url={location.social_embed_url} />
          </div>
        )}

      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-3 bg-white/95 backdrop-blur border-t border-gray-100">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#1e1b4b] text-white font-bold text-[15px] rounded-2xl hover:bg-[#2d2a6e] transition-colors active:scale-95"
        >
          <IconPin size={16} />
          {lang === 'zh' ? '在 Google Maps 導航' : 'Navigate with Google Maps'}
        </a>
      </div>
    </div>
  )
}
