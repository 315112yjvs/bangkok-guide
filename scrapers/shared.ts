import type { Category } from '@/lib/types'

export type ScrapedItem = {
  name_en: string
  name_zh: string
  description_en: string
  description_zh: string
  category?: Category
  address: string
  lat: number
  lng: number
  photos: string[]
  source_url: string
  rating: number
  price_range: 1 | 2 | 3 | 4
  trending: boolean
  highlights?: string[]
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

export type SearchResult = { url: string; title: string; description: string; markdown?: string }

export async function firecrawlSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not set')

  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit }),
  })

  if (!res.ok) throw new Error(`Firecrawl search error: ${res.status}`)
  const data = await res.json()
  return (data.data ?? []) as SearchResult[]
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Basic name cleaning: strip Thai characters and trim
export function cleanName(raw: string): string {
  return raw.replace(/[฀-๿]/g, '').replace(/\s+/g, ' ').trim()
}
