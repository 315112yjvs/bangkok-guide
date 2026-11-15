'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/icons/Icon'

// 收到清單的人：一鍵把整份清單加進自己的收藏
export function SaveAllButton({ ids }: { ids: string[] }) {
  const [done, setDone] = useState(false)
  function saveAll() {
    try {
      const mine = JSON.parse(localStorage.getItem('saved_locations') ?? '[]') as string[]
      localStorage.setItem('saved_locations', JSON.stringify(Array.from(new Set([...mine, ...ids]))))
    } catch { /* 無痕模式等存不進去就算了 */ }
    setDone(true)
  }
  return done ? (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-paper border border-line">
      <Icon name="check" size={16} strokeWidth={2} className="text-brand shrink-0" />
      <p className="flex-1 text-[13px] text-ink">已加入你的收藏</p>
      <Link href="/" className="text-[12px] font-bold text-brand hover:underline underline-offset-4">回首頁看「我的收藏」 →</Link>
    </div>
  ) : (
    <button onClick={saveAll} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-ink text-white text-[14px] font-bold hover:bg-ink/85 transition-colors">
      <Icon name="heart" size={15} strokeWidth={2} /> 全部加入我的收藏
    </button>
  )
}
