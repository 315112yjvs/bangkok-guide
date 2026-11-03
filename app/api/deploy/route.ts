import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { downloadPhotos } from '@/lib/downloadPhotos'
import { isOnline, publish, hasDrafts } from '@/lib/store'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ drafts: await hasDrafts().catch(() => false) })
}

export async function POST() {
  // 正式站後台：修改已經一筆筆存在 GitHub 上了，這裡只觸發一次部署
  if (isOnline) {
    try {
      await publish(`data: 後台上傳 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
      return NextResponse.json({ ok: true })
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
    }
  }
  try {
    const repoRoot = resolve(process.cwd())
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ')

    // 上架的店補齊照片（待審時只下載了封面）、清掉被駁回店家的照片，再一起提交
    downloadPhotos()

    execSync('git add -A data/locations.json data/pending.json data/hours.json data/diary.json data/temple-routes.json public/photos public/diary', { cwd: repoRoot, stdio: 'pipe' })

    try {
      execSync(`git commit -m "data: update locations ${date}"`, {
        cwd: repoRoot,
        stdio: 'pipe',
      })
    } catch {
      // nothing new to commit — still push in case previous commit wasn't pushed
    }

    // 正式站後台會直接 commit 到 GitHub，先把那些改動接進來再推
    try {
      execSync('git pull --rebase origin main', { cwd: repoRoot, stdio: 'pipe', timeout: 120000 })
    } catch (err) {
      execSync('git rebase --abort', { cwd: repoRoot, stdio: 'pipe' })
      throw new Error('和正式站後台的修改衝突（同一家店兩邊都改了），請找 Claude 處理。' + (err instanceof Error ? err.message : ''))
    }

    execSync('git push origin main', {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 120000,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Deploy error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
