'use client'
import type { Lang } from '@/lib/i18n'

// tone：dark = 疊在照片/深色底上；light = 用在白底頁首
type Props = { lang: Lang; setLang: (l: Lang) => void; tone?: 'dark' | 'light' }

export function LanguageToggle({ lang, setLang, tone = 'dark' }: Props) {
  const dark = tone === 'dark'
  return (
    <div className={`inline-flex items-center text-xs ${dark ? 'text-white/60' : 'text-muted'}`}>
      {(['zh', 'en'] as Lang[]).map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i > 0 && <span className="mx-1.5 opacity-50">/</span>}
          <button
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`py-1 transition-colors ${
              lang === l
                ? `font-bold ${dark ? 'text-white' : 'text-ink'}`
                : dark ? 'hover:text-white' : 'hover:text-ink'
            }`}
          >
            {l === 'zh' ? '中文' : 'EN'}
          </button>
        </span>
      ))}
    </div>
  )
}
