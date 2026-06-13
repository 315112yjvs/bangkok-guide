import Anthropic from '@anthropic-ai/sdk'
import type { Category } from '@/lib/types'

export type VenueEntry = { name: string; category: Category }

const VALID_CATS = new Set<Category>(['food', 'cafe', 'nightlife', 'shopping', 'hotel', 'attraction'])

let _client: Anthropic | null = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const CLASSIFY_RULES = `分類定義（依「主要性質」判斷，不要只看名字裡有沒有某個字）：
- nightlife：以喝酒/夜生活為主 — 酒吧、調酒吧、speakeasy、pub、夜店、屋頂酒吧、wine bar、jazz bar。名字有「Restaurant and Bar / Dining and Bar」但主要是吃飯的餐廳 → 歸 food。
- cafe：咖啡廳、specialty coffee、烘豆店、以 brunch 為主的咖啡館、甜點/茶飲店。
- food：餐廳、小館、街邊美食、以用餐為主。
- shopping：商場、市集、選物店、商店。
- hotel：飯店、resort、青旅、住宿。
- attraction：景點、寺廟、公園、美術館、藝廊、打卡地標、拍照景點。`

// 依店名+描述，用 AI 判斷最適合的分類。失敗時回傳 fallback。
export async function classifyCategory(
  name: string,
  description: string,
  fallback: Category = 'food'
): Promise<Category> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `${CLASSIFY_RULES}

地點：${name} — ${(description || '').slice(0, 200)}

只回傳一個分類字（food / cafe / nightlife / shopping / hotel / attraction），不要其他文字。`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim().toLowerCase() : ''
    const found = (['food', 'cafe', 'nightlife', 'shopping', 'hotel', 'attraction'] as Category[])
      .find((c) => raw.includes(c))
    return found ?? fallback
  } catch {
    return fallback
  }
}

// 用 Claude 從社群搜尋結果的標題/摘要裡，抽出「真正的店家/景點名稱」。
// 取代脆弱的 regex 抽取，大幅降低雜訊（地名、通用詞、Top 10 之類）。
export async function extractVenuesFromSnippets(
  snippets: string[],
  platform: string
): Promise<VenueEntry[]> {
  if (!process.env.ANTHROPIC_API_KEY || snippets.length === 0) return []
  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `以下是 ${platform} 上關於曼谷餐廳、咖啡廳、酒吧、景點的搜尋結果標題與摘要。請抽取出「真正具體的店家或景點名稱」。

只回傳一個 JSON 陣列：[{"name": "...", "category": "..."}]
category 必須是其中之一：food, cafe, nightlife, shopping, hotel, attraction

規則：
- 只抽真實的店名或景點專有名詞（例如 "Rongros"、"Gaga"、"Baan Ying"、"Patom Organic Living"）。
- 排除：通用詞（Bangkok food, best cafe, top 10, must try）、地區名（Thonglor, Sukhumvit, Silom, Ekkamai）、知名地標（Grand Palace, Wat Pho, Iconsiam）、形容詞、人名、hashtag 雜訊。
- 中英泰文店名都保留原樣。
- 最多 25 個不重複的店名。
- 找不到就回傳 []。

搜尋結果：
${snippets.join('\n---\n').slice(0, 8000)}`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[]).filter((v): v is VenueEntry =>
      typeof v === 'object' && v !== null &&
      typeof (v as VenueEntry).name === 'string' && (v as VenueEntry).name.trim().length > 2 &&
      VALID_CATS.has((v as VenueEntry).category)
    )
  } catch (err) {
    console.error(`[${platform}] AI extraction failed:`, err)
    return []
  }
}
