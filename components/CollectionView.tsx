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
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1e1b4b] to-[#4c1d95] px-5 pt-5 pb-6">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-bold transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {lang === 'zh' ? '曼谷人' : 'BKK LOCAL'}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
        <h1 className="flex items-center gap-2 text-white font-liufen text-[30px] leading-tight mb-2">
          <MIcon name={icon} size={30} className="shrink-0" /> {h1}
        </h1>
        <p className="text-white/60 text-[13px] leading-relaxed">{desc}</p>
        <p className="text-white/40 text-[11px] mt-2">
          {locations.length} {lang === 'zh' ? '個在地精選' : 'local picks'}
        </p>
      </div>

      {/* Grid */}
      <div className="bg-gray-50 px-3 pt-3 pb-6">
        {locations.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
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
        <div className="bg-white border-t border-gray-100 px-5 py-5">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide mb-3">
            {lang === 'zh' ? '繼續探索' : 'Explore more'}
          </p>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-[#1e1b4b] hover:text-white transition-colors"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer：所有分類（內部連結） */}
      <div className="bg-gray-50 border-t border-gray-100 px-5 py-5">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide mb-3">
          {lang === 'zh' ? '曼谷分類指南' : 'Bangkok by category'}
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.values(CATEGORY_META).map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-[#1e1b4b] hover:text-[#1e1b4b] transition-colors"
            >
              <MIcon name={c.icon} size={14} className="shrink-0" /> {lang === 'zh' ? c.h1Zh : c.h1En}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
