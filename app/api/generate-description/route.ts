import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const CAT_ZH: Record<string, string> = {
  food: '餐廳', cafe: '咖啡廳', shopping: '購物景點',
  nightlife: '夜生活場所', hotel: '飯店', attraction: '景點',
}

function extractPlaceId(url?: string): string | null {
  if (!url) return null
  return (
    url.match(/place_id:([^&\s]+)/)?.[1] ??
    url.match(/query_place_id=([^&\s]+)/)?.[1] ??
    null
  )
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

export async function POST(req: NextRequest) {
  const { name_en, address, source_url, category } = (await req.json()) as {
    name_en: string
    address?: string
    source_url?: string
    category?: string
  }
  if (!name_en?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'no anthropic key' }, { status: 500 })

  const catZh = CAT_ZH[category ?? ''] ?? '地點'
  const placeId = extractPlaceId(source_url)
  const placeFacts = placeId ? await fetchPlaceFacts(placeId) : ''

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `你是曼谷在地旅遊指南的編輯。請針對「同一家、千真萬確的這家店」上網查證後，寫出精準且符合現實的中英文介紹。

【目標店家】
名稱：${name_en}
${address ? `地址：${address}` : ''}
${source_url ? `Google Maps 連結：${source_url}` : ''}
分類：${catZh}

${placeFacts ? `【Google 官方資料與真實評論（最可靠，請優先採用）】\n${placeFacts}\n` : ''}

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

查證完成後，你的回覆「最後一行」只輸出一個 JSON（不要加任何說明文字或 markdown 標記）：
{"zh":"中文介紹","en":"English description","tag":"trending 或 hidden_gem 或 new_opening 或 evergreen"}`

  try {
    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
    let finalText = ''

    // Server-side web search may need a few continuation rounds (pause_turn).
    for (let i = 0; i < 4; i++) {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
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
    let parsed: { zh?: string; en?: string; tag?: string } | null = null
    if (matches) {
      for (let i = matches.length - 1; i >= 0; i--) {
        try { parsed = JSON.parse(matches[i]); break } catch { /* try previous */ }
      }
    }

    if (!parsed?.zh) {
      return NextResponse.json(
        { error: 'could not parse model output', raw: finalText.slice(0, 500) },
        { status: 502 }
      )
    }

    const VALID_TAGS = ['trending', 'hidden_gem', 'new_opening', 'evergreen']
    const tag = parsed.tag && VALID_TAGS.includes(parsed.tag) ? parsed.tag : undefined

    return NextResponse.json({
      description_zh: parsed.zh,
      description_en: parsed.en ?? '',
      ...(tag ? { tag } : {}),
      grounded: Boolean(placeFacts),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
