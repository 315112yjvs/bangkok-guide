import Anthropic from '@anthropic-ai/sdk'
import { slugify } from './slug'

// 店名只有泰文時 slugify 會是空的，原本會退回 place-xxxxxxxx 這種看不懂的網址。
// 這裡請 AI 把泰文店名轉成拼音當網址，失敗就維持原本的後備做法。
async function romanize(name: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return ''
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `把這個曼谷店名轉成網址用的英文拼音（泰文用 RTGS 拼音，有常見英文寫法就用常見的），只輸出小寫英文、數字和連字號，最多 6 個字，不要任何說明：\n${name}`,
      }],
    })
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim().split('\n')[0]
    return slugify(text).split('-').slice(0, 6).join('-')
  } catch {
    return ''
  }
}

// 回傳一個不跟現有店家重複的 slug；英文店名能直接轉就不呼叫 AI
export async function makeSlug(name: string, taken: Set<string>): Promise<string | undefined> {
  const base = slugify(name) || (await romanize(name))
  if (!base) return undefined
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}
