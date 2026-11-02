import Link from 'next/link'
import type { Lang } from '@/lib/i18n'
import { TEMPLE_ROUTES, type TempleRoute } from '@/lib/templeRoutes'
import { Icon } from './icons/Icon'

// 拜拜路線入口。給 stop 時顯示「這間是路線第幾站」
export function RouteBanner({ lang, route = TEMPLE_ROUTES[0], stop, className = '' }: { lang: Lang; route?: TempleRoute; stop?: number; className?: string }) {
  const zh = lang === 'zh'
  return (
    <Link
      href={`/guide/${route.slug}`}
      className={`flex items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 hover:border-ink/30 tap ${className}`}
    >
      <span className="shrink-0 w-9 h-9 rounded-full bg-white border border-line text-brand flex items-center justify-center">
        <Icon name="route" size={17} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold text-brand tracking-wide">
          {stop !== undefined
            ? (zh ? `拜拜路線第 ${stop + 1} 站，共 ${route.stops.length} 站` : `Stop ${stop + 1} of ${route.stops.length} on a temple route`)
            : (zh ? '拜拜路線' : 'Temple route')}
        </span>
        <span className="block text-[14px] font-bold text-ink truncate">{route.short_zh}</span>
      </span>
      <Icon name="chevron-right" size={18} className="shrink-0 text-muted" />
    </Link>
  )
}
