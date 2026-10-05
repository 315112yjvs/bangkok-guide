import Link from 'next/link'
import type { Lang } from '@/lib/i18n'

export function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="border-t border-line px-4 lg:px-10 py-6 text-[12px] text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-ink font-bold">{lang === 'zh' ? '曼谷人 BKK LOCAL' : 'BKK LOCAL'}</span>
      <Link href="/about" className="hover:text-ink underline-offset-4 hover:underline">
        {lang === 'zh' ? '關於本站與資料來源' : 'About & data sources'}
      </Link>
    </footer>
  )
}
