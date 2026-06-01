import Anthropic from '@anthropic-ai/sdk'
import { sleep, type ScrapedItem } from './shared'

// Thai food hashtags — surfaces local Bangkok venues not found via English search
const HASHTAGS = [
  'ร้านอาหารกรุงเทพ',
  'คาเฟ่กรุงเทพ',
  'bangkokfood',
  'bangkokrestaurant',
  'อาหารกรุงเทพ',
  'bangkokcafe',
  'ร้านอร่อยกรุงเทพ',
]

// Bangkok food blogger accounts to scrape
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

let _client: Anthropic | null = null
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

async function extractVenueNames(captions: string[]): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY || captions.length === 0) return []
  try {
    const msg = await client().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Extract Bangkok restaurant, cafe, and bar names from these Instagram captions.

Return ONLY a JSON array of venue name strings. Rules:
- Only real venue names (restaurants, cafes, bars, food courts)
- Include both Thai and English names as written
- Skip generic hashtags like #bangkokfood
- Skip person names, brand names that are not venues
- Maximum 15 unique names total
- Return [] if no venues found

Captions:
${captions.join('\n---\n').slice(0, 5000)}`,
      }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed: unknown = JSON.parse(match[0])
    return Array.isArray(parsed) ? (parsed as unknown[]).filter((n): n is string => typeof n === 'string' && n.length > 1) : []
  } catch {
    return []
  }
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

    // Dismiss cookie dialog if present
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

    // Dismiss "Save login info" / "Turn on notifications" dialogs
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
        await page.goto(`https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`, { waitUntil: 'networkidle', timeout: 20000 })
        await sleep(2000)

        // Scroll to load more posts
        await page.evaluate(() => window.scrollBy(0, 800))
        await sleep(1500)

        // Collect post links from the grid
        const postLinks = await page.$$eval('a[href*="/p/"]', (els) =>
          Array.from(new Set(els.map(el => el.getAttribute('href') ?? ''))).filter(h => h.startsWith('/p/')).slice(0, 12)
        )
        console.log(`[Instagram] #${hashtag} → ${postLinks.length} posts`)

        const captions: string[] = []
        const seenUrls = new Set<string>()

        for (const href of postLinks) {
          if (seenUrls.has(href)) continue
          seenUrls.add(href)
          try {
            await page.goto(`https://www.instagram.com${href}`, { waitUntil: 'networkidle', timeout: 15000 })
            await sleep(1500)

            // Get caption text
            const caption = await page.$eval(
              'h1, [data-testid="post-comment-root"] span, article span',
              el => el.textContent ?? ''
            ).catch(() => '')

            if (caption.length > 20) captions.push(caption.slice(0, 800))
          } catch {
            // skip individual post errors
          }
        }

        if (captions.length > 0) {
          const names = await extractVenueNames(captions)
          console.log(`[Instagram] #${hashtag} → Claude found: ${names.join(', ')}`)
          for (const name of names) {
            results.push({
              name_en: name,
              name_zh: name,
              description_en: `Instagram Bangkok — #${hashtag}`.slice(0, 120),
              description_zh: `IG 曼谷打卡熱點 #${hashtag}`,
              address: 'Bangkok, Thailand',
              lat: 13.7563,
              lng: 100.5018,
              photos: [],
              source_url: `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`,
              rating: 4.2,
              price_range: 2,
              trending: true,
            })
          }
        }

        await sleep(3000)
      } catch (err) {
        console.error(`[Instagram] Failed for #${hashtag}:`, err)
      }
    }

    // Scrape food blogger accounts
    console.log('[Instagram] Scraping food blogger accounts...')
    for (const account of ACCOUNTS) {
      try {
        await page.goto(`https://www.instagram.com/${account}/`, { waitUntil: 'networkidle', timeout: 20000 })
        await sleep(2000)

        await page.evaluate(() => window.scrollBy(0, 800))
        await sleep(1500)

        const postLinks = await page.$$eval('a[href*="/p/"]', (els) =>
          Array.from(new Set(els.map(el => el.getAttribute('href') ?? ''))).filter(h => h.startsWith('/p/')).slice(0, 15)
        )
        console.log(`[Instagram] @${account} → ${postLinks.length} posts`)

        const captions: string[] = []
        const seenUrls = new Set<string>()

        for (const href of postLinks) {
          if (seenUrls.has(href)) continue
          seenUrls.add(href)
          try {
            await page.goto(`https://www.instagram.com${href}`, { waitUntil: 'networkidle', timeout: 15000 })
            await sleep(1500)

            const caption = await page.$eval(
              'h1, [data-testid="post-comment-root"] span, article span',
              el => el.textContent ?? ''
            ).catch(() => '')

            if (caption.length > 20) captions.push(caption.slice(0, 800))
          } catch {
            // skip individual post errors
          }
        }

        if (captions.length > 0) {
          const names = await extractVenueNames(captions)
          console.log(`[Instagram] @${account} → Claude found: ${names.join(', ')}`)
          for (const name of names) {
            results.push({
              name_en: name,
              name_zh: name,
              description_en: `Recommended by Bangkok food blogger @${account}`.slice(0, 120),
              description_zh: `曼谷美食部落客 @${account} 推薦`,
              address: 'Bangkok, Thailand',
              lat: 13.7563,
              lng: 100.5018,
              photos: [],
              source_url: `https://www.instagram.com/${account}/`,
              rating: 4.3,
              price_range: 2,
              trending: true,
            })
          }
        }

        await sleep(3000)
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
