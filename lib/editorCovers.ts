import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { transact, isOnline } from './store'
import { txLocations, txWriteLocations } from './data'
import { detectTextFocus } from './photoFocus'
import { igCode } from './igParse'
import type { IgLog } from './igSync'

// 從本機的曼谷人影片剪輯台（工具/bkk-video-editor）帶入影片封面：
// 剪輯台每次匯出都會產生「<專案名>_9x16_<時間>_封面.jpg」，專案裡也有配音稿（含店名）。
// 找「曼谷人帶你去」裡有影片、還沒有封面的店，請 Claude 用店名、配音稿、日期把專案對到店，
// 對上的就把封面縮圖存進 public/photos/<id>/，設成 video_cover。只能在本機跑（要讀剪輯台的檔案）。

const EDITOR_DIR = process.env.VIDEO_EDITOR_DIR ?? join(process.cwd(), '..', '..', '工具', 'bkk-video-editor')
const MAX_AGE_DAYS = 120

type Project = { id: string; name: string; script: string; cover: string; exportedAt: string }
type Target = { id: string; name_zh: string; name_en: string; name_th?: string; posted?: string }

export function listProjects(): Project[] {
  const dir = join(EDITOR_DIR, 'projects')
  if (!existsSync(dir)) return []
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000
  const out: Project[] = []
  for (const id of readdirSync(dir)) {
    try {
      const p = JSON.parse(readFileSync(join(dir, id, 'project.json'), 'utf-8'))
      const video = typeof p.lastExport === 'string' ? p.lastExport : null
      if (!video) continue
      const cover = video.replace(/\.mp4$/, '_封面.jpg')
      if (!existsSync(cover)) continue
      const mtime = statSync(cover).mtimeMs
      if (mtime < cutoff) continue
      out.push({ id, name: String(p.name ?? id), script: String(p.script ?? '').replace(/\s+/g, ' ').slice(0, 300), cover, exportedAt: new Date(mtime).toISOString().slice(0, 10) })
    } catch { /* 壞掉的專案就跳過 */ }
  }
  return out
}

export async function match(targets: Target[], projects: Project[]): Promise<{ target: number; project: number }[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `曼谷探店帳號用剪輯台做影片，影片發到 IG 後網站上的店會掛上影片。請把剪輯台的專案對到網站上的店。

【網站上缺影片封面的店】（編號｜中文名｜英文名｜泰文名｜IG 發文日期）
${targets.map((t, i) => `${i}｜${t.name_zh}｜${t.name_en}｜${t.name_th ?? ''}｜${t.posted ?? ''}`).join('\n')}

【剪輯台專案】（編號｜專案名｜匯出日期｜配音稿開頭）
${projects.map((p, i) => `${i}｜${p.name}｜${p.exportedAt}｜${p.script}`).join('\n')}

規則：
- 配音稿或專案名明確講的是同一間店才配對（店名、泰文名、拼音都算）。IG 發文通常在匯出當天或之後幾天。
- 不確定就不要配。一間店最多配一個專案。
只回傳 JSON 陣列，例如 [{"target":0,"project":2}]，沒有就回 []。`,
    }],
  })
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as { target: number; project: number }[]
  const used = new Set<number>()
  return arr.filter((m) => targets[m.target] && projects[m.project] && !used.has(m.target) && used.add(m.target))
}

// 用 macOS 內建的 sips 縮圖（大圖給地點頁、480 給卡片），回傳 base64
function resize(src: string, dir: string, size: number): string {
  const out = join(dir, `${size}.jpg`)
  execFileSync('sips', ['-Z', String(size), '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', src, '--out', out], { stdio: 'pipe' })
  return readFileSync(out).toString('base64')
}

export type CoverResult = { name: string; project: string; cover: string }

export async function importEditorCovers(): Promise<{ targets: number; projects: number; imported: CoverResult[] }> {
  if (isOnline) throw new Error('要在電腦上的後台跑（需要讀剪輯台的檔案）')
  if (!existsSync(EDITOR_DIR)) throw new Error(`找不到剪輯台資料夾：${EDITOR_DIR}`)

  const { locations, log } = await transact('read', async (tx) => ({ locations: await txLocations(tx), log: await tx.readJson<IgLog>('data/ig-sync.json', {}) }))
  const postedOf = (url?: string) => { const c = igCode(url); return c ? log[c]?.posted : undefined }
  const targets: Target[] = locations
    .filter((l) => l.featured && l.social_embed_url && !l.video_cover)
    .map((l) => ({ id: l.id, name_zh: l.name_zh, name_en: l.name_en, name_th: l.name_th, posted: postedOf(l.social_embed_url) }))
  const projects = listProjects()
  if (!targets.length || !projects.length) return { targets: targets.length, projects: projects.length, imported: [] }

  const pairs = await match(targets, projects)
  const imported: CoverResult[] = []
  for (const { target, project } of pairs) {
    const t = targets[target], p = projects[project]
    const tmp = mkdtempSync(join(tmpdir(), 'bkk-cover-'))
    try {
      const big = resize(p.cover, tmp, 1400)
      const thumb = resize(p.cover, tmp, 480)
      const base = `u-${randomBytes(4).toString('hex')}`
      const path = `/photos/${t.id}/${base}.jpg`
      const focus = await detectTextFocus(big)
      await transact(`剪輯台封面 ${t.name_zh}`, async (tx) => {
        tx.writeBase64(`public${path}`, big)
        tx.writeBase64(`public/photos/${t.id}/${base}-480.jpg`, thumb)
        const locs = await txLocations(tx)
        const loc = locs.find((l) => l.id === t.id)
        if (!loc) return
        loc.video_cover = path
        if (focus !== null) loc.photo_focus = { ...loc.photo_focus, [path]: focus }
        txWriteLocations(tx, locs)
      })
      imported.push({ name: t.name_zh || t.name_en, project: p.name, cover: path })
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }
  return { targets: targets.length, projects: projects.length, imported }
}
