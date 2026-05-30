export type ScrapedItem = {
  name_en: string
  name_zh: string
  description_en: string
  description_zh: string
  address: string
  lat: number
  lng: number
  photos: string[]
  source_url: string
  rating: number
  price_range: 1 | 2 | 3 | 4
  trending: boolean
}

export async function firecrawlScrape(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not set')

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  })

  if (!res.ok) throw new Error(`Firecrawl error: ${res.status}`)
  const data = await res.json()
  return data.data?.markdown ?? ''
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Basic name cleaning: strip Thai characters and trim
export function cleanName(raw: string): string {
  return raw.replace(/[฀-๿]/g, '').replace(/\s+/g, ' ').trim()
}
