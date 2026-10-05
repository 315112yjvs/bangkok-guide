// 給 Claude Code 的 write-descriptions 技能用的小工具：列出要寫介紹的店、把寫好的介紹存回資料檔。
// 不呼叫任何付費 API。
//
//   node scripts/descriptions.mjs list                 列出待審裡還沒有介紹的店
//   node scripts/descriptions.mjs list --approved "店名關鍵字"   找已上架的店（要重寫時用）
//   node scripts/descriptions.mjs set <id> <json 檔>    把 {zh, en, highlights?} 存進該筆資料
//
// 每次都重新讀檔再寫回，只改指定那一筆的介紹欄位，不會蓋掉後台同時做的其他修改。
import { readFileSync, writeFileSync } from 'fs'

const FILES = { pending: 'data/pending.json', approved: 'data/locations.json' }
const read = (f) => JSON.parse(readFileSync(f, 'utf-8'))
const needsDescription = (l) => !l.description_zh || l.description_zh.trim().length < 20

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'list') {
  const approvedIdx = args.indexOf('--approved')
  let items
  if (approvedIdx >= 0) {
    const kw = (args[approvedIdx + 1] ?? '').toLowerCase()
    items = read(FILES.approved).filter((l) => kw && l.name_en.toLowerCase().includes(kw))
  } else {
    items = read(FILES.pending).filter(needsDescription)
  }
  console.log(JSON.stringify(items.map((l) => ({
    id: l.id,
    name: l.name_en,
    category: l.category,
    address: l.address,
    rating: l.rating,
    maps_url: l.source_url,
    current_zh: l.description_zh,
    evidence: (l.evidence ?? []).map((e) => ({ url: e.url, says: e.facts || e.quote || e.title })),
  })), null, 2))
} else if (cmd === 'set') {
  const [id, jsonPath] = args
  const input = read(jsonPath)
  if (!id || typeof input.zh !== 'string' || input.zh.trim().length < 20 || typeof input.en !== 'string' || !input.en.trim()) {
    console.error('用法：set <id> <json 檔>，檔案內容 {"zh": "...", "en": "...", "highlights": ["..."]}（zh 至少 20 字）')
    process.exit(1)
  }
  let done = false
  for (const [where, file] of Object.entries(FILES)) {
    const list = read(file)
    const item = list.find((l) => l.id === id)
    if (!item) continue
    item.description_zh = input.zh.trim()
    item.description_en = input.en.trim()
    if (Array.isArray(input.highlights)) {
      item.highlights = input.highlights.filter((h) => typeof h === 'string' && h.trim()).map((h) => h.trim()).slice(0, 2)
    }
    writeFileSync(file, JSON.stringify(list, null, 2))
    console.log(`已更新（${where}）：${item.name_en}`)
    done = true
    break
  }
  if (!done) { console.error(`找不到 id：${id}`); process.exit(1) }
} else {
  console.error('指令：list | list --approved "關鍵字" | set <id> <json 檔>')
  process.exit(1)
}
