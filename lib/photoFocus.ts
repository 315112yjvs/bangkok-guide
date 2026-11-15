import Anthropic from '@anthropic-ai/sdk'

// 自己上傳的封面常是影片截圖，上面壓了大字，每張字的位置都不同。
// 卡片是橫的、照片是直的，只露出中間一段，字容易被切掉。
// 這裡請 AI 看照片找出文字區塊的垂直中心（0～100，從上往下），
// 網站顯示時用 object-position 把那一段對到畫面中間；沒有字就回 null（照舊置中）。
export async function detectTextFocus(jpegBase64: string): Promise<number | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await client.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
          {
            type: 'text',
            text: '這張照片上有沒有後製壓上去的大標題文字（不算招牌、包裝上的小字）？有的話，估計整塊標題文字（含店名那行）最上緣和最下緣在照片高度的百分比位置（0 是最上面，100 是最下面）。只輸出 JSON：{"has_text":true,"top":數字,"bottom":數字} 或 {"has_text":false}',
          },
        ],
      }],
    })
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    const j = JSON.parse(m[0]) as { has_text?: boolean; top?: number; bottom?: number }
    if (!j.has_text || typeof j.top !== 'number' || typeof j.bottom !== 'number') return null
    const c = (j.top + j.bottom) / 2
    return Math.max(0, Math.min(100, Math.round(c)))
  } catch {
    return null
  }
}
