import Anthropic from '@anthropic-ai/sdk'
import { firecrawlSearch, firecrawlScrape, sleep, type ScrapedItem } from './shared'

const PANTIP_QUERIES = [
  'site:pantip.com ร้านอาหาร กรุงเทพ แนะนำ อร่อย',
  'site:pantip.com คาเฟ่ กรุงเทพ น่าไป ถ่ายรูป',
  'site:pantip.com ร้านอาหาร กรุงเทพ คนไทย ชอบ',
  'site:pantip.com ร้านเด็ด กรุงเทพ 2024 2025',
  'site:pantip.com อาหารอีสาน กรุงเทพ อร่อย',
  'site:pantip.com ร้านอาหาร สุขุมวิท ทองหล่อ เอกมัย',
  'site:pantip.com บาร์ ค็อกเทล กรุงเทพ ดี',
  'site:pantip.com ร้านอาหาร ย่านรัชดา ลาดพร้าว',
]

let _client: Anthropic | null = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

async function extractNamesWithClaude(text: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return extractNamesRegex(text)
  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Extract Bangkok restaurant, cafe, bar, and food venue names from this Thai forum post.

Return ONLY a JSON array of venue name strings. Rules:
- Include real venue names (restaurants, cafes, bars, food courts, markets)
- If Thai name given, include it (e.g. "ร้านบัวลอย" or "Bua Loy")
- If English name given, include as-is
- Skip generic words (อาหาร, ร้านอาหาร, คาเฟ่ by themselves without a name)
- Maximum 10 names
- Return [] if no real venues found

Forum text:
${text.slice(0, 4000)}`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed: string[] = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed.filter(n => typeof n === 'string' && n.length > 1) : []
  } catch {
    return extractNamesRegex(text)
  }
}

// Regex fallback when no API key
const THAI_PLACE_PATTERN = /(?:^|\n)[\s*\d.-]*(?:ร้าน|คาเฟ่|บาร์|ห้องอาหาร|โรงแรม)?\s*([A-Z][A-Za-zก-๙\s&''.()]{3,50})(?:\s*[-–—:\n])/gm
const EN_PLACE_PATTERN = /(?:^|\n)[\s*\d.-]*([A-Z][A-Za-z\s&''.()]{3,50})(?:\s*[-–—:\n])/gm

function extractNamesRegex(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const SKIP = /^(ที่|การ|มี|ไป|แต่|และ|หรือ|จาก|The Best|Best |Top |Most )/i
  for (const pattern of [THAI_PLACE_PATTERN, EN_PLACE_PATTERN]) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim().replace(/\s+/g, ' ')
      if (name.length < 3 || name.length > 50) continue
      if (SKIP.test(name)) continue
      if (seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      names.push(name)
      if (names.length >= 8) break
    }
    if (names.length >= 8) break
  }
  return names
}

export async function scrapePantip(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []

  for (const query of PANTIP_QUERIES) {
    try {
      const searchResults = await firecrawlSearch(query, 5)
      for (const result of searchResults) {
        if (!result.url.includes('pantip.com')) continue
        try {
          const markdown = await firecrawlScrape(result.url)
          const names = await extractNamesWithClaude(markdown)
          console.log(`[Pantip] "${result.url.slice(0, 60)}" → ${names.length} names: ${names.slice(0,3).join(', ')}`)
          for (const name of names) {
            results.push({
              name_en: name,
              name_zh: name,
              description_en: `Recommended on Pantip — ${result.title ?? ''}`.slice(0, 120),
              description_zh: `Pantip 泰國論壇推薦`,
              address: 'Bangkok, Thailand',
              lat: 13.7563,
              lng: 100.5018,
              photos: [],
              source_url: result.url,
              rating: 4.0,
              price_range: 2,
              tag: 'evergreen',
            })
          }
          await sleep(1500)
        } catch {
          // skip individual page errors
        }
      }
      await sleep(2000)
    } catch (err) {
      console.error('Pantip scrape failed:', err)
    }
  }

  return results
}
