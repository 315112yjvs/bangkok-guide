import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { name_en, description_zh } = await req.json()
  if (!description_zh) return NextResponse.json({ note: '' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ note: '' })

  const client = new Anthropic({ apiKey })
  const prompt = `根據以下曼谷地點的介紹，寫一句短短的「在地人怎麼說」觀察，像是你去過這個地方的朋友給的一句貼心提醒或個人心得。

要求：
- 15–30 個中文字，一句話
- 口語自然，像在跟朋友說話
- 可以是小技巧、最佳時段、必點提醒、氛圍描述
- 直接輸出文字，不加引號

地點：${name_en}
介紹：${description_zh}`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })
    const note = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    return NextResponse.json({ note })
  } catch {
    return NextResponse.json({ note: '' })
  }
}
