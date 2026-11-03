import Link from 'next/link'
import Image from 'next/image'
import type { Lang } from '@/lib/i18n'
import type { Location } from '@/lib/types'
import { TEMPLE_ROUTES } from '@/lib/templeRoutes'
import { photoUrl, FALLBACK_PHOTO } from '@/lib/photo'
import { Icon } from './icons/Icon'

// 首頁「一日路線」頁籤：每條路線一張卡，封面用前三站的照片拼起來
export function RouteList({ lang, locations }: { lang: Lang; locations: Location[] }) {
  const zh = lang === 'zh'
  const byId = new Map(locations.map((l) => [l.id, l]))

  return (
    <div className="grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(380px,560px))] lg:justify-center">
      {TEMPLE_ROUTES.map((route) => {
        const stops = route.stops.map((s) => byId.get(s.id)).filter((l): l is Location => !!l)
        const covers = stops.slice(0, 3)
        return (
          <Link
            key={route.slug}
            href={`/guide/${route.slug}`}
            className="group block rounded-xl border border-line overflow-hidden bg-white hover:border-ink/30 card-press"
          >
            <div className={`grid ${['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][covers.length]} gap-0.5 h-36 lg:h-44 bg-line`}>
              {covers.map((l) => (
                <div key={l.id} className="relative bg-paper">
                  <Image src={l.photos[0] ? photoUrl(l.photos[0], 480) : FALLBACK_PHOTO} alt="" fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-brand mb-1.5">
                <Icon name="route" size={14} strokeWidth={2} />
                {zh ? `${route.stops.length} 站` : `${route.stops.length} stops`}
                <span className="text-line">·</span>
                <span className="font-normal text-muted truncate">{zh ? route.duration_zh : route.duration_en}</span>
              </p>
              <h2 className="text-[18px] font-bold text-ink leading-snug group-hover:text-brand transition-colors">{zh ? route.title_zh : route.title_en}</h2>
              <p className="text-[14px] text-ink/75 leading-relaxed mt-1.5 line-clamp-3">{zh ? route.intro_zh : route.intro_en}</p>
              <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-3 text-[12px] text-muted">
                {stops.map((l, i) => (
                  <li key={l.id} className="flex items-center gap-1.5">
                    {i > 0 && <Icon name="chevron-right" size={11} className="text-line" />}
                    {zh ? l.name_zh : l.name_en}
                  </li>
                ))}
              </ol>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
