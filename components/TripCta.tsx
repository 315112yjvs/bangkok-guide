import Link from 'next/link'
import type { Lang } from '@/lib/i18n'
import { tripEnabled } from '@/lib/site'
import { Icon } from './icons/Icon'

// 「客製行程」入口：首頁和地點頁共用。聯絡連結還沒設定時不顯示。
export function TripCta({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  if (!tripEnabled) return null
  const zh = lang === 'zh'
  if (compact) {
    return (
      <Link href="/trip" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand hover:text-brand-dark transition-colors">
        <Icon name="route" size={16} strokeWidth={2} />
        {zh ? '客製行程' : 'Custom trip'}
      </Link>
    )
  }
  return (
    <Link
      href="/trip"
      className="mb-6 flex items-center gap-3 rounded-lg bg-brand-soft border border-brand/15 px-4 py-3.5 hover:border-brand/40 transition-colors"
    >
      <span className="shrink-0 w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center">
        <Icon name="route" size={19} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold text-ink">{zh ? '不想自己排行程？' : 'Rather not plan it yourself?'}</span>
        <span className="block text-[13px] text-muted">{zh ? '住在曼谷的人幫你排一份走得完的行程' : 'A Bangkok local plans a trip that actually works'}</span>
      </span>
      <Icon name="chevron-right" size={18} className="shrink-0 text-brand" />
    </Link>
  )
}
