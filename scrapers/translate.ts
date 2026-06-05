import Anthropic from '@anthropic-ai/sdk'
import { firecrawlSearch } from './shared'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function translateNames(names: string[]): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY || names.length === 0) return names

  const prompt = `You are a Bangkok travel guide assistant. Translate these restaurant/place names to Traditional Chinese (繁體中文).

Rules:
- For Thai names: provide a short Chinese phonetic transliteration or descriptive name (e.g. "สยาม" → "暹羅廣場")
- For well-known English brand names: use standard Chinese names if they exist (e.g. "Starbucks" → "星巴克")
- For descriptive English names: translate key parts (e.g. "Beans Coffee Roasters" → "Beans 精品烘豆坊")
- For mixed Thai/English names: keep English part, translate/transliterate Thai
- Keep unique brand names that have no obvious Chinese equivalent mostly as-is but add a brief Chinese descriptor
- Maximum 12 Chinese characters per name

Return ONLY a JSON array of strings, same count as input, no explanation.

Names to translate:
${JSON.stringify(names, null, 2)}`

  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return names
    const parsed: string[] = JSON.parse(match[0])
    if (!Array.isArray(parsed) || parsed.length !== names.length) return names
    return parsed
  } catch (err) {
    console.error('Translation failed:', err)
    return names
  }
}

export async function translateName(name: string): Promise<string> {
  const results = await translateNames([name])
  return results[0] ?? name
}

async function fetchWebContext(nameEn: string): Promise<string> {
  if (!process.env.FIRECRAWL_API_KEY) return ''
  try {
    const results = await firecrawlSearch(`"${nameEn}" Bangkok`, 3)
    return results
      .filter(r => r.description && r.description.length > 40)
      .map(r => r.description?.slice(0, 300))
      .join(' | ')
      .slice(0, 600)
  } catch {
    return ''
  }
}

async function buildFacts(nameEn: string, editorial: string | undefined, highlights: string[]): Promise<string[]> {
  const JUNK = /experience|service|atmosphere|ambiance|recommend|visit|great|good|nice|best|love|worth|came here|first time|go back|every time|must try|will return/i
  const cleanHighlights = highlights.filter(h =>
    h.length <= 30 && (!h.includes(' ') || h.split(' ').length <= 3) && !JUNK.test(h)
  )
  const facts: string[] = []
  if (editorial) facts.push(`Google summary: "${editorial}"`)
  if (cleanHighlights.length > 0) facts.push(`Known for: ${cleanHighlights.join(', ')}`)
  if (!editorial) {
    const web = await fetchWebContext(nameEn)
    if (web) facts.push(`Web context: ${web}`)
  }
  return facts
}

export async function generateDescriptionZh(
  nameEn: string,
  editorial: string | undefined,
  highlights: string[],
  category: string
): Promise<string> {
  const CAT_ZH: Record<string, string> = {
    food: '餐廳', cafe: '咖啡廳', shopping: '購物景點',
    nightlife: '夜生活場所', hotel: '飯店', attraction: '景點',
  }
  const catZh = CAT_ZH[category] ?? '地點'

  if (!process.env.ANTHROPIC_API_KEY) return `曼谷人氣${catZh}，評價不錯，值得一訪。`

  const facts = await buildFacts(nameEn, editorial, highlights)
  if (facts.length === 0) return `曼谷人氣${catZh}，評價不錯，值得一訪。`

  const prompt = `你是曼谷旅遊指南的編輯，用繁體中文為以下地點寫一段生動介紹。

風格要求：
- 像朋友在 Instagram 推薦的語氣，有臨場感、有畫面
- 描述「在這裡的體驗」，而不只是列出特色
- 可帶入氛圍、景色或當下的感受
- 40–80 個中文字
- 只根據提供的資料寫，不補充未知細節
- 直接輸出文字，不加引號

風格範例：
「河邊烤肉的夜晚，沒有比這更對了 🔥 Everyday Mookrata Riverside 就坐落在昭披耶河畔，看著船來船往、微風吹過，一邊炭烤豬肉海鮮、一邊配現場音樂，曼谷夜晚最放鬆的方式就是這樣。」

地點名稱：${nameEn}
類別：${catZh}
參考資料：
${facts.join('\n')}`

  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || `曼谷熱門${catZh}。`
  } catch {
    return `曼谷熱門${catZh}。`
  }
}

export async function generateDescriptionEn(
  nameEn: string,
  editorial: string | undefined,
  highlights: string[],
  category: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return editorial ?? `A well-regarded ${category} spot in Bangkok.`

  const facts = await buildFacts(nameEn, editorial, highlights)
  if (facts.length === 0) return editorial ?? `A well-regarded ${category} spot in Bangkok.`

  const prompt = `Write a vivid, scene-setting description for a Bangkok travel guide.

Style:
- Like a friend recommending it on Instagram — atmospheric and experiential
- Describe being THERE, not just listing features
- 2–3 sentences, natural and evocative
- Only use the provided data, never invent details
- Output the description only, no quotes

Style example:
"Riverside mookata with the best view in Bangkok 🔥 Everyday Mookrata sits right along the Chao Phraya River — grill your pork and seafood while boats drift past, live music plays in the background, and the city lights reflect off the water. The kind of evening you won't want to end."

Place: ${nameEn}
Category: ${category}
Data:
${facts.join('\n')}`

  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || editorial ?? `A well-regarded ${category} spot in Bangkok.`
  } catch {
    return editorial ?? `A well-regarded ${category} spot in Bangkok.`
  }
}
