import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// Translate a batch of English location names → Traditional Chinese.
// Returns array in same order. Falls back to original on error.
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

// Translate a single English name → Traditional Chinese
export async function translateName(name: string): Promise<string> {
  const results = await translateNames([name])
  return results[0] ?? name
}

// Generate a proper Chinese description from English editorial + highlights
export async function generateDescriptionZh(
  nameEn: string,
  editorial: string | undefined,
  highlights: string[],
  category: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const catZh: Record<string, string> = {
      food: '餐廳', cafe: '咖啡廳', shopping: '購物景點', nightlife: '夜生活場所', hotel: '飯店',
    }
    const highlightZh = highlights.length > 0 ? `必點：${highlights.join('、')}。` : ''
    return `${highlightZh}曼谷熱門${catZh[category] ?? '地點'}，評價極佳。`
  }

  const context = editorial
    ? `Editorial: "${editorial}"`
    : `Category: ${category}${highlights.length ? `, highlights: ${highlights.join(', ')}` : ''}`

  const prompt = `Write a short Traditional Chinese (繁體中文) description for a Bangkok travel guide listing.

Place: ${nameEn}
${context}
${highlights.length ? `Must-try items: ${highlights.join(', ')}` : ''}

Requirements:
- 20-50 Chinese characters
- Start with must-try items if available: "必點：X、Y。"
- Then 1-2 sentences about the vibe or what makes it special
- No generic filler like "評價極佳" unless truly warranted
- Sound like a local recommendation

Return ONLY the Chinese description text, no quotes.`

  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || `曼谷熱門${category === 'cafe' ? '咖啡廳' : '餐廳'}。`
  } catch {
    return `曼谷熱門${category === 'cafe' ? '咖啡廳' : '餐廳'}。`
  }
}
