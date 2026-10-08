import { spawnSync } from 'child_process'
import { join } from 'path'

// 執行 scripts/download-photos.py，把還沒有本機檔的照片從 Google 下載下來。
// 爬蟲跑完（下載待審店家的封面）和後台「存檔並上傳」前（補齊上架店家的照片）各跑一次，
// 這樣每張照片只向 Google 付一次費，後台預覽和正式站都直接讀本機檔。
// 只在本機後台有效（Vercel 上沒有 Python，也不能寫檔）；失敗只記錄，不中斷原本的流程。
export function downloadPhotos(): string {
  try {
    const res = spawnSync('python3', [join(process.cwd(), 'scripts/download-photos.py')], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 10 * 60 * 1000,
    })
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
    if (res.status !== 0) console.error('[photos] download script failed:', out.slice(-500))
    else console.log('[photos]', out.split('\n').slice(-3).join(' | '))
    return out
  } catch (err) {
    console.error('[photos] could not run download script:', err)
    return ''
  }
}
