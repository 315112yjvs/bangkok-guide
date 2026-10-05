'use client'
import Link from 'next/link'
import { useMemo } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageToggle } from '@/components/LanguageToggle'
import { LocationCard } from '@/components/LocationCard'
import { CATEGORY_META } from '@/lib/collections'
import { seededShuffle } from '@/lib/shuffle'
import { useShuffleSeed } from '@/hooks/useShuffleSeed'
import { MIcon } from '@/components/icons/MaterialIcons'
import { SiteFooter } from '@/components/SiteFooter'
import type { Location } from '@/lib/types'

type Props = {
  locations: Location[]
  h1Zh: string
  h1En: string
  descZh: string
  descEn: string
  icon: string
  // 同類交叉連結（其他分類 / 熱門區域）
  related: { href: string; label: string }[]
}

export function CollectionView({ locations, h1Zh, h1En, descZh, descEn, icon, related }: Props) {
  const { lang, setLang } = useLanguage()
  const h1 = lang === 'zh' ? h1Zh : h1En
  const desc = lang === 'zh' ? descZh : descEn
  // 用分頁種子洗牌：一進站隨機，返回同一頁維持同序（首屏 SSR 維持原序避免 hydration 不一致）
  const seed = useShuffleSeed()
  const items = useMemo(() => (seed != null ? seededShuffle(locations, seed) : locations), [locations, seed])

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto bg-white min-h-screen lg:border-x lg:border-line">
      {/* Header */}
      <div className="border-b border-line px-4 pt-5 pb-6 lg:px-10 lg:pt-8 lg:pb-9">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="flex items-center gap-1.5 text-muted hover:text-ink text-sm transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {lang === 'zh' ? '曼谷人' : 'BKK LOCAL'}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} tone="light" />
        </div>
        <h1 className="flex items-center gap-2.5 text-ink font-liufen text-[28px] lg:text-[36px] leading-tight mb-2">
          <MIcon name={icon} size={26} className="shrink-0 text-brand" /> {h1}
        </h1>
        <p className="text-muted text-[14px] leading-relaxed max-w-2xl">{desc}</p>
        <p className="text-muted text-[12px] mt-3">
          {locations.length} {lang === 'zh' ? '個在地精選' : 'local picks'}
        </p>
      </div>

      {/* Grid */}
      <div className="px-4 pt-4 pb-8">
        {locations.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((loc) => (
              <LocationCard key={loc.id} location={loc} lang={lang} compact />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm py-16 text-center">
            {lang === 'zh' ? '持續更新中，敬請期待！' : 'Curating picks — check back soon!'}
          </p>
        )}
      </div>

      {/* 內部交叉連結（SEO + 探索） */}
      {related.length > 0 && (
        <div className="border-t border-line px-4 lg:px-10 py-6">
          <p className="text-[12px] font-bold text-muted tracking-[0.08em] mb-3">
            {lang === 'zh' ? '繼續探索' : 'Explore more'}
          </p>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="text-[12px] px-3 py-1.5 rounded-full border border-line text-ink/70 hover:border-ink/40 hover:text-ink transition-colors"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer：所有分類（內部連結） */}
      <div className="border-t border-line px-4 lg:px-10 py-6">
        <p className="text-[12px] font-bold text-muted tracking-[0.08em] mb-3">
          {lang === 'zh' ? '曼谷分類指南' : 'Bangkok by category'}
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.values(CATEGORY_META).map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full border border-line text-ink/70 hover:border-ink/40 hover:text-ink transition-colors"
            >
              <MIcon name={c.icon} size={14} className="shrink-0" /> {lang === 'zh' ? c.h1Zh : c.h1En}
            </Link>
          ))}
        </div>
      </div>
      <SiteFooter lang={lang} />
    </div>
  )
}
