import { NextResponse } from 'next/server'
import { refreshHours } from '@/lib/hoursRefresh'
import { withErrors } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// Vercel Cron 每天呼叫（middleware 已驗過 CRON_SECRET）
async function handleGET() {
  return NextResponse.json(await refreshHours({ deploy: true }))
}

export const GET = withErrors(handleGET)
