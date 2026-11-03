import { NextRequest, NextResponse } from 'next/server'
import { transact } from '@/lib/store'
import type { TempleRoute } from '@/lib/templeRoutes'

// 每次都讀最新資料，不在建置時先跑
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

const FILE = 'data/temple-routes.json'

export async function GET() {
  return NextResponse.json(await transact('read', (tx) => tx.readJson<TempleRoute[]>(FILE, [])))
}

// 整份覆蓋：[{ slug, title_zh, ..., stops: [{ id, note_zh, note_en }] }]
export async function PUT(req: NextRequest) {
  const routes: TempleRoute[] = await req.json()
  if (!Array.isArray(routes)) return NextResponse.json({ error: '格式錯誤' }, { status: 400 })
  const slugs = new Set<string>()
  for (const r of routes) {
    if (!/^[a-z0-9-]+$/.test(r.slug ?? '')) return NextResponse.json({ error: `網址代號只能用小寫英文、數字和 -：${r.slug}` }, { status: 400 })
    if (slugs.has(r.slug)) return NextResponse.json({ error: `網址代號重複：${r.slug}` }, { status: 400 })
    slugs.add(r.slug)
    if (!r.title_zh?.trim()) return NextResponse.json({ error: '每條路線都要有中文標題' }, { status: 400 })
    if (!Array.isArray(r.stops) || r.stops.length < 2) return NextResponse.json({ error: `「${r.title_zh}」至少要兩站` }, { status: 400 })
  }
  await transact('修改一日路線', async (tx) => { tx.writeText(FILE, JSON.stringify(routes, null, 2) + '\n') })
  return NextResponse.json({ ok: true })
}
