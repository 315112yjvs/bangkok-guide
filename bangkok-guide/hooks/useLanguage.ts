'use client'
import { useState, useEffect } from 'react'
import type { Lang } from '@/lib/i18n'

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'zh' || stored === 'en') setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  return { lang, setLang }
}
