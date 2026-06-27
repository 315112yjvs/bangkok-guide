import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// 輕量端點：用 haiku 依「名稱+現有介紹」重挑 1–2 個乾淨的 highlight（不上網、快又便宜），
// 用來修掉既有店家從評論硬抓來的廢話 highlight。
export async function POST(req: NextRequest) {
  const { name_en, description_zh, description_en, category } = await req.json()
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'no key' }, { status: 500 })
  if (!name_en?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `根據以下曼谷店家的名稱與介紹，挑出 1–2 個「卡片小標籤 highlight」。
名稱：${name_en}
分類：${category ?? ''}
介紹：${description_zh || description_en || ''}

規則：
- 只放「招牌餐點/飲品的具體名稱」或「明確特色」。簡短英文，每個 1–3 個字。
- 好例：Tom Yum、Khao Soi、Satay、Croissant、Rooftop View、Live Music、Riverside、Omakase。
- 嚴禁評論碎句、形容詞或空泛詞（Clean、Soulful、Try it、A bit noisy、If you are there、Experience from here 這類一律不要）。
- 介紹裡找不到具體招牌或特色就回空陣列 []。
只輸出一個 JSON 陣列（不要任何其他文字），例如：["Tom Yum","Rooftop View"]`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
    const m = raw.match(/\[[\s\S]*\]/)
    let arr: unknown = []
    if (m) { try { arr = JSON.parse(m[0]) } catch { /* ignore */ } }
    const highlights = (Array.isArray(arr) ? arr : [])
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.trim())
      .filter((h) => h.length >= 2 && h.length <= 24)
      .slice(0, 2)
    return NextResponse.json({ highlights })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
