import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// 曼谷日記：一篇一張照片配短短的文字。照片存在 public/diary/<id>.jpg
export type DiaryEntry = {
  id: string
  date: string      // YYYY-MM-DD
  photo: string     // /diary/<id>.jpg
  text: string
  place?: string    // 選填：地點名稱（自由文字）
}

function diaryPath(): string {
  return join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'diary.json')
}

// 新的在前
export function readDiary(): DiaryEntry[] {
  if (!existsSync(diaryPath())) return []
  return sortDiary(JSON.parse(readFileSync(diaryPath(), 'utf-8')))
}

export function sortDiary(list: DiaryEntry[]): DiaryEntry[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export function writeDiary(list: DiaryEntry[]): void {
  writeFileSync(diaryPath(), JSON.stringify(list, null, 2))
}
