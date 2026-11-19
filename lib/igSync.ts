import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import { transact, isOnline, publish, type Tx } from './store'
import { txLocations, txWriteLocations, txPending, txWritePending } from './data'
import { txLocalizePhotos } from './googlePhotos'
import { makeSlug } from './autoSlug'
import { extractPlaceId } from './maps'
import { isHiddenCategory, INSTAGRAM_URL } from './site'
import { firecrawlScrape } from '@/scrapers/shared'
import { enrichItem } from '@/scrapers/enricher'
import { nameMatches } from '@/scrapers/index'
import type { Category, Location, PendingLocation } from './types'
import { parseProfile, parseCaption, igCode, postUrl, type ProfilePost } from './igParse'

export { parseProfile, parseCaption, igCode }

// IG 貼文自動連動到「曼谷人帶你去」：
//  1. 用 Firecrawl 讀 IG 個人頁，拿到最近的貼文清單（只看還沒處理過的）
//  2. 每篇讀完整文案，請 Claude 判斷這篇介紹哪個地點、是不是網站上已有的店
//  3. 已上架的店：掛上影片連結、放進「曼谷人帶你去」
//     新的店：用 Google 驗證後直接上架（介紹與站主心得取自文案）；分類被隱藏或對不上 Google 的放待審
//  4. 處理結果記在 data/ig-sync.json，同一篇不會重複處理（失敗的最多重試 3 次）
// 每天由 Vercel Cron 打 GET /api/ig-sync，後台也有「同步 IG」按鈕可以立刻跑。

export const IG_LOG_FILE = 'data/ig-sync.json'
const MAX_POSTS_PER_RUN = 3
const MAX_ATTEMPTS = 3

export type IgStatus = 'linked' | 'created' | 'pending' | 'skipped' | 'error'
export type IgLogEntry = {
  status: IgStatus
  at: string             // 處理時間
  posted?: string        // 貼文日期 YYYY-MM-DD
  title?: string         // 文案第一句，後台辨識用
  location_id?: string
  name?: string
  note?: string          // 為什麼略過、或其他說明
  attempts?: number
}
export type IgLog = Record<string, IgLogEntry>

type Analysis = {
  type: 'venue' | 'event' | 'multi' | 'other'
  name_en: string
  name_zh: string
  brand: string
  search_query: string
  match: number | null
  category: Category
  description_zh: string
  description_en: string
  curator_note: string
  reason: string
}

let _client: Anthropic | null = null
const client = () => (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))

const CATEGORIES: Category[] = ['food', 'cafe', 'shopping', 'nightlife', 'hotel', 'attraction', 'temple']

async function analyze(caption: string, locations: Location[]): Promise<Analysis> {
  const list = locations
    .map((l, i) => `${i}｜${l.name_en}｜${l.name_zh !== l.name_en ? l.name_zh : ''}｜${l.area ?? ''}｜${l.category}`)
    .join('\n')
  const res = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `這是曼谷探店帳號「曼谷人」自己發的 IG 貼文文案。請判斷這篇介紹的地點，並比對網站上已有的地點清單。

【貼文文案】
${caption}

【網站上已有的地點】（編號｜英文名｜中文名｜區域｜分類）
${list}

判斷規則：
- type：
  - venue：整篇在介紹「一個」具體地點（餐廳、咖啡廳、商店、寺廟、神壇、景點、市集）
  - event：期間限定活動或節慶佈置（聖誕佈置、廟會、快閃展），辦在某個地點
  - multi：一篇介紹好幾個地點的合輯
  - other：沒有具體地點
- match：這個地點如果就是清單裡的某一筆，填那筆的編號；同品牌但不同分店不算。沒有就填 null。只在很確定時才填。
- name_en：地點的英文名（Google 地圖上會用的名字，含分店名）
- brand：店名本體，不含分店、百貨、樓層，例如「Jellycat」「Wat Saket」
- name_zh：網站顯示用的中文名。店名本身是英文就照用英文；寺廟神壇用常見的中文名
- search_query：拿去 Google 地圖搜尋的字串，例如「Jellycat Central Chidlom」
- category：${CATEGORIES.join(' / ')}（寺廟神壇用 temple）
- description_zh：網站介紹，60～90 字，繁體中文。只用文案裡寫到的事實，語氣像站主自己寫的。不要 emoji、不要「必訪」「超人氣」「最強」這類套話、不要提 IG 或影片。泰國地名一律用英文
- description_en：description_zh 的英文版
- curator_note：站主心得，40～70 字，第一人稱，挑文案裡最具體的親身細節（點了什麼、哪個位子好、什麼時間人少、交通）。不要 emoji
- reason：一句話說明判斷理由

只回傳 JSON，不要其他文字：
{"type":"","name_en":"","name_zh":"","brand":"","search_query":"","match":null,"category":"","description_zh":"","description_en":"","curator_note":"","reason":""}`,
    }],
  })
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error('Claude 沒有回傳 JSON')
  const a = JSON.parse(json) as Analysis
  if (!CATEGORIES.includes(a.category)) a.category = 'attraction'
  if (typeof a.match !== 'number' || !locations[a.match]) a.match = null
  return a
}

type Plan =
  | { kind: 'link'; code: string; locationId: string; featuredAt: string; note: string; entry: IgLogEntry }
  | { kind: 'create'; code: string; location: Location; entry: IgLogEntry }
  | { kind: 'pending'; code: string; item: PendingLocation; entry: IgLogEntry }
  | { kind: 'log'; code: string; entry: IgLogEntry }

// 貼文日期當作推薦時間，首頁排序就跟 IG 的發文順序一樣（同一天的照處理順序）
const featuredTime = (posted?: string) => (posted ? new Date(`${posted}T12:00:00+07:00`).toISOString() : new Date().toISOString())

export async function planPost(post: ProfilePost, locations: Location[], prev?: IgLogEntry): Promise<Plan> {
  const base = { at: new Date().toISOString(), posted: post.posted, title: post.title }
  try {
    const { caption, posted } = parseCaption(await firecrawlScrape(post.url))
    if (posted) base.posted = posted
    if (caption.length < 10) throw new Error('讀不到文案')
    const a = await analyze(caption, locations)
    const featuredAt = featuredTime(base.posted)
    const skip = (note: string): Plan => ({ kind: 'log', code: post.code, entry: { ...base, status: 'skipped', name: a.name_zh || a.name_en, note } })

    if (a.type === 'multi') return skip('合輯貼文，介紹好幾個地點，沒有自動處理')
    if (a.type === 'other') return skip(`沒有具體地點：${a.reason}`)

    // 先比對網站上已有的店（Claude 比店名；再用 Google place id 補一次）
    let matched: Location | undefined = a.match !== null ? locations[a.match] : undefined
    let place: Awaited<ReturnType<typeof enrichItem>> = null
    if (!matched) {
      place = await enrichItem(a.search_query || a.name_en, a.category, undefined, undefined, { allowLandmarks: true })
      if (place?.place_id) matched = locations.find((l) => extractPlaceId(l.source_url) === place!.place_id)
    }

    if (matched) {
      if (matched.social_embed_url && igCode(matched.social_embed_url) !== post.code) {
        return { kind: 'log', code: post.code, entry: { ...base, status: 'skipped', location_id: matched.id, name: matched.name_zh, note: '這間店已經掛了另一支影片，沒有覆蓋' } }
      }
      const note = isHiddenCategory(matched.category) ? '這間店的分類目前在網站上隱藏，首頁看不到' : undefined
      return { kind: 'link', code: post.code, locationId: matched.id, featuredAt, note: a.curator_note, entry: { ...base, status: 'linked', location_id: matched.id, name: matched.name_zh, note } }
    }

    // 活動只掛到已有的地點，不為了期間限定活動新增一家店
    if (a.type === 'event') return skip(`期間限定活動，網站上沒有對應的地點（${a.name_en}）`)
    if (!place) return skip(`Google 地圖找不到「${a.search_query || a.name_en}」，請手動新增`)
    // 用店名本體比對：搜尋字串含百貨名稱，Google 常回百貨本身（例如搜 Jellycat Central Chidlom 回 Central Chidlom）
    if (!nameMatches(a.brand || a.name_en, place.name_en)) {
      return skip(`Google 找到的是「${place.name_en}」，跟文案的「${a.name_en}」對不上，請手動新增`)
    }

    const category = (place.category === 'temple' || a.category === 'temple') ? 'temple' : (CATEGORIES.includes(place.category as Category) ? place.category as Category : a.category)
    const q = encodeURIComponent(`${place.name_en} ${place.address}`)
    const now = new Date().toISOString()
    const loc: Location = {
      id: uuidv4(),
      name_en: place.name_en,
      name_zh: a.name_zh || place.name_en,
      description_zh: a.description_zh,
      description_en: a.description_en,
      category,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      photos: place.photos,
      source: 'instagram',
      source_url: `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${place.place_id}`,
      rating: place.rating,
      price_range: place.price_range,
      tag: 'hidden_gem',
      area: place.area,
      highlights: place.highlights,
      curator_note: a.curator_note,
      social_embed_url: postUrl(post.code),
      featured: true,
      featured_at: featuredAt,
      evidence: [{ url: postUrl(post.code), title: '曼谷人 IG', quote: caption.split('\n')[0].slice(0, 120) }],
    }
    // 分類被隱藏（購物、夜生活、飯店）的店上架了也看不到，放待審讓站主決定要改分類還是不收
    if (isHiddenCategory(category)) {
      return { kind: 'pending', code: post.code, item: { ...loc, scraped_at: now }, entry: { ...base, status: 'pending', location_id: loc.id, name: loc.name_zh, note: `分類是 ${category}（網站目前隱藏），放在待審` } }
    }
    return { kind: 'create', code: post.code, location: { ...loc, approved_at: now }, entry: { ...base, status: 'created', location_id: loc.id, name: loc.name_zh } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { kind: 'log', code: post.code, entry: { ...base, status: 'error', note: msg.slice(0, 200), attempts: (prev?.attempts ?? 0) + 1 } }
  }
}

export type SyncResult = { checked: number; processed: number; changed: number; deployed: boolean; results: (IgLogEntry & { code: string })[] }

export async function syncInstagram(opts: { deploy?: boolean } = {}): Promise<SyncResult> {
  const profile = parseProfile(await firecrawlScrape(INSTAGRAM_URL, { maxAge: 0 }))
  if (!profile.length) throw new Error('讀不到 IG 個人頁的貼文清單')

  const snapshot = await transact('read', async (tx) => ({ locations: await txLocations(tx), log: await tx.readJson<IgLog>(IG_LOG_FILE, {}) }))
  const linkedCodes = new Set(snapshot.locations.map((l) => igCode(l.social_embed_url)).filter(Boolean))
  const todo = profile
    .filter((p) => !linkedCodes.has(p.code))
    .filter((p) => { const e = snapshot.log[p.code]; return !e || (e.status === 'error' && (e.attempts ?? 0) < MAX_ATTEMPTS) })
    .reverse()                       // 舊的先處理，同一天發的照順序排
    .slice(0, MAX_POSTS_PER_RUN)

  if (!todo.length) return { checked: profile.length, processed: 0, changed: 0, deployed: false, results: [] }

  const visible = snapshot.locations
  const plans = await Promise.all(todo.map((p) => planPost(p, visible, snapshot.log[p.code])))

  const changed = plans.filter((p) => p.kind !== 'log').length
  await transact(`IG 同步 ${plans.map((p) => p.entry.name ?? p.code).join('、')}`, async (tx: Tx) => {
    const locations = await txLocations(tx)
    const log = await tx.readJson<IgLog>(IG_LOG_FILE, {})
    let pending: PendingLocation[] | null = null
    for (const plan of plans) {
      if (plan.kind === 'link') {
        const loc = locations.find((l) => l.id === plan.locationId)
        if (!loc) { log[plan.code] = { ...plan.entry, status: 'error', note: '存檔時找不到這間店', attempts: 1 }; continue }
        loc.social_embed_url = postUrl(plan.code)
        if (!loc.featured) { loc.featured = true; loc.featured_at = plan.featuredAt }
        // 還沒寫站主心得的店，用文案整理的心得補上（已經寫過的不動）
        if (!loc.curator_note?.trim() && plan.note) loc.curator_note = plan.note
      } else if (plan.kind === 'create') {
        let loc = plan.location
        if (isOnline) loc = await txLocalizePhotos(tx, loc)
        loc.slug = await makeSlug(loc.name_en, new Set(locations.map((l) => l.slug ?? '')))
        locations.push(loc)
      } else if (plan.kind === 'pending') {
        pending ??= await txPending(tx)
        pending.push(plan.item)
      }
      log[plan.code] = plan.entry
    }
    if (changed) txWriteLocations(tx, locations)
    if (pending) txWritePending(tx, pending)
    tx.writeText(IG_LOG_FILE, JSON.stringify(log, null, 2))
  })

  // 正式站：存檔是 "admin:" commit（不會自動部署），有改到網站內容才補一個 commit 觸發部署
  let deployed = false
  if (opts.deploy && isOnline && plans.some((p) => p.kind === 'link' || p.kind === 'create')) {
    await publish(`data: IG 同步 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
    deployed = true
  }

  return {
    checked: profile.length,
    processed: plans.length,
    changed,
    deployed,
    results: plans.map((p) => ({ code: p.code, ...p.entry })),
  }
}
