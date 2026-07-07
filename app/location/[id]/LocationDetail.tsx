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

function extractThai(text: string): string | null {
  const thai = text.match(/[฀-๿][฀-๿\s]*/g)?.join(' ').trim()
  return thai && thai.length >= 3 ? thai : null
}

const TAG_META: Record<LocationTag, { emoji: string; zh: string; color: string }> = {
  trending:    { emoji: '🔥', zh: '話題爆紅', color: 'bg-orange-500' },
  hidden_gem:  { emoji: '🗺', zh: '在地私藏', color: 'bg-emerald-600' },
  new_opening: { emoji: '✨', zh: '新開幕',   color: 'bg-violet-500' },
  evergreen:   { emoji: '📌', zh: '經典必訪', color: 'bg-sky-500' },
}

function resolveTag(loc: Location): LocationTag {
  if (loc.tag) return loc.tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((loc as any).trending === true) return 'trending'
  return 'evergreen'
}

export function LocationDetail({ location }: { location: Location }) {
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
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl">

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
              <span className={`inline-flex items-center gap-1 text-[10px] font-black ${meta.color} text-white px-2 py-1 rounded-full`}>
                <TagIcon size={12} className="shrink-0" /> {meta.zh}
              </span>
            </div>
          )
        })()}
      </div>

      {/* Thumbnail strip */}
      {allPhotos.length > 1 && (
        <DragScroll className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar bg-gray-50">
          {allPhotos.map((url, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === activePhoto ? 'border-[#1e1b4b]' : 'border-transparent'}`}
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
              className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#f0edff] text-[#5b4fcf] hover:bg-[#e0daff] transition-colors"
            >
              {copied ? '複製了！' : 'ภาษาไทย'}
            </button>
          </div>
        )}

        <h1 className="text-[22px] font-black text-[#1a1a2e] leading-tight mt-1 mb-0.5">{name}</h1>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-base font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
          {location.price_range > 0 && (
            <span className="text-sm text-gray-400 font-semibold">{'฿'.repeat(location.price_range)}</span>
          )}
          <span className="text-xs text-gray-400">{{ food: '餐廳', cafe: '咖啡廳', shopping: '購物', nightlife: '夜生活', hotel: '飯店', attraction: '景點' }[location.category as string] ?? location.category}</span>
        </div>

        {/* Curator note */}
        {location.curator_note && (
          <Reveal className="mb-4 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-black text-indigo-400 uppercase tracking-wide mb-1">
              {lang === 'zh' ? '在地人怎麼說' : "Local's Take"}
            </p>
            <p className="text-[14px] text-indigo-700 leading-relaxed font-medium">{location.curator_note}</p>
          </Reveal>
        )}

        {/* Description */}
        {cleanDesc && (
          <Reveal delay={60} className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-1.5 uppercase tracking-wide">
              {lang === 'zh' ? '關於' : 'About'}
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed">{cleanDesc}</p>
          </Reveal>
        )}

        {/* Highlights */}
        {(location.highlights?.length ?? 0) > 0 && (
          <Reveal delay={120} className="mb-4">
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
          </Reveal>
        )}

        {/* Address */}
        {location.address && (
          <Reveal delay={180} className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-1.5 uppercase tracking-wide">
              {lang === 'zh' ? '地址' : 'Address'}
            </h2>
            <p className="text-[12px] text-gray-500 leading-relaxed">{location.address}</p>
            {thaiAddress && (
              <p className="text-[12px] text-gray-400 mt-0.5">{thaiAddress}</p>
            )}
          </Reveal>
        )}

        {/* Social embed */}
        {location.social_embed_url && (
          <Reveal className="mb-4">
            <h2 className="text-[13px] font-black text-gray-700 mb-2 uppercase tracking-wide">
              {lang === 'zh' ? '社群影片' : 'Social Video'}
            </h2>
            <SocialEmbed url={location.social_embed_url} />
          </Reveal>
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
