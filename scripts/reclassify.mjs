import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

// 讀 .env.local 取 ANTHROPIC_API_KEY
const env = readFileSync('.env.local', 'utf-8')
const key = env.match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
if (!key) { console.error('找不到 ANTHROPIC_API_KEY'); process.exit(1) }
const client = new Anthropic({ apiKey: key })

const CATS = ['food', 'cafe', 'shopping', 'nightlife', 'hotel', 'attraction']

const RULES = `分類定義（依「主要性質」判斷，不要只看名字裡有沒有某個字）：
- nightlife：以喝酒/夜生活為主的場所 — 酒吧、調酒吧、speakeasy、pub、夜店、屋頂酒吧、wine bar、jazz bar。注意：名字有「Restaurant and Bar / Dining and Bar」但主要是「吃飯的餐廳」→ 歸 food，不是 nightlife。
- cafe：咖啡廳、specialty coffee、烘豆店、早午餐為主的咖啡館、甜點/茶飲店。
- food：餐廳、小館、街邊美食、以「用餐」為主的地方。
- shopping：商場、市集、選物店、商店。
- hotel：飯店、resort、青旅、住宿。
- attraction：景點、寺廟、公園、美術館、藝廊、打卡地標、拍照景點。`

async function classifyBatch(batch) {
  const list = batch.map((l, i) =>
    `${i}. ${l.name_en} — ${(l.description_zh || l.description_en || '').slice(0, 120)}`
  ).join('\n')
  const prompt = `你是曼谷在地指南的編輯。請判斷以下每個地點最適合的分類。

${RULES}

只回傳一個 JSON 陣列，每個元素 {"i": 編號, "category": "分類"}，category 必須是 ${CATS.join(' / ')} 其中之一。不要任何說明文字。

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

const PATHS = ['data/locations.json', 'bangkok-guide/data/locations.json']
const locs = JSON.parse(readFileSync(PATHS[0], 'utf-8'))

const BATCH = 25
const newCats = new Array(locs.length)
for (let start = 0; start < locs.length; start += BATCH) {
  const batch = locs.slice(start, start + BATCH)
  process.stderr.write(`分類中 ${start + 1}–${start + batch.length} / ${locs.length}...\n`)
  let res = []
  try { res = await classifyBatch(batch) } catch (e) { console.error('batch failed', e.message) }
  for (const r of res) {
    if (typeof r.i === 'number' && CATS.includes(r.category)) {
      newCats[start + r.i] = r.category
    }
  }
}

let changed = 0
const changes = []
for (let i = 0; i < locs.length; i++) {
  const nc = newCats[i]
  if (nc && nc !== locs[i].category) {
    changes.push(`  [${locs[i].category} → ${nc}] ${locs[i].name_en}`)
    locs[i].category = nc
    changed++
  }
}

for (const p of PATHS) writeFileSync(p, JSON.stringify(locs, null, 2))

console.log(`\n重新分類完成：${changed} 筆變更（共 ${locs.length} 筆）`)
console.log(changes.slice(0, 60).join('\n'))
const dist = {}
for (const l of locs) dist[l.category] = (dist[l.category] || 0) + 1
console.log('\n新分類分布:', JSON.stringify(dist))
