'use client'
import { useState } from 'react'
import { Icon } from '@/components/icons/Icon'
import { encodeList } from '@/lib/shareList'

// 「我的收藏」上方：把收藏清單變成一個連結，傳給旅伴
export function ShareListBar({ ids, lang }: { ids: string[]; lang: 'zh' | 'en' }) {
  const [copied, setCopied] = useState(false)
  const url = `https://www.bkk-local.com/list?p=${encodeList(ids)}`
  const text = lang === 'zh' ? `我的曼谷清單（${ids.length} 間）` : `My Bangkok list (${ids.length} places)`

  async function share() {
    // 手機上叫出系統分享（LINE、Messenger 都在裡面）；電腦或不支援就複製連結
    if (navigator.share) {
      try { await navigator.share({ title: text, url }); return } catch { /* 使用者取消 */ return }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { window.prompt(lang === 'zh' ? '複製這個連結' : 'Copy this link', url) }
  }

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-paper border border-line">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-ink">{lang === 'zh' ? '分享清單給旅伴' : 'Share with your travel buddies'}</p>
        <p className="text-[11px] text-muted">{lang === 'zh' ? '對方點開就看到同一份清單' : 'They open the link and see the same list'}</p>
      </div>
      <a
        href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener"
        className="shrink-0 text-[12px] font-bold text-white bg-[#06C755] hover:opacity-90 rounded-md px-3 py-2"
      >
        LINE
      </a>
      <button
        onClick={share}
        className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-white bg-ink hover:bg-ink/85 rounded-md px-3 py-2"
      >
        <Icon name={copied ? 'check' : 'share'} size={13} strokeWidth={2} />
        {copied ? (lang === 'zh' ? '已複製' : 'Copied') : (lang === 'zh' ? '分享' : 'Share')}
      </button>
    </div>
  )
}
