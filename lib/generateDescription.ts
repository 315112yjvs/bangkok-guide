import Anthropic from '@anthropic-ai/sdk'
import { extractPlaceId } from './maps'
import type { Evidence, LocationTag } from './types'

// 中英文店家介紹的生成邏輯：抓 Google 官方簡介＋真實評論，再讓 Claude 上網查證後撰寫。
// 後台的「生成描述」按鈕（/api/generate-description）與爬蟲（找熱點模式）共用這一份。

const CAT_ZH: Record<string, string> = {
  food: '餐廳', cafe: '咖啡廳', shopping: '購物景點',
  nightlife: '夜生活場所', hotel: '飯店', attraction: '景點',
}

// Pull Google's own editorial summary + real reviews for the EXACT place (by place_id).
async function fetchPlaceFacts(placeId: string): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return ''
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'displayName,formattedAddress,editorialSummary,reviews,rating,primaryTypeDisplayName,websiteUri',
        'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.bkk-local.com/',
      },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return ''
    const d = await res.json()
    const parts: string[] = []
    if (d.displayName?.text) parts.push(`官方名稱：${d.displayName.text}`)
    if (d.primaryTypeDisplayName?.text) parts.push(`類型：${d.primaryTypeDisplayName.text}`)
    if (d.formattedAddress) parts.push(`地址：${d.formattedAddress}`)
    if (typeof d.rating === 'number') parts.push(`Google 評分：${d.rating}`)
    if (d.websiteUri) parts.push(`官網：${d.websiteUri}`)
    if (d.editorialSummary?.text) parts.push(`Google 官方簡介：${d.editorialSummary.text}`)
    const reviews: string[] = ((d.reviews ?? []) as Array<{ text?: { text: string }; originalText?: { text: string } }>)
      .map((r) => r.text?.text ?? r.originalText?.text ?? '')
      .filter((t) => t.length > 20)
      .slice(0, 5)
    if (reviews.length) parts.push(`真實評論摘錄：\n- ${reviews.join('\n- ')}`)
    return parts.join('\n')
  } catch {
    return ''
  }
}

export type GenerateInput = {
  name_en: string
  address?: string
  source_url?: string
  category?: string
  // 爬蟲找到這家店時的出處（媒體文章/社群貼文怎麼形容它），給 AI 當線索
  evidence?: Evidence[]
}

export type GeneratedDescription = {
  description_zh: string
  description_en: string
  tag?: LocationTag
  highlights?: string[]
  grounded: boolean
}

// 失敗時 throw（沒有 API key、模型輸出無法解析、API 錯誤）
export async function generateDescription(input: GenerateInput): Promise<GeneratedDescription> {
  const { name_en, address, source_url, category, evidence } = input
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('no anthropic key')

  const catZh = CAT_ZH[category ?? ''] ?? '地點'
  const placeId = extractPlaceId(source_url) ?? null
  const placeFacts = placeId ? await fetchPlaceFacts(placeId) : ''

  const evidenceText = (evidence ?? [])
    .filter((e) => e.quote || e.title)
    .slice(0, 5)
    .map((e) => `- ${e.quote || e.title}（${e.url}）`)
    .join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `你是曼谷在地旅遊指南的編輯。請針對「同一家、千真萬確的這家店」上網查證後，寫出精準且符合現實的中英文介紹。

【目標店家】
名稱：${name_en}
${address ? `地址：${address}` : ''}
${source_url ? `Google Maps 連結：${source_url}` : ''}
分類：${catZh}

${placeFacts ? `【Google 官方資料與真實評論（最可靠，請優先採用）】\n${placeFacts}\n` : ''}
${evidenceText ? `【近期媒體/社群怎麼介紹這家店（爬蟲抓到的出處，可當作線索，仍需查證）】\n${evidenceText}\n` : ''}

【務必遵守】
- 先用 web_search 查證這家店的真實資訊（招牌餐點/飲品、特色、所在巷弄、店主背景）。搜尋時帶上店名與地址，確認是曼谷同一家店，不要寫成同名的別家。
- 只寫查得到的具體事實，絕對不要憑空想像或用空泛氛圍詞填充。
- **絕對不要寫營業時間（幾點到幾點、星期幾營業），也不要寫價格、價位、人均消費或任何金額。** 這些資訊會單獨呈現，描述裡出現就是錯。
- 中文 50–100 字；英文是中文的自然翻譯，保留所有具體事實，語氣像熟門熟路的朋友推薦。
- 開頭可用一個貼切的 emoji。

【好範例】
藏在 Soi Nana 巷弄裡，由新泰夫妻檔打造 🦆 北泰 Lanna 料理遇上娘惹風味，鴨肉酥脆貼葉、炸蠔驚喜連連。一樓是復古上海酒吧，雞尾酒靈感取自老唐人街傳說，氣氛迷人。

【壞範例（空泛，禁止）】
走進去就會愛上的地方 🕯️ 昏黃的燈光、復古的裝潢，感受曼谷夜生活的精緻與慵懶。

【再判斷一個標籤 tag（依這家店的本質與知名度）】
- trending（話題爆紅）：社群正在瘋傳、TikTok/IG 爆紅、排隊名店、近期話題度高、網美打卡熱點。
- hidden_gem（在地私藏）：在地人才知道、藏在巷弄、觀光客少、低調私房店。
- new_opening（新開幕）：查證到近期才新開幕（近一年內）。沒明確證據就不要選這個。
- evergreen（經典必訪）：老字號、經典不敗、知名地標、來曼谷必訪的代表店、評價成熟穩定的名店。

【再挑 1–2 個 highlight（卡片小標籤）】
- 只放「招牌餐點/飲品的具體名稱」或「明確特色」。簡短英文，每個 1–3 個字。
- 好例：Tom Yum、Khao Soi、Satay、Croissant、Rooftop View、Live Music、Riverside、Omakase。
- 嚴禁評論碎句、形容詞或空泛詞，例如 Clean、Soulful、Try it、Experience from here、A bit noisy、Booking in advance、If you are there 這類一律不要。
- 查不到具體招牌或特色就回空陣列 []。

查證完成後，你的回覆「最後一行」只輸出一個 JSON（不要加任何說明文字或 markdown 標記）：
{"zh":"中文介紹","en":"English description","tag":"trending 或 hidden_gem 或 new_opening 或 evergreen","highlights":["招牌1","招牌2"]}`

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let finalText = ''

  // Server-side web search may need a few continuation rounds (pause_turn).
  for (let i = 0; i < 4; i++) {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      messages,
    })

    finalText = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    if (msg.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: msg.content }]
      continue
    }
    break
  }

  // Extract the JSON object (take the last {...} that parses).
  const matches = finalText.match(/\{[\s\S]*?"zh"[\s\S]*?"en"[\s\S]*?\}/g)
  let parsed: { zh?: string; en?: string; tag?: string; highlights?: string[] } | null = null
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try { parsed = JSON.parse(matches[i]); break } catch { /* try previous */ }
    }
  }

  if (!parsed?.zh) {
    throw new Error(`could not parse model output: ${finalText.slice(0, 300)}`)
  }

  const VALID_TAGS = ['trending', 'hidden_gem', 'new_opening', 'evergreen']
  const tag = parsed.tag && VALID_TAGS.includes(parsed.tag) ? (parsed.tag as LocationTag) : undefined

  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .filter((h): h is string => typeof h === 'string')
        .map((h) => h.trim())
        .filter((h) => h.length >= 2 && h.length <= 24)
        .slice(0, 2)
    : undefined

  return {
    description_zh: parsed.zh,
    description_en: parsed.en ?? '',
    ...(tag ? { tag } : {}),
    ...(highlights ? { highlights } : {}),
    grounded: Boolean(placeFacts),
  }
}
