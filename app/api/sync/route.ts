import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { isOnline } from '@/lib/store'

export const runtime = 'nodejs'

// 本機後台打開時先把 GitHub 上的最新資料拉下來（可能有在正式站後台或手機上改過的）。
// 有還沒上傳的本機修改也沒關係，--autostash 會先收起來、拉完再放回去。
export async function POST() {
  if (isOnline) return NextResponse.json({ ok: true })
  try {
    const out = execSync('git pull --rebase --autostash origin main', { cwd: process.cwd(), stdio: 'pipe', timeout: 60000 }).toString()
    return NextResponse.json({ ok: true, updated: !/Already up to date|已經是最新/.test(out) })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 300) : String(err) }, { status: 500 })
  }
}
