import Anthropic from '@anthropic-ai/sdk'
import { extractPlaceId } from './maps'
import type { Evidence, LocationTag } from './types'

// 中英文店家介紹的生成邏輯：抓 Google 官方簡介＋真實評論＋爬蟲出處，讓 Claude 撰寫。
// 預設「不上網查證」（一筆約 0.02 美元）；web: true 才會用 web_search 查證（實測一筆約 1 美元，
// 費用主要來自搜尋結果的大量輸入 token），只留給後台單筆的「上網查證生成」按鈕。
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
  // true = 上網查證（貴很多，見檔頭說明）
  web?: boolean
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
  const { name_en, address, source_url, category, evidence, web = false } = input
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('no anthropic key')

  const catZh = CAT_ZH[category ?? ''] ?? '地點'
  const placeId = extractPlaceId(source_url) ?? null
  const placeFacts = placeId ? await fetchPlaceFacts(placeId) : ''

  const evidenceText = (evidence ?? [])
    .filter((e) => e.facts || e.quote || e.title)
    .slice(0, 5)
    .map((e) => `- ${e.facts || e.quote || e.title}（${e.url}）`)
    .join('\n')

  // 不上網查證時，手上沒有任何依據（Google 資料抓不到、也沒有爬蟲出處）就不要硬寫，
  // 否則會產出「公開資料有限」這種沒用的介紹。常見原因是 Google 當日查詢額度用完。
  if (!web && !placeFacts && !evidenceText) {
    throw new Error('沒有可用的資料來源（Google 店家資料抓不到，可能是當日查詢額度已用完），請稍後再試')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `你是曼谷在地旅遊指南的編輯。請針對「同一家、千真萬確的這家店」${web ? '上網查證後，' : '根據下方提供的資料，'}寫出精準且符合現實的中英文介紹。

【目標店家】
名稱：${name_en}
${address ? `地址：${address}` : ''}
${source_url ? `Google Maps 連結：${source_url}` : ''}
分類：${catZh}

${placeFacts ? `【Google 官方資料與真實評論（最可靠，請優先採用）】\n${placeFacts}\n` : ''}
${evidenceText ? `【近期媒體/社群怎麼介紹這家店（爬蟲抓到的出處）】\n${evidenceText}\n` : ''}

【務必遵守】
${web
  ? '- 先用 web_search 查證這家店的真實資訊（招牌餐點/飲品、特色、所在巷弄、店主背景）。搜尋時帶上店名與地址，確認是曼谷同一家店，不要寫成同名的別家。\n- 只寫查得到的具體事實，絕對不要憑空想像或用空泛氛圍詞填充。'
  : '- 只能使用上方【Google 官方資料與真實評論】與【近期媒體/社群】裡出現的事實（招牌餐點/飲品、特色、所在位置）。資料沒提到的事一律不要寫，不要用你自己的印象補充，也絕對不要用空泛氛圍詞填充。\n- 資料很少時就寫短一點，寧可只有一兩句具體的話。'}
- **絕對不要寫營業時間（幾點到幾點、星期幾營業），也不要寫價格、價位、人均消費或任何金額。** 這些資訊會單獨呈現，描述裡出現就是錯。
- 中文 50–100 字；英文是中文的自然翻譯，保留所有具體事實。語氣平實，像朋友口頭告訴你這家店在哪、賣什麼、哪裡特別。
- **不要用最高級和套路句型**：禁止「曼谷最⋯⋯的」「最⋯⋯的那一種」「走進去就不想離開」「讓人⋯⋯的地方」「不用飛⋯⋯就能」這類收尾或開場，也不要用「天堂」「秘境」「靈魂」「殿堂」這類誇飾詞。每家店的句子結構要不同，直接從事實寫起。
- 如果資料裡有實用的提醒（要訂位、常排隊、只收現金、座位少、店不好找、沒冷氣等），用一句話寫進去。資料沒提到就不要寫，不要自己編。
- 不用 emoji。

【好範例】
在 Soi Nana 巷子裡，老闆是一對新加坡與泰國夫妻。賣北泰 Lanna 菜加娘惹風味，招牌是貼著香葉煎到酥脆的鴨肉和炸蠔。一樓是復古上海風的酒吧，調酒用老唐人街的故事命名。位子不多，晚餐時段建議先訂位。

【壞範例（空泛，禁止）】
走進去就會愛上的地方 🕯️ 昏黃的燈光、復古的裝潢，感受曼谷夜生活的精緻與慵懶。

【再判斷一個標籤 tag（依這家店的本質與知名度）】
- trending（話題爆紅）：社群正在瘋傳、TikTok/IG 爆紅、排隊名店、近期話題度高、網美打卡熱點。
- hidden_gem（在地私藏）：在地人才知道、藏在巷弄、觀光客少、低調私房店。
- new_opening（新開幕）：資料明確顯示近期才新開幕（近一年內）。沒明確證據就不要選這個。
- evergreen（經典必訪）：老字號、經典不敗、知名地標、來曼谷必訪的代表店、評價成熟穩定的名店。

【再挑 1–2 個 highlight（卡片小標籤）】
- 只放「招牌餐點/飲品的具體名稱」或「明確特色」。簡短英文，每個 1–3 個字。
- 好例：Tom Yum、Khao Soi、Satay、Croissant、Rooftop View、Live Music、Riverside、Omakase。
- 嚴禁評論碎句、形容詞或空泛詞，例如 Clean、Soulful、Try it、Experience from here、A bit noisy、Booking in advance、If you are there 這類一律不要。
- 查不到具體招牌或特色就回空陣列 []。

${web ? '查證完成後，' : ''}你的回覆「最後一行」只輸出一個 JSON（不要加任何說明文字或 markdown 標記）：
{"zh":"中文介紹","en":"English description","tag":"trending 或 hidden_gem 或 new_opening 或 evergreen","highlights":["招牌1","招牌2"]}`

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let finalText = ''

  // Server-side web search may need a few continuation rounds (pause_turn).
  for (let i = 0; i < 4; i++) {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      ...(web ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] } : {}),
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
