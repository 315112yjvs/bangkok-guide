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
    // Search with multiple queries to get richer, more specific content
    const queries = [
      `"${nameEn}" Bangkok restaurant review menu`,
      `${nameEn} Bangkok ร้านอาหาร`,
    ]
    const allResults: string[] = []
    for (const q of queries) {
      const results = await firecrawlSearch(q, 4)
      for (const r of results) {
        const content = r.markdown || r.description || ''
        if (content.length > 60) allResults.push(content.slice(0, 800))
        if (allResults.join('').length > 2500) break
      }
      if (allResults.join('').length > 2500) break
    }
    return allResults.join('\n\n---\n\n').slice(0, 3000)
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
  // Always search the web for specific facts (menu, story, location details)
  const web = await fetchWebContext(nameEn)
  if (web) facts.push(`Web research:\n${web}`)
  return facts
}

export async function generateDescriptionZh(
  nameEn: string,
  editorial: string | undefined,
  highlights: string[],
  category: string,
  area?: string
): Promise<string> {
  const CAT_ZH: Record<string, string> = {
    food: '餐廳', cafe: '咖啡廳', shopping: '購物景點',
    nightlife: '夜生活場所', hotel: '飯店', attraction: '景點',
  }
  const catZh = CAT_ZH[category] ?? '地點'

  if (!process.env.ANTHROPIC_API_KEY) return `曼谷人氣${catZh}，評價不錯，值得一訪。`

  const facts = await buildFacts(nameEn, editorial, highlights)
  const areaLine = area && area !== 'Bangkok' ? `區域：${area}` : ''
  const contextLines = [...(areaLine ? [areaLine] : []), ...facts]

  const prompt = `你是曼谷旅遊指南的編輯，用繁體中文為以下地點寫一段精準生動的介紹。

核心原則：
- **優先使用具體事實**：特定菜名、巷弄位置、店主故事、招牌特色、營業時間、獨特賣點
- 有什麼事實就寫什麼，**絕對不要補充資料裡沒有的內容**
- 文字要像熟悉這家店的朋友推薦，有具體資訊才有說服力
- 50–100 個中文字
- 直接輸出文字，不加引號

好的範例（有具體事實）：
「藏在 Soi Nana 巷弄裡，由新泰夫妻檔打造 🦆 北泰 Lanna 料理遇上娘惹風味，鴨肉酥脆貼葉、炸蠔驚喜連連。一樓是復古上海酒吧，雞尾酒靈感取自老唐人街黑幫傳說，偶有噴火表演，週二至週日開到深夜。」

差的範例（空洞氛圍，避免）：
「走進去就會愛上的地方 🕯️ 昏黃的燈光、復古的裝潢，調酒師俐落地搖晃著各式烈酒，感受曼谷夜生活的精緻與慵懶。」

地點名稱：${nameEn}
類別：${catZh}
${contextLines.length > 0 ? `參考資料（從這裡挑出具體事實來寫）：\n${contextLines.join('\n')}` : ''}`

  try {
    const msg = await client().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || `曼谷熱門${catZh}。`
  } catch {
    return `曼谷熱門${catZh}。`
  }
}

export async function translateZhToEn(descZh: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return descZh

  const prompt = `Translate the following Traditional Chinese Bangkok travel guide description into natural English. Keep all the specific facts, dish names, place names, and details — don't make it vaguer. Keep the same vivid, friend-recommending tone. Output only the translation, no quotes.

Chinese: ${descZh}`

  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return text || descZh
  } catch {
    return descZh
  }
}
