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

  if (!process.env.ANTHROPIC_API_KEY) {
    return `曼谷人氣${catZh}，評價不錯，值得一訪。`
  }

  // Filter out generic review snippets that aren't actual menu items
  // (e.g. "Experience from here", "Good service", long sentences)
  const JUNK_PATTERNS = /experience|service|atmosphere|ambiance|recommend|visit|great|good|nice|best|love|worth|came here|first time|go back|every time|must try|will return/i
  const meaningfulHighlights = highlights.filter(h =>
    h.length <= 30 &&           // real item names are short
    !h.includes(' ') || h.split(' ').length <= 3  // max 3 words
  ).filter(h => !JUNK_PATTERNS.test(h))

  // Collect all available real facts
  const facts: string[] = []
  if (editorial) facts.push(`Google 簡介：「${editorial}」`)
  if (meaningfulHighlights.length > 0) facts.push(`招牌品項：${meaningfulHighlights.join('、')}`)

  // No Google editorial — search web for real info
  if (!editorial) {
    const web = await fetchWebContext(nameEn)
    if (web) facts.push(`網路資料：${web}`)
  }

  // No real data at all — skip Claude, use safe template
  if (facts.length === 0) {
    return `曼谷人氣${catZh}，評價不錯，值得一訪。`
  }

  const prompt = `根據以下真實資料，用繁體中文為曼谷旅遊指南寫一段簡短介紹。

場所名稱：${nameEn}
類別：${catZh}

參考資料：
${facts.join('\n')}

要求：
- 20–50 個中文字
- 只能寫參考資料中有提到的內容，絕對不可自行補充未提及的細節
- 若有招牌品項，以「必點：X、Y。」開頭
- 文字要像在地人推薦的語氣
- 只輸出中文介紹文字，不加引號`

  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || `曼谷熱門${catZh}。`
  } catch {
    return `曼谷熱門${catZh}。`
  }
}
