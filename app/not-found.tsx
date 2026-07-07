import Link from 'next/link'

// 品牌化 404：地點下架、網址打錯、舊連結失效都會走到這裡
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-8 text-center">
      <p className="text-6xl mb-4">🛵</p>
      <h1 className="text-2xl font-black text-[#1a1a2e] mb-2">迷路了嗎？</h1>
      <p className="text-sm text-gray-500 mb-1">這個頁面不存在，可能是地點已下架或網址打錯了。</p>
      <p className="text-xs text-gray-400 mb-8">This page doesn&apos;t exist — it may have been removed.</p>
      <Link
        href="/"
        className="bg-[#1e1b4b] text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-[#2d2a5e] transition-colors"
      >
        回曼谷人首頁
      </Link>
    </div>
  )
}
