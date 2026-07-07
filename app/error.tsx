'use client'

// 全域錯誤頁：runtime 出錯時給使用者重試的機會，而不是白畫面
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-8 text-center">
      <p className="text-6xl mb-4">😵‍💫</p>
      <h1 className="text-2xl font-black text-[#1a1a2e] mb-2">出了點狀況</h1>
      <p className="text-sm text-gray-500 mb-8">頁面載入出錯了，按下面的按鈕再試一次。</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-[#1e1b4b] text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-[#2d2a5e] transition-colors"
        >
          重試
        </button>
        <a
          href="/"
          className="bg-gray-100 text-gray-600 text-sm font-bold px-6 py-3 rounded-full hover:bg-gray-200 transition-colors"
        >
          回首頁
        </a>
      </div>
    </div>
  )
}
