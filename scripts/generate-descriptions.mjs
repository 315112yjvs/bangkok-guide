// Generate proper Chinese descriptions for all locations using Claude
// Usage: node scripts/generate-descriptions.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '../data/locations.json')
const API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8').match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim()

if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1) }

async function claude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${JSON.stringify(data)}`)
  return data.content[0].text.trim()
}

const CAT_ZH = { food: '餐廳', cafe: '咖啡廳', shopping: '購物', nightlife: '酒吧/夜生活', hotel: '飯店' }

async function generateDesc(loc) {
  const highlights = (loc.highlights ?? []).slice(0, 3).join('、') || '無'
  const price = ['', '親民', '中等', '高檔', '精緻奢華'][loc.price_range] || '中等'
  const catZh = CAT_ZH[loc.category] ?? loc.category
  const local = loc.local_ratio ? `在地客比例 ${loc.local_ratio}%` : ''
  const trending = loc.trending ? '近期熱門' : ''

  const prompt = `你是曼谷旅遊達人，請為以下曼谷${catZh}寫一段繁體中文簡介（30-50字），要具體、有吸引力，適合給台灣旅客看。不要用「這家」、「這間」開頭，不要有任何標題或前綴，直接輸出簡介正文。

店名：${loc.name_en}
類別：${catZh}
評分：${loc.rating}/5
價位：${price}
亮點菜色：${highlights}
${local}
${trending}
${loc.description_en ? `Google 原始描述：${loc.description_en.slice(0, 120)}` : ''}`

  return claude(prompt)
}

async function main() {
  const locs = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
  console.log(`Generating descriptions for ${locs.length} locations...\n`)

  let done = 0
  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i]

    // Reset name_zh to original English name (Google Maps name)
    locs[i].name_zh = loc.name_en

    try {
      const desc = await generateDesc(loc)
      locs[i].description_zh = desc
      done++
      process.stdout.write(`[${i+1}/${locs.length}] ${loc.name_en.slice(0, 35)}\n  → ${desc.slice(0, 60)}…\n`)
    } catch (e) {
      console.error(`  [${i+1}] FAILED: ${e.message.slice(0, 80)}`)
    }

    // ~5 req/s to stay within rate limits
    await new Promise(r => setTimeout(r, 200))
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(locs, null, 2))
  console.log(`\nDone. Generated ${done}/${locs.length} descriptions.`)
}

main().catch(console.error)
