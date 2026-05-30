#!/usr/bin/env node
/**
 * One-time script to translate name_zh and improve description_zh for all locations.
 * Usage: ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-locations.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '../data/locations.json')
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set')
  process.exit(1)
}

async function claude(prompt, maxTokens = 1024) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.content[0].text.trim()
}

async function translateBatch(names) {
  const prompt = `Translate these Bangkok restaurant/place names to Traditional Chinese (繁體中文).

Rules:
- Thai names: provide Chinese phonetic transliteration or brief Chinese descriptor
- English brand names: use standard Chinese (e.g. "星巴克" for Starbucks) if exists, else keep English + brief Chinese tag
- Descriptive English names: translate key words (e.g. "Beans Coffee Roasters" → "Beans 精品烘焙")
- Thai/English mix: keep English brand, translate/transliterate Thai part
- Max 12 Chinese characters per name
- No quotes in output

Return ONLY a JSON array of strings, same count as input:
${JSON.stringify(names)}`

  const text = await claude(prompt, 2048)
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in response: ' + text)
  const parsed = JSON.parse(match[0])
  if (!Array.isArray(parsed) || parsed.length !== names.length) {
    throw new Error(`Expected ${names.length} items, got ${parsed.length}`)
  }
  return parsed
}

const CAT_ZH = { food: '餐廳', cafe: '咖啡廳', shopping: '購物', nightlife: '夜生活', hotel: '飯店' }

async function improveDescZh(loc) {
  const isTemplate = !loc.description_zh ||
    loc.description_zh === loc.description_en ||
    /^曼谷熱門.{1,8}，評價極佳。$/.test(loc.description_zh) ||
    loc.description_zh.length < 15

  if (!isTemplate) return loc.description_zh

  const highlights = (loc.highlights ?? []).slice(0, 3)
  const editorial = loc.description_en?.replace(/Must-try:.*$/, '').trim()

  const prompt = `Write a short Traditional Chinese (繁體中文) description for a Bangkok travel guide.

Place: ${loc.name_en}
Category: ${CAT_ZH[loc.category] ?? loc.category}
${editorial && editorial.length > 10 ? `About: "${editorial}"` : ''}
${highlights.length ? `Must-try: ${highlights.join(', ')}` : ''}

Requirements:
- 20-50 Chinese characters total
- If must-try items exist, start with: 必點：X、Y。
- Then 1 sentence about vibe or specialty
- Sound like a local tip, not marketing copy
- No generic filler

Return ONLY the Chinese text, no quotes, no explanation.`

  return await claude(prompt, 200)
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  console.log(`Processing ${data.length} locations...`)

  // Step 1: Batch translate all name_zh (10 at a time)
  console.log('\n--- Step 1: Translating names ---')
  const BATCH = 10
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH)
    const names = batch.map(l => l.name_en)
    console.log(`  [${i + 1}-${Math.min(i + BATCH, data.length)}/${data.length}] ${names[0]}...`)
    try {
      const translated = await translateBatch(names)
      for (let j = 0; j < batch.length; j++) {
        data[i + j].name_zh = translated[j]
      }
    } catch (err) {
      console.error('  Translation batch failed:', err.message)
      // Keep existing name_zh (= name_en) as fallback
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500))
  }

  // Step 2: Improve template description_zh (one at a time, only templates)
  console.log('\n--- Step 2: Improving descriptions ---')
  let improved = 0
  for (let i = 0; i < data.length; i++) {
    const loc = data[i]
    const isTemplate = !loc.description_zh ||
      /^曼谷熱門.{1,8}，評價極佳。$/.test(loc.description_zh) ||
      loc.description_zh.length < 15
    if (!isTemplate) continue
    console.log(`  [${i + 1}/${data.length}] ${loc.name_en}`)
    try {
      data[i].description_zh = await improveDescZh(loc)
      improved++
    } catch (err) {
      console.error('  Desc failed:', err.message)
    }
    await new Promise(r => setTimeout(r, 300))
  }
  console.log(`  Improved ${improved} descriptions`)

  // Save
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  console.log('\nDone! Saved to data/locations.json')
}

main().catch(err => { console.error(err); process.exit(1) })
