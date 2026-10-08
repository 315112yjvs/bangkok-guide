import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { downloadPhotos } from '@/lib/downloadPhotos'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const repoRoot = resolve(process.cwd())
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ')

    // 上架的店補齊照片（待審時只下載了封面）、清掉被駁回店家的照片，再一起提交
    downloadPhotos()

    execSync('git add -A data/locations.json data/pending.json data/hours.json public/photos', { cwd: repoRoot, stdio: 'pipe' })

    try {
      execSync(`git commit -m "data: update locations ${date}"`, {
        cwd: repoRoot,
        stdio: 'pipe',
      })
    } catch {
      // nothing new to commit — still push in case previous commit wasn't pushed
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
