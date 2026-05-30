'use client'
import type { Lang } from '@/lib/i18n'

type Props = { lang: Lang; setLang: (l: Lang) => void }

export function LanguageToggle({ lang, setLang }: Props) {
  return (
    <div className="inline-flex bg-white/15 rounded-full p-0.5 text-xs">
      {(['zh', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-full transition-all ${
            lang === l
              ? 'bg-white text-[#1a1a2e] font-bold'
              : 'text-white/70 hover:text-white'
          }`}
        >
          {l === 'zh' ? '中文' : 'EN'}
        </button>
      ))}
    </div>
  )
}
