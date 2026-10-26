'use client'
import { EmptyScene } from '@/components/illustrations/Scenes'

// 全域錯誤頁：runtime 出錯時給使用者重試的機會，而不是白畫面
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-8 text-center">
      <EmptyScene className="w-44 mb-4" />
      <h1 className="text-2xl font-liufen text-ink mb-2">出了點狀況</h1>
      <p className="text-sm text-ink mb-8">頁面載入出錯了，按下面的按鈕再試一次。</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="ehon-btn text-sm px-6 py-3"
        >
          重試
        </button>
        <a
          href="/"
          className="chip text-sm font-bold px-6 py-3"
        >
          回首頁
        </a>
      </div>
    </div>
  )
}
