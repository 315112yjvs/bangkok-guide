import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

// 讀 .env.local 取 ANTHROPIC_API_KEY
const env = readFileSync('.env.local', 'utf-8')
const key = env.match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
if (!key) { console.error('找不到 ANTHROPIC_API_KEY'); process.exit(1) }
const client = new Anthropic({ apiKey: key })

const APPLY = process.argv.includes('--apply')
const TAGS = ['trending', 'hidden_gem', 'new_opening', 'evergreen']
const ZH = { trending: '話題爆紅', hidden_gem: '在地私藏', new_opening: '新開幕', evergreen: '經典必訪' }

const RULES = `標籤定義（依「店的本質與知名度」判斷，不是看從哪抓來的）：
- trending（話題爆紅）：社群正在瘋傳、TikTok/IG 爆紅、排隊名店、近期話題度高、網美打卡熱點。
- hidden_gem（在地私藏）：在地人才知道、藏在巷弄、觀光客少、低調私房店。
- new_opening（新開幕）：描述明確提到近期新開幕（2025/2026 新開、剛開幕）。沒明說就不要選這個。
- evergreen（經典必訪）：老字號、經典不敗、知名地標、來曼谷必訪的代表店、評價成熟穩定的名店。

重要：不是每間都是「在地私藏」。知名、大家都知道的店要歸 trending 或 evergreen；
只有真的低調、觀光客不太會去的才算 hidden_gem。請依實際性質分散到四類。`

async function tagBatch(batch) {
  const list = batch.map((l, i) =>
    `${i}. ${l.name_en}｜來源:${l.source}｜評分:${l.rating}｜${(l.description_zh || l.description_en || '').slice(0, 140)}`
  ).join('\n')
  const prompt = `你是曼谷在地指南的編輯。請判斷以下每個地點最適合的「標籤」。

${RULES}

只回傳一個 JSON 陣列，每個元素 {"i": 編號, "tag": "標籤"}，tag 必須是 ${TAGS.join(' / ')} 其中之一。不要任何說明文字。

地點：
${list}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const m = raw.match(/\[[\s\S]*\]/)
  if (!m) return []
  return JSON.parse(m[0])
}

const PATH = 'data/locations.json'
const locs = JSON.parse(readFileSync(PATH, 'utf-8'))
const curTag = (l) => l.tag || (l.trending ? 'trending' : 'evergreen')

const BATCH = 25
const newTags = new Array(locs.length)
for (let start = 0; start < locs.length; start += BATCH) {
  const batch = locs.slice(start, start + BATCH)
  process.stderr.write(`標籤判斷中 ${start + 1}–${start + batch.length} / ${locs.length}...\n`)
  let res = []
  try { res = await tagBatch(batch) } catch (e) { console.error('batch failed', e.message) }
  for (const r of res) {
    if (typeof r.i === 'number' && TAGS.includes(r.tag)) newTags[start + r.i] = r.tag
  }
}

const before = {}, after = {}
const changes = []
for (let i = 0; i < locs.length; i++) {
  const c = curTag(locs[i])
  before[c] = (before[c] || 0) + 1
  const n = newTags[i] || c
  after[n] = (after[n] || 0) + 1
  if (n !== c) changes.push(`  [${ZH[c]} → ${ZH[n]}] ${locs[i].name_en}`)
}

console.log(`\n${APPLY ? '【已寫入】' : '【預覽，未寫檔】'} 變更 ${changes.length} 筆 / 共 ${locs.length} 筆`)
console.log('\n變更前分布:', JSON.stringify(before))
console.log('變更後分布:', JSON.stringify(after))
console.log('\n變更明細（前 80 筆）:')
console.log(changes.slice(0, 80).join('\n'))

if (APPLY) {
  for (let i = 0; i < locs.length; i++) if (newTags[i]) locs[i].tag = newTags[i]
  writeFileSync(PATH, JSON.stringify(locs, null, 2))
  console.log('\n✓ 已寫入 data/locations.json')
} else {
  console.log('\n（這是預覽。確認後加 --apply 才會寫入）')
}
