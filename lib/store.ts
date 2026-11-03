import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'

// 後台存檔的地方：
//  - 本機後台（npm run dev）：直接寫 repo 裡的檔案，按「存檔並上傳」才 commit + push
//  - 正式站後台（Vercel）：沒辦法寫檔，每次儲存直接用 GitHub API 在 main 上 commit，
//    Vercel 收到 push 自動重新部署，2～3 分鐘後網站更新。需要環境變數 GITHUB_TOKEN。
// 路徑一律相對於 repo 根目錄，例如 data/locations.json、public/photos/<id>/u-xxxx.jpg

export const isOnline = !!process.env.VERCEL
const REPO = process.env.GITHUB_REPO ?? '315112yjvs/bangkok-guide'
const BRANCH = process.env.GITHUB_BRANCH ?? 'main'

export type Tx = {
  readText(path: string): Promise<string | null>
  readJson<T>(path: string, fallback: T): Promise<T>
  // 資料夾裡的檔名（不含子資料夾），資料夾不存在回傳空陣列
  list(dir: string): Promise<string[]>
  writeText(path: string, text: string): void
  writeBase64(path: string, base64: string): void
  remove(path: string): void
}

type Change = { path: string; text?: string; base64?: string; remove?: boolean }

// ---------- 本機 ----------
const root = () => process.cwd()

function localTx(changes: Change[]): Tx {
  return {
    async readText(path) {
      const p = join(root(), path)
      return existsSync(p) ? readFileSync(p, 'utf-8') : null
    },
    async readJson(path, fallback) {
      const t = await this.readText(path)
      return t == null ? fallback : JSON.parse(t)
    },
    async list(dir) {
      const p = join(root(), dir)
      return existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter(d => d.isFile()).map(d => d.name) : []
    },
    writeText: (path, text) => { changes.push({ path, text }) },
    writeBase64: (path, base64) => { changes.push({ path, base64 }) },
    remove: (path) => { changes.push({ path, remove: true }) },
  }
}

function applyLocal(changes: Change[]) {
  for (const c of changes) {
    const p = join(root(), c.path)
    if (c.remove) { rmSync(p, { force: true }); continue }
    mkdirSync(dirname(p), { recursive: true })
    if (c.text != null) writeFileSync(p, c.text)
    else if (c.base64 != null) writeFileSync(p, Buffer.from(c.base64, 'base64'))
  }
}

// ---------- GitHub ----------
async function gh(path: string, init: RequestInit & { raw?: boolean } = {}) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('正式站後台還沒設定 GITHUB_TOKEN，沒辦法存檔')
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: init.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  return res
}

async function ghJson(path: string, init: RequestInit = {}) {
  const res = await gh(path, init)
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

class Conflict extends Error {}

function remoteTx(sha: string, changes: Change[]): Tx {
  const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/')
  return {
    async readText(path) {
      // 先看這次交易裡改過的版本
      const mine = [...changes].reverse().find(c => c.path === path)
      if (mine) return mine.remove ? null : mine.text ?? null
      const res = await gh(`/contents/${enc(path)}?ref=${sha}`, { raw: true })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`GitHub ${res.status} 讀取 ${path}`)
      return res.text()
    },
    async readJson(path, fallback) {
      const t = await this.readText(path)
      return t == null ? fallback : JSON.parse(t)
    },
    async list(dir) {
      const res = await gh(`/contents/${enc(dir)}?ref=${sha}`)
      if (res.status === 404) return []
      if (!res.ok) throw new Error(`GitHub ${res.status} 讀取 ${dir}`)
      const items = await res.json() as { name: string; type: string }[]
      return Array.isArray(items) ? items.filter(i => i.type === 'file').map(i => i.name) : []
    },
    writeText: (path, text) => { changes.push({ path, text }) },
    writeBase64: (path, base64) => { changes.push({ path, base64 }) },
    remove: (path) => { changes.push({ path, remove: true }) },
  }
}

async function headSha(): Promise<string> {
  const ref = await ghJson(`/git/ref/heads/${BRANCH}`)
  return ref.object.sha
}

async function commitRemote(parent: string, changes: Change[], message: string) {
  // 同一個路徑只留最後一次的改動
  const last = new Map<string, Change>()
  for (const c of changes) last.set(c.path, c)
  const tree = await Promise.all(Array.from(last.values()).map(async (c) => {
    if (c.remove) return { path: c.path, mode: '100644', type: 'blob', sha: null }
    const blob = await ghJson('/git/blobs', {
      method: 'POST',
      body: JSON.stringify(c.text != null ? { content: c.text, encoding: 'utf-8' } : { content: c.base64, encoding: 'base64' }),
    })
    return { path: c.path, mode: '100644', type: 'blob', sha: blob.sha }
  }))
  const parentCommit = await ghJson(`/git/commits/${parent}`)
  const newTree = await ghJson('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }) })
  const commit = await ghJson('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [parent] }) })
  const res = await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
  if (res.status === 422) throw new Conflict()   // 這段時間 main 被別人推過，整個交易重來
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

// ---------- 對外 ----------

// 讀一個檔案的最新內容（正式站讀 GitHub 上的 main，不是部署當下的舊版）
export async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!isOnline) return localTx([]).readJson(path, fallback)
  return remoteTx(await headSha(), []).readJson(path, fallback)
}

// 讀、改、寫一次完成。正式站上如果中途有人也存了檔，會用最新資料重跑 fn（最多 3 次）
export async function transact<R>(message: string, fn: (tx: Tx) => Promise<R>): Promise<R> {
  if (!isOnline) {
    const changes: Change[] = []
    const result = await fn(localTx(changes))
    applyLocal(changes)
    return result
  }
  for (let attempt = 0; ; attempt++) {
    const changes: Change[] = []
    const sha = await headSha()
    const result = await fn(remoteTx(sha, changes))
    if (!changes.length) return result
    try {
      await commitRemote(sha, changes, `admin: ${message}`)
      return result
    } catch (err) {
      if (err instanceof Conflict && attempt < 2) continue
      throw err
    }
  }
}

// 正式站後台的每次儲存都是一個 "admin: ..." commit，vercel.json 的 ignoreCommand 讓這些 commit 不觸發部署
// （不然上架 20 家店就會排 20 次部署）。按「存檔並上傳」才補一個空的 commit，把累積的修改一次部署出去。
export async function publish(message: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const sha = await headSha()
    const parent = await ghJson(`/git/commits/${sha}`)
    const commit = await ghJson('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: parent.tree.sha, parents: [sha] }) })
    const res = await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
    if (res.ok) return
    if (res.status !== 422 || attempt >= 2) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}

// 有沒有存了但還沒部署的修改（最新的 commit 是後台存檔）
export async function hasDrafts(): Promise<boolean> {
  if (!isOnline) return false
  const commit = await ghJson(`/git/commits/${await headSha()}`)
  return String(commit.message).startsWith('admin:')
}
