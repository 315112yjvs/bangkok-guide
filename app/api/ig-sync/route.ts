import { NextRequest, NextResponse } from 'next/server'
import { syncInstagram, IG_LOG_FILE, type IgLog } from '@/lib/igSync'
import { readJson } from '@/lib/store'
import { withErrors } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// GET：Vercel Cron 每天呼叫（middleware 已驗過 CRON_SECRET），同步完有改動就直接部署
//      後台帶 ?log=1 呼叫則只回傳處理紀錄
// POST：後台「同步 IG」按鈕
async function handleGET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('log')) {
    const log = await readJson<IgLog>(IG_LOG_FILE, {})
    const items = Object.entries(log).map(([code, e]) => ({ code, ...e }))
      .sort((a, b) => (b.posted ?? '').localeCompare(a.posted ?? '') || b.at.localeCompare(a.at))
    return NextResponse.json({ items })
  }
  return NextResponse.json(await syncInstagram({ deploy: true }))
}

async function handlePOST() {
  return NextResponse.json(await syncInstagram({ deploy: true }))
}

export const GET = withErrors(handleGET)
export const POST = withErrors(handlePOST)
