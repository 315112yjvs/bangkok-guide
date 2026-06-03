import { firecrawlSearch, sleep, type ScrapedItem } from './shared'

// site:tiktok.com searches return real TikTok video titles + descriptions
// Individual video pages and hashtag pages are JS-blocked, so search is our only viable path
const QUERIES = [
  'site:tiktok.com ร้านอาหารเด็ด กรุงเทพ 2024 ต้องลอง',
  'site:tiktok.com ร้านอาหาร กรุงเทพ แนะนำ อร่อย',
  'site:tiktok.com คาเฟ่ กรุงเทพ น่าไป ถ่ายรูป 2024',
  'site:tiktok.com Bangkok restaurant must try hidden gem 2024',
  'site:tiktok.com Bangkok best food viral trending 2024',
  'site:tiktok.com ร้านอาหาร สุขุมวิท ทองหล่อ เอกมัย',
  'site:tiktok.com Bangkok bar cocktail rooftop nightlife 2024',
  'site:tiktok.com Bangkok brunch cafe aesthetic 2024',
  'site:tiktok.com ร้านอาหาร ย่านเยาวราช ไชน่าทาวน์ กรุงเทพ',
  'site:tiktok.com Bangkok Michelin restaurant Thai food 2024',
]

const EN_PLACE_PATTERN = /(?:^|\n)[\s*\d.-]*([A-Z][A-Za-z\s&''.()\-]{3,50})(?:\s*[-–—]|\s*:|\s*–|\n|,)/gm
// Extract place names from TikTok hashtags: #Rongros #BaanYing → ["Rongros", "BaanYing"]
const HASHTAG_PATTERN = /#([A-Z][A-Za-z\s]{2,30})(?=\s|#|$)/g

// Bangkok districts, landmarks, and generic terms that are not venues
const SKIP_NAMES = new Set([
  'sathon', 'sathorn', 'silom', 'sukhumvit', 'ekkamai', 'thonglor', 'thong lor',
  'asok', 'asoke', 'ari', 'chatuchak', 'yaowarat', 'chinatown', 'china town',
  'siam', 'ratchada', 'riverside', 'pratunam', 'bang na', 'on nut',
  'phrom phong', 'nana', 'victory monument', 'khaosan', 'khao san',
  'grand palace', 'the grand palace', 'wat pho', 'wat arun', 'wat traimit',
  'jim thompson', 'lumphini park', 'erawan shrine', 'terminal 21',
  'central world', 'centralworld', 'siam paragon', 'mbk', 'iconsiam',
  'bangkok', 'thailand', 'thai',
])

function extractNames(title: string, description: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  const SKIP_TITLE = /^(The Best|Best |Top |Most |More |What |When |Where |How |Why |Tips |Read |Check |See |Visit |Open |Book |Get |Make |Try |Also |Note |Find |Here |This |That |These |TikTok|Bangkok|Follow|Share|Like|Comment|Video|Watch|Discover|Explore|Keywords)/i
  const SKIP_TAG = /^(Bangkok|Thailand|Thai|Food|Best|Top|Must|Try|Viral|Trending|Restaurant|Cafe|Bar|Hotel|Travel|Visit|Trip|Tour|Guide|Review|Fyp|Foryou|Tiktok|Lifestyle|Vlog|Foodie|Eatery|Dining|Brunch|Lunch|Dinner|Michelin|Star|Hidden|Gem)/i

  // From title: extract proper-noun place names
  let match: RegExpExecArray | null
  EN_PLACE_PATTERN.lastIndex = 0
  while ((match = EN_PLACE_PATTERN.exec(title)) !== null) {
    const name = match[1].trim().replace(/\s+/g, ' ')
    if (name.length < 4 || name.length > 50) continue
    if (SKIP_TITLE.test(name)) continue
    if (SKIP_NAMES.has(name.toLowerCase())) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    names.push(name)
  }

  // From description hashtags: #Rongros, #BaanYing, etc.
  HASHTAG_PATTERN.lastIndex = 0
  while ((match = HASHTAG_PATTERN.exec(description)) !== null) {
    const name = match[1].trim()
    if (name.length < 3) continue
    if (SKIP_TAG.test(name)) continue
    if (SKIP_NAMES.has(name.toLowerCase())) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    names.push(name)
    if (names.length >= 8) break
  }

  return names
}

export async function scrapeTikTok(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []

  for (const query of QUERIES) {
    try {
      const searchResults = await firecrawlSearch(query, 5)
      for (const result of searchResults) {
        if (!result.url.includes('tiktok.com')) continue
        const title = result.title ?? ''
        const desc = result.description ?? ''
        const names = extractNames(title, desc)
        console.log(`[TikTok] "${title.slice(0, 60)}" → ${names.join(', ')}`)
        for (const name of names) {
          results.push({
            name_en: name,
            name_zh: name,
            description_en: `TikTok viral Bangkok — ${title}`.slice(0, 120),
            description_zh: `TikTok 熱傳曼谷打卡點`,
            address: 'Bangkok, Thailand',
            lat: 13.7563,
            lng: 100.5018,
            photos: [],
            source_url: result.url,
            rating: 4.2,
            price_range: 2,
            tag: 'trending',
          })
        }
      }
      await sleep(1000)
    } catch (err) {
      console.error('[TikTok] search failed:', query, err)
    }
  }

  console.log(`[TikTok] Total raw candidates: ${results.length}`)
  return results
}
