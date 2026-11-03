import { NextResponse } from 'next/server'

// 後台 API 出錯時回傳錯誤訊息（例如 GitHub 拒絕存檔），後台畫面才看得到原因，不只是空白的 500
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[admin api]', message)
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }
}
