'use client'
import Link from 'next/link'
import { track } from '@vercel/analytics'

// /ig 頁的封面連結：點擊時送一個 Vercel Analytics 自訂事件（Pro 方案才有），
// 在 Vercel 後台 Analytics → Events 看「ig_cover_click」，可以依 place 看哪支影片把人帶到網站
export function IgCoverLink({ href, place, children, className }: { href: string; place: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={className} onClick={() => track('ig_cover_click', { place })}>
      {children}
    </Link>
  )
}
