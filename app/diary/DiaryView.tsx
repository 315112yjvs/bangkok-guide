'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Icon } from '@/components/icons/Icon'
import { TripCta } from '@/components/TripCta'
import type { DiaryEntry } from '@/lib/diary'

export function formatDiaryDate(date: string, lang: 'zh' | 'en') {
  const [y, m, d] = date.split('-').map(Number)
  return lang === 'zh' ? `${y} 年 ${m} 月 ${d} 日` : new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function DiaryView({ entries }: { entries: DiaryEntry[] }) {
  const { lang, setLang } = useLanguage()
  const zh = lang === 'zh'

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto bg-white min-h-screen lg:border-x lg:border-line">
      <div className="border-b border-line px-4 pt-5 pb-6 lg:px-10 lg:pt-8 lg:pb-9">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="flex items-center gap-1.5 text-muted hover:text-ink text-sm transition-colors">
            <Icon name="arrow-left" size={16} strokeWidth={2} />
            {zh ? '曼谷人' : 'BKK LOCAL'}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} tone="light" />
        </div>
        <h1 className="flex items-center gap-2.5 text-ink font-liufen text-[28px] lg:text-[36px] leading-tight mb-2">
          <Icon name="notebook-pen" size={26} className="shrink-0 text-brand" /> {zh ? '曼谷日記' : 'Bangkok Diary'}
        </h1>
        <p className="text-muted text-[14px] leading-relaxed">
          {zh ? '住在曼谷的日常。去了哪裡、吃了什麼、看到什麼，一張照片配幾句話。' : 'Everyday life in Bangkok, one photo and a few lines at a time.'}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm py-16 text-center">{zh ? '第一篇日記快來了' : 'The first entry is on its way'}</p>
      ) : (
        <ol className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} id={e.id} className="px-4 lg:px-10 py-6 scroll-mt-4">
              <p className="text-[12px] font-bold text-muted tracking-[0.06em] mb-2.5">
                {formatDiaryDate(e.date, lang)}
                {e.place && <span className="font-normal">　·　{e.place}</span>}
              </p>
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-paper mb-3">
                <Image src={e.photo} alt={e.place ?? (zh ? '曼谷日記' : 'Bangkok diary')} fill className="object-cover" unoptimized />
              </div>
              <p className="text-[15px] text-ink leading-[1.8] whitespace-pre-line">{e.text}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="px-4 lg:px-10 pt-2 pb-8">
        <TripCta lang={lang} />
      </div>
    </div>
  )
}
