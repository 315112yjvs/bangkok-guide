import Anthropic from '@anthropic-ai/sdk'
import type { Category } from '@/lib/types'

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

export type TrendingMention = {
  name: string
  category: Category
  isNew: boolean   // 來源是否明確說它是新開幕
  why: string      // 來源怎麼形容這家店（繁中一句話）
  url: string
  title: string
}

// 從一批來源（文章全文或社群貼文摘要）抽出被提到的曼谷店家。
// 每個來源先編號，AI 回傳時帶編號，才能把每家店對回是哪個網址提到的。
export async function extractTrendingVenues(
  docs: { url: string; title: string; text: string }[]
): Promise<TrendingMention[]> {
  if (!process.env.ANTHROPIC_API_KEY || docs.length === 0) return []
  // 單篇文章最多讀 14000 字；多則摘要時每則已在上游限長
  const perDoc = docs.length === 1 ? 14000 : 700
  const body = docs
    .map((d, i) => `[來源 ${i + 1}] ${d.title}\n${d.text.slice(0, perDoc)}`)
    .join('\n\n---\n\n')
  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下是近一個月內關於曼谷新開幕、正在爆紅的餐廳／咖啡廳／酒吧／景點的文章或社群貼文。請抽出文中「具體提到的店家或景點」。

只回傳一個 JSON 陣列，不要其他文字：
[{"src": 1, "name": "...", "category": "...", "is_new": true, "why": "..."}]

欄位：
- src：這家店出現在哪個來源（上面的編號）。
- name：店家的專有名稱，照原文寫法（英文店名優先；只有泰文名就保留泰文）。不要加分店名以外的描述。
- category：food / cafe / nightlife / shopping / hotel / attraction 其中之一。
- is_new：來源明確說是新開幕、剛開、新店才填 true，否則 false。
- why：一句話（30 字內）寫出來源怎麼形容它、為什麼值得去。不論原文是泰文、英文或日文，一律翻成繁體中文。只能根據原文，原文沒寫就留空字串。

規則：
- 只收位於曼谷（含近郊暖武里、北欖）的實體店家或景點。清邁、普吉、芭達雅、考艾等外府的一律不要。
- 排除：通用詞（best cafe、top 10）、地區名（Thonglor、Sukhumvit）、百貨商場本身、連鎖品牌的泛稱、帳號名稱、人名、hashtag。
- 同一來源同一家店只列一次。每個來源最多 25 家。
- 沒有符合的就回傳 []。

${CLASSIFY_RULES}

內容：
${body}`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    const out: TrendingMention[] = []
    for (const v of parsed as Record<string, unknown>[]) {
      if (typeof v !== 'object' || v === null) continue
      const name = typeof v.name === 'string' ? v.name.trim() : ''
      const doc = docs[(Number(v.src) || 1) - 1] ?? docs[0]
      if (name.length < 3 || !VALID_CATS.has(v.category as Category)) continue
      out.push({
        name,
        category: v.category as Category,
        isNew: v.is_new === true,
        why: typeof v.why === 'string' ? v.why.trim().slice(0, 80) : '',
        url: doc.url,
        title: doc.title,
      })
    }
    return out
  } catch (err) {
    console.error('[trending] AI extraction failed:', err)
    return []
  }
}
