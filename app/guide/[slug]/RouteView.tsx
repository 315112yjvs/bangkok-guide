'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Icon } from '@/components/icons/Icon'
import { TripCta } from '@/components/TripCta'
import { photoUrl, FALLBACK_PHOTO } from '@/lib/photo'
import type { TempleRoute } from '@/lib/templeRoutes'
import type { Location } from '@/lib/types'

type Stop = { location: Location; note: string; noteEn: string }

// 用 Google Maps 開一條依序經過每一站的步行路線
function walkingUrl(stops: Stop[]) {
  const pt = (l: Location) => `${l.lat},${l.lng}`
  const ls = stops.map((s) => s.location)
  const params = new URLSearchParams({
    api: '1',
    origin: pt(ls[0]),
    destination: pt(ls[ls.length - 1]),
    travelmode: 'walking',
  })
  if (ls.length > 2) params.set('waypoints', ls.slice(1, -1).map(pt).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function RouteView({ route, stops }: { route: TempleRoute; stops: Stop[] }) {
  const { lang, setLang } = useLanguage()
  const zh = lang === 'zh'

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto bg-white min-h-screen lg:border-x lg:border-line">
      <div className="border-b border-line px-4 pt-5 pb-6 lg:px-10 lg:pt-8 lg:pb-9">
        <div className="flex items-center justify-between mb-5">
          <Link href="/category/temple" className="flex items-center gap-1.5 text-muted hover:text-ink text-sm transition-colors">
            <Icon name="arrow-left" size={16} strokeWidth={2} />
            {zh ? '曼谷拜拜指南' : 'Temples'}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} tone="light" />
        </div>
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-brand tracking-[0.08em] mb-2">
          <Icon name="flower-2" size={15} strokeWidth={2} /> {zh ? '拜拜路線' : 'TEMPLE ROUTE'}
        </p>
        <h1 className="font-liufen text-[28px] lg:text-[36px] text-ink leading-tight mb-3">{zh ? route.title_zh : route.title_en}</h1>
        <p className="text-[15px] text-ink/85 leading-[1.75] mb-4">{zh ? route.intro_zh : route.intro_en}</p>
        <dl className="text-[14px] space-y-1.5 mb-5">
          <div className="flex gap-3"><dt className="shrink-0 text-muted w-12">{zh ? '起點' : 'Start'}</dt><dd className="text-ink">{zh ? route.start_zh : route.start_en}</dd></div>
          <div className="flex gap-3"><dt className="shrink-0 text-muted w-12">{zh ? '時間' : 'Time'}</dt><dd className="text-ink">{zh ? route.duration_zh : route.duration_en}</dd></div>
        </dl>
        <a
          href={walkingUrl(stops)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-brand text-white font-bold text-[15px] rounded-lg hover:bg-brand-dark tap"
        >
          <Icon name="route" size={17} strokeWidth={2} />
          {zh ? '用 Google Maps 開啟步行路線' : 'Open walking route in Google Maps'}
        </a>
      </div>

      <ol className="px-4 lg:px-10 py-6">
        {stops.map((s, i) => (
          <li key={s.location.id} className="relative flex gap-4 pb-7 last:pb-0">
            {/* 站與站之間的連線 */}
            {i < stops.length - 1 && <span className="absolute left-[15px] top-9 bottom-1 w-px bg-line" />}
            <span className="relative shrink-0 w-8 h-8 rounded-full bg-brand text-white text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <Link href={`/location/${s.location.slug ?? s.location.id}`} className="group flex gap-3 items-start">
                <div className="relative shrink-0 w-24 h-24 lg:w-32 lg:h-28 rounded-lg overflow-hidden bg-paper">
                  <Image src={s.location.photos[0] ? photoUrl(s.location.photos[0], 480) : FALLBACK_PHOTO} alt={s.location.name_zh} fill className="object-cover" unoptimized />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-bold text-ink group-hover:text-brand transition-colors leading-snug">{zh ? s.location.name_zh : s.location.name_en}</h2>
                  {s.location.temple && (
                    <p className="text-[13px] text-muted mt-0.5">{zh ? s.location.temple.deity_zh : (s.location.temple.deity_en || s.location.temple.deity_zh)}</p>
                  )}
                  <p className="text-[12px] text-brand mt-1.5 inline-flex items-center gap-0.5">{zh ? '怎麼拜、供品' : 'How to pray'} <Icon name="chevron-right" size={13} /></p>
                </div>
              </Link>
              <p className="text-[14px] text-ink/85 leading-[1.7] mt-2.5">{zh ? s.note : s.noteEn}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="px-4 lg:px-10 pb-6">
        <h2 className="text-[12px] font-bold text-muted tracking-[0.08em] mb-2.5">{zh ? '小提醒' : 'Tips'}</h2>
        <ul className="space-y-1.5 mb-6">
          {(zh ? route.tips_zh : route.tips_en).map((t) => (
            <li key={t} className="text-[14px] text-ink/80 leading-[1.7] pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-muted">{t}</li>
          ))}
        </ul>
        <TripCta lang={lang} />
      </div>
    </div>
  )
}
