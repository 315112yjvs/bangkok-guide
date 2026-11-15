import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { readVisibleLocations } from '@/lib/data'
import { photoUrl, photoPosition } from '@/lib/photo'
import { Icon } from '@/components/icons/Icon'
import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from '@/lib/site'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '曼谷人 IG 影片裡的店 | 曼谷人',
  description: '曼谷人 IG 影片拍過的店都在這裡，點封面看地址、營業時間和導航。',
  alternates: { canonical: '/ig' },
}

// IG 個人簡介的連結放這頁：排列跟 IG 一樣是影片封面格子，點了直接到那間店
export default function IgPage() {
  const items = readVisibleLocations()
    .filter((l) => l.social_embed_url && l.photos[0])
    .sort((a, b) =>
      new Date(b.featured_at ?? b.approved_at ?? 0).getTime() - new Date(a.featured_at ?? a.approved_at ?? 0).getTime())

  return (
    <main className="max-w-md lg:max-w-3xl mx-auto bg-white min-h-screen">
      <header className="px-4 pt-8 pb-5 text-center">
        <Link href="/" className="font-liufen text-[28px] text-ink">曼谷人</Link>
        <p className="text-[14px] text-ink mt-2">影片裡的店都在這裡</p>
        <p className="text-[12px] text-muted mt-1">點封面看地址、營業時間和導航</p>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-bold text-white bg-ink hover:bg-ink/85 rounded-full px-4 py-2 transition-colors"
        >
          <Icon name="instagram" size={15} strokeWidth={2} /> @{INSTAGRAM_HANDLE}
        </a>
      </header>

      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-0.5">
          {items.map((l) => (
            <Link key={l.id} href={`/location/${l.slug ?? l.id}`} className="relative block aspect-[3/4] bg-paper overflow-hidden">
              {/* 9:16 封面放進 3:4 格子約露出 75% 高度；封面上已經有店名，不另外疊字 */}
              <Image
                src={photoUrl(l.photos[0], 480)}
                alt={l.name_zh || l.name_en}
                fill
                sizes="(max-width: 768px) 33vw, 256px"
                className="object-cover"
                style={photoPosition(l.photo_focus, l.photos[0], 0.75)}
                unoptimized
              />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-center text-[13px] text-muted py-10">影片整理中</p>
      )}

      <div className="px-4 py-8 text-center">
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand hover:underline underline-offset-4">
          看網站上全部的店 <Icon name="chevron-right" size={14} strokeWidth={2} />
        </Link>
      </div>
    </main>
  )
}
