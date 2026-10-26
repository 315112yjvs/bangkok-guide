import Link from 'next/link'
import { EmptyScene } from '@/components/illustrations/Scenes'

// 品牌化 404：地點下架、網址打錯、舊連結失效都會走到這裡
export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-8 text-center">
      <EmptyScene className="w-44 mb-4" />
      <h1 className="text-2xl font-liufen text-ink mb-2">迷路了嗎？</h1>
      <p className="text-sm text-ink mb-1">這個頁面不存在，可能是地點已下架或網址打錯了。</p>
      <p className="text-xs text-muted mb-8">This page doesn&apos;t exist — it may have been removed.</p>
      <Link
        href="/"
        className="ehon-btn text-sm px-6 py-3"
      >
        回曼谷人首頁
      </Link>
    </div>
  )
}
