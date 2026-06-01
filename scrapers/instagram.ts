import Anthropic from '@anthropic-ai/sdk'
import { sleep, type ScrapedItem } from './shared'

// Bangkok hashtags — food, cafes, and trending spots
const HASHTAGS = [
  'ร้านอาหารกรุงเทพ',
  'คาเฟ่กรุงเทพ',
  'bangkokfood',
  'bangkokrestaurant',
  'อาหารกรุงเทพ',
  'bangkokcafe',
  'ร้านอร่อยกรุงเทพ',
  'ที่เที่ยวกรุงเทพ',
  'bangkoktrending',
  'bangkoklife',
  'บาร์กรุงเทพ',
  'กรุงเทพน่าเที่ยว',
]

// Bangkok food & lifestyle blogger accounts
const ACCOUNTS = [
  'chasing_delicious',
  'tha.nud.chim',
  'eatguide',
  'kinraideeva',
  'dinewithpigs',
  'ginyuudai',
  'dekchaipeemmaiginpak',
  'delicioushours',
  'em.foodie.bkk',
]

type VenueEntry = { name: string; category: string }

let _client: Anthropic | null = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

async function extractVenues(captions: string[]): Promise<VenueEntry[]> {
  if (!process.env.ANTHROPIC_API_KEY || captions.length === 0) return []
  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Extract Bangkok venue names from these Instagram captions. Include restaurants, cafes, bars, trending spots, markets, rooftop bars, dessert shops, photo spots, and any place worth visiting.

Return ONLY a JSON array of objects: [{"name": "...", "category": "..."}]
Category must be one of: food, cafe, nightlife, shopping, attraction
Rules:
- Include real venue names only (no generic hashtags, no person names)
- Include both Thai and English names as written
- Maximum 20 unique venues total
- Return [] if no venues found

Captions:
${captions.join('\n---\n').slice(0, 6000)}`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    const VALID_CATS = new Set(['food', 'cafe', 'nightlife', 'shopping', 'attraction'])
    return (parsed as unknown[]).filter((v): v is VenueEntry =>
      typeof v === 'object' && v !== null &&
      typeof (v as VenueEntry).name === 'string' && (v as VenueEntry).name.length > 1 &&
      VALID_CATS.has((v as VenueEntry).category)
    )
  } catch {
    return []
  }
}

async function collectPostCaptions(
  page: import('playwright').Page,
  url: string,
  limit: number
): Promise<string[]> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
  await sleep(2000)
  await page.evaluate(() => window.scrollBy(0, 1200))
  await sleep(1500)

  const postLinks = await page.$$eval('a[href*="/p/"]', (els) =>
    Array.from(new Set(els.map(el => el.getAttribute('href') ?? ''))).filter(h => h.startsWith('/p/')).slice(0, 25)
  )

  const captions: string[] = []
  const seen = new Set<string>()

  for (const href of postLinks.slice(0, limit)) {
    if (seen.has(href)) continue
    seen.add(href)
    try {
      await page.goto(`https://www.instagram.com${href}`, { waitUntil: 'networkidle', timeout: 15000 })
      await sleep(1200)
      const caption = await page.$eval(
        'h1, [data-testid="post-comment-root"] span, article span',
        el => el.textContent ?? ''
      ).catch(() => '')
      if (caption.length > 20) captions.push(caption.slice(0, 1000))
    } catch {
      // skip individual post errors
    }
  }
  return captions
}

export async function scrapeInstagram(): Promise<ScrapedItem[]> {
  const username = process.env.IG_USERNAME
  const password = process.env.IG_PASSWORD
  if (!username || !password) {
    console.warn('[Instagram] IG_USERNAME or IG_PASSWORD not set — skipping')
    return []
  }

  let browser: import('playwright').Browser | null = null
  const results: ScrapedItem[] = []

  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    // Login
    console.log('[Instagram] Logging in...')
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' })
    await sleep(2000)

    const cookieBtn = page.getByRole('button', { name: /allow|accept/i })
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click()
      await sleep(1000)
    }

    await page.fill('input[name="username"]', username)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {})
    await sleep(3000)

    for (const label of ['Not now', 'Not Now', 'ไว้ทีหลัง', 'ข้ามไปก่อน']) {
      const btn = page.getByRole('button', { name: label })
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click()
        await sleep(1000)
        break
      }
    }

    console.log('[Instagram] Logged in, scraping hashtags...')

    for (const hashtag of HASHTAGS) {
      try {
        const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`
        const captions = await collectPostCaptions(page, url, 20)
        console.log(`[Instagram] #${hashtag} → ${captions.length} captions`)

        if (captions.length > 0) {
          const venues = await extractVenues(captions)
          console.log(`[Instagram] #${hashtag} → Claude found: ${venues.map(v => v.name).join(', ')}`)
          for (const v of venues) {
            results.push({
              name_en: v.name,
              name_zh: v.name,
              description_en: `Bangkok trending — #${hashtag}`.slice(0, 120),
              description_zh: `IG 曼谷熱點 #${hashtag}`,
              address: 'Bangkok, Thailand',
              lat: 13.7563,
              lng: 100.5018,
              photos: [],
              source_url: url,
              rating: 4.2,
              price_range: 2,
              trending: true,
              category: v.category as ScrapedItem['category'],
            })
          }
        }
        await sleep(2500)
      } catch (err) {
        console.error(`[Instagram] Failed for #${hashtag}:`, err)
      }
    }

    console.log('[Instagram] Scraping blogger accounts...')

    for (const account of ACCOUNTS) {
      try {
        const url = `https://www.instagram.com/${account}/`
        const captions = await collectPostCaptions(page, url, 20)
        console.log(`[Instagram] @${account} → ${captions.length} captions`)

        if (captions.length > 0) {
          const venues = await extractVenues(captions)
          console.log(`[Instagram] @${account} → Claude found: ${venues.map(v => v.name).join(', ')}`)
          for (const v of venues) {
            results.push({
              name_en: v.name,
              name_zh: v.name,
              description_en: `Spotted by Bangkok blogger @${account}`.slice(0, 120),
              description_zh: `曼谷達人 @${account} 推薦`,
              address: 'Bangkok, Thailand',
              lat: 13.7563,
              lng: 100.5018,
              photos: [],
              source_url: url,
              rating: 4.3,
              price_range: 2,
              trending: true,
              category: v.category as ScrapedItem['category'],
            })
          }
        }
        await sleep(2500)
      } catch (err) {
        console.error(`[Instagram] Failed for @${account}:`, err)
      }
    }
  } catch (err) {
    console.error('[Instagram] Fatal error:', err)
  } finally {
    await browser?.close()
  }

  console.log(`[Instagram] Total raw candidates: ${results.length}`)
  return results
}
