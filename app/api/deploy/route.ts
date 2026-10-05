import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { resolve } from 'path'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const repoRoot = resolve(process.cwd())
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ')

    execSync('git add data/locations.json data/pending.json', { cwd: repoRoot, stdio: 'pipe' })

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
