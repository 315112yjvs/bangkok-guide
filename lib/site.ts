import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// 站主在後台填寫、顯示在「關於」頁的聯絡方式。存成 data/site.json，跟地點資料一起由後台「存檔並上傳」推上線。
export type SiteContact = {
  instagram: string   // 帳號或完整網址
  threads: string
  facebook: string
  line: string        // LINE ID 或官方帳號連結
  email: string
  note: string        // 自由填寫的一段話（合作邀約、勘誤回報方式等）
}

export const EMPTY_CONTACT: SiteContact = { instagram: '', threads: '', facebook: '', line: '', email: '', note: '' }

function sitePath(): string {
  return join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'site.json')
}

export function readContact(): SiteContact {
  try {
    if (!existsSync(sitePath())) return { ...EMPTY_CONTACT }
    const raw = JSON.parse(readFileSync(sitePath(), 'utf-8'))
    return { ...EMPTY_CONTACT, ...(raw.contact ?? {}) }
  } catch {
    return { ...EMPTY_CONTACT }
  }
}

export function writeContact(contact: Partial<SiteContact>): SiteContact {
  // 只收已知欄位、去頭尾空白、限制長度，避免存進奇怪的東西
  const clean = { ...EMPTY_CONTACT }
  for (const k of Object.keys(EMPTY_CONTACT) as (keyof SiteContact)[]) {
    const v = contact[k]
    if (typeof v === 'string') clean[k] = v.trim().slice(0, k === 'note' ? 500 : 200)
  }
  writeFileSync(sitePath(), JSON.stringify({ contact: clean }, null, 2) + '\n')
  return clean
}

type ContactLink = { label: string; text: string; href?: string }

const handle = (v: string) => v.replace(/^@/, '').replace(/\/+$/, '')
const isUrl = (v: string) => /^https?:\/\//i.test(v)

// 把填寫的內容轉成要顯示的連結（接受帳號或完整網址兩種寫法）
export function contactLinks(c: SiteContact): ContactLink[] {
  const out: ContactLink[] = []
  if (c.instagram) out.push({ label: 'Instagram', text: isUrl(c.instagram) ? c.instagram.replace(/^https?:\/\/(www\.)?/i, '') : `@${handle(c.instagram)}`, href: isUrl(c.instagram) ? c.instagram : `https://www.instagram.com/${handle(c.instagram)}` })
  if (c.threads) out.push({ label: 'Threads', text: isUrl(c.threads) ? c.threads.replace(/^https?:\/\/(www\.)?/i, '') : `@${handle(c.threads)}`, href: isUrl(c.threads) ? c.threads : `https://www.threads.net/@${handle(c.threads)}` })
  if (c.facebook) out.push({ label: 'Facebook', text: isUrl(c.facebook) ? c.facebook.replace(/^https?:\/\/(www\.)?/i, '') : handle(c.facebook), href: isUrl(c.facebook) ? c.facebook : `https://www.facebook.com/${handle(c.facebook)}` })
  if (c.line) out.push({ label: 'LINE', text: isUrl(c.line) ? c.line.replace(/^https?:\/\//i, '') : c.line, href: isUrl(c.line) ? c.line : undefined })
  if (c.email) out.push({ label: 'Email', text: c.email, href: `mailto:${c.email}` })
  return out
}
