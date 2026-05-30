# Bangkok Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (Chinese/English) Bangkok travel guide website with auto-scraping from Thai social platforms, an admin review panel, and embedded Google Maps.

**Architecture:** Next.js 14 App Router serves the public site (`/`) from `data/locations.json`. The admin panel (`/admin`) runs locally only via `npm run dev`, reads/writes JSON files through API routes using Node.js `fs`, then the user pushes to GitHub to trigger Vercel redeploy of the public site.

**Tech Stack:** Next.js 14, Tailwind CSS, `@vis.gl/react-google-maps`, TypeScript, Google Maps JavaScript API + Places API, Firecrawl REST API (for scrapers), `uuid`

---

## File Map

```
bangkok-guide/
├── app/
│   ├── layout.tsx                    # Root layout with Tailwind, metadata
│   ├── page.tsx                      # Public homepage (assembled from components)
│   ├── globals.css                   # Tailwind directives
│   ├── admin/
│   │   └── page.tsx                  # Admin panel (auth + tabs)
│   └── api/
│       ├── admin/auth/route.ts       # POST — check password against env
│       ├── locations/route.ts        # GET all, POST approve (pending→approved), DELETE
│       ├── pending/route.ts          # GET all, DELETE reject
│       └── scraper/route.ts          # POST — run all scrapers, append to pending.json
├── components/
│   ├── icons/CategoryIcons.tsx       # SVG icons for each category (no emoji)
│   ├── LanguageToggle.tsx            # 中文/EN button pair
│   ├── CategoryTabs.tsx              # Filter tabs using CategoryIcons
│   ├── LocationCard.tsx              # Card with photo, badge, rating, nav button
│   └── LocationMap.tsx               # @vis.gl/react-google-maps with custom pins
├── data/
│   ├── locations.json                # Approved locations array (committed to git)
│   └── pending.json                  # Pending review array (committed to git)
├── hooks/
│   └── useLanguage.ts                # localStorage lang state ('zh'|'en')
├── lib/
│   ├── types.ts                      # Location type + PendingLocation type
│   ├── data.ts                       # readLocations, writeLocations, readPending, writePending
│   ├── dedup.ts                      # isDuplicate(candidate, existing[]) — fuzzy name match
│   └── i18n.ts                       # All UI strings in zh + en
├── scrapers/
│   ├── shared.ts                     # firecrawlScrape(), extractWithAI(), ScrapedItem type
│   ├── pantip.ts                     # scrapePantip() → ScrapedItem[]
│   ├── wongnai.ts                    # scrapeWongnai() → ScrapedItem[]
│   ├── googlemaps.ts                 # scrapeGoogleMaps() → ScrapedItem[]
│   ├── tiktok.ts                     # scrapeTikTok() → ScrapedItem[]
│   ├── instagram.ts                  # scrapeInstagram() → ScrapedItem[]
│   └── index.ts                      # runAllScrapers() — runs all, deduplicates, appends to pending.json
├── __tests__/
│   ├── dedup.test.ts
│   └── data.test.ts
├── .env.local.example
├── .gitignore
└── next.config.ts
```

---

## Task 1: Scaffold the Next.js Project

**Files:**
- Create: `bangkok-guide/` (entire scaffold)
- Create: `bangkok-guide/.env.local.example`
- Create: `bangkok-guide/.gitignore`
- Create: `bangkok-guide/data/locations.json`
- Create: `bangkok-guide/data/pending.json`

- [ ] **Step 1: Create Next.js app**

```bash
cd /Users/jerryzhang/Downloads/jerry_claude
npx create-next-app@14 bangkok-guide \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
cd bangkok-guide
```

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @vis.gl/react-google-maps uuid
npm install --save-dev @types/uuid jest @types/jest ts-jest
```

- [ ] **Step 3: Configure Jest**

Create `bangkok-guide/jest.config.ts`:

```ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default config
```

Add to `package.json` scripts:
```json
"test": "jest"
```

- [ ] **Step 4: Create empty data files**

Create `bangkok-guide/data/locations.json`:
```json
[]
```

Create `bangkok-guide/data/pending.json`:
```json
[]
```

- [ ] **Step 5: Create .env.local.example**

```
ADMIN_PASSWORD=your_password_here
GOOGLE_MAPS_API_KEY=your_server_key_here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_key_here
FIRECRAWL_API_KEY=your_firecrawl_key_here
```

- [ ] **Step 6: Update .gitignore**

Append to `bangkok-guide/.gitignore`:
```
.env.local
.superpowers/
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts at http://localhost:3000, default Next.js page loads.

- [ ] **Step 8: Commit**

```bash
git add bangkok-guide/
git commit -m "feat: scaffold Next.js project for Bangkok guide"
```

---

## Task 2: Types, Data Helpers, and Deduplication

**Files:**
- Create: `bangkok-guide/lib/types.ts`
- Create: `bangkok-guide/lib/data.ts`
- Create: `bangkok-guide/lib/dedup.ts`
- Create: `bangkok-guide/__tests__/dedup.test.ts`
- Create: `bangkok-guide/__tests__/data.test.ts`

- [ ] **Step 1: Write failing tests for dedup**

Create `bangkok-guide/__tests__/dedup.test.ts`:

```ts
import { isDuplicate } from '@/lib/dedup'
import type { Location } from '@/lib/types'

const base: Location = {
  id: '1',
  name_zh: 'Jay Fai',
  name_en: 'Jay Fai',
  description_zh: '',
  description_en: '',
  category: 'food',
  address: '327 Maha Chai Rd',
  lat: 13.752,
  lng: 100.499,
  photos: [],
  source: 'manual',
  source_url: '',
  rating: 4.9,
  price_range: 3,
  trending: false,
}

describe('isDuplicate', () => {
  it('returns true for exact name match', () => {
    expect(isDuplicate({ name_en: 'Jay Fai' }, [base])).toBe(true)
  })

  it('returns true for case-insensitive match', () => {
    expect(isDuplicate({ name_en: 'jay fai' }, [base])).toBe(true)
  })

  it('returns true for partial match (>= 80% similarity)', () => {
    expect(isDuplicate({ name_en: 'Jay Fai Restaurant' }, [base])).toBe(true)
  })

  it('returns false for unrelated name', () => {
    expect(isDuplicate({ name_en: 'Chatuchak Market' }, [base])).toBe(false)
  })

  it('returns false for empty existing array', () => {
    expect(isDuplicate({ name_en: 'Jay Fai' }, [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bangkok-guide && npx jest __tests__/dedup.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/dedup'"

- [ ] **Step 3: Define the Location type**

Create `bangkok-guide/lib/types.ts`:

```ts
export type Category = 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel'
export type Source = 'pantip' | 'wongnai' | 'googlemaps' | 'tiktok' | 'instagram' | 'manual'

export type Location = {
  id: string
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  category: Category
  address: string
  lat: number
  lng: number
  photos: string[]
  source: Source
  source_url: string
  rating: number
  price_range: 1 | 2 | 3 | 4
  trending: boolean
  approved_at?: string
}

export type PendingLocation = Location & {
  scraped_at: string
}
```

- [ ] **Step 4: Implement dedup**

Create `bangkok-guide/lib/dedup.ts`:

```ts
import type { Location } from './types'

function similarity(a: string, b: string): number {
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++
  }
  return matches / longer.length
}

export function isDuplicate(
  candidate: { name_en: string },
  existing: Pick<Location, 'name_en'>[]
): boolean {
  return existing.some((loc) => similarity(candidate.name_en, loc.name_en) >= 0.8)
}
```

- [ ] **Step 5: Run dedup tests**

```bash
npx jest __tests__/dedup.test.ts
```

Expected: 5/5 PASS

- [ ] **Step 6: Write failing data helper tests**

Create `bangkok-guide/__tests__/data.test.ts`:

```ts
import { readLocations, writeLocations, readPending, writePending } from '@/lib/data'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

const locPath = join(process.cwd(), 'data', 'locations.json')
const pendPath = join(process.cwd(), 'data', 'pending.json')

const mockLocation = {
  id: 'test-1',
  name_zh: '測試',
  name_en: 'Test',
  description_zh: '',
  description_en: '',
  category: 'food' as const,
  address: 'Bangkok',
  lat: 13.7,
  lng: 100.5,
  photos: [],
  source: 'manual' as const,
  source_url: '',
  rating: 4,
  price_range: 2 as const,
  trending: false,
}

beforeEach(() => {
  writeFileSync(locPath, '[]')
  writeFileSync(pendPath, '[]')
})

describe('readLocations', () => {
  it('returns empty array from empty file', () => {
    expect(readLocations()).toEqual([])
  })
})

describe('writeLocations + readLocations', () => {
  it('round-trips a location', () => {
    writeLocations([mockLocation])
    expect(readLocations()).toEqual([mockLocation])
  })
})

describe('readPending + writePending', () => {
  it('round-trips a pending location', () => {
    const pending = { ...mockLocation, scraped_at: '2026-05-30' }
    writePending([pending])
    expect(readPending()).toEqual([pending])
  })
})
```

- [ ] **Step 7: Run data tests to verify they fail**

```bash
npx jest __tests__/data.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/data'"

- [ ] **Step 8: Implement data helpers**

Create `bangkok-guide/lib/data.ts`:

```ts
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Location, PendingLocation } from './types'

const locPath = join(process.cwd(), 'data', 'locations.json')
const pendPath = join(process.cwd(), 'data', 'pending.json')

export function readLocations(): Location[] {
  return JSON.parse(readFileSync(locPath, 'utf-8'))
}

export function writeLocations(locations: Location[]): void {
  writeFileSync(locPath, JSON.stringify(locations, null, 2))
}

export function readPending(): PendingLocation[] {
  return JSON.parse(readFileSync(pendPath, 'utf-8'))
}

export function writePending(pending: PendingLocation[]): void {
  writeFileSync(pendPath, JSON.stringify(pending, null, 2))
}
```

- [ ] **Step 9: Run all tests**

```bash
npx jest
```

Expected: 8/8 PASS

- [ ] **Step 10: Commit**

```bash
git add lib/ __tests__/ jest.config.ts
git commit -m "feat: add types, data helpers, and dedup utility with tests"
```

---

## Task 3: i18n and Language Hook

**Files:**
- Create: `bangkok-guide/lib/i18n.ts`
- Create: `bangkok-guide/hooks/useLanguage.ts`

- [ ] **Step 1: Create i18n strings**

Create `bangkok-guide/lib/i18n.ts`:

```ts
export type Lang = 'zh' | 'en'

export const strings = {
  zh: {
    siteName: '曼谷旅遊指南',
    heroTitle: '探索曼谷',
    heroTitleAccent: '最值得去的地方',
    heroSubtitle: '精選在地美食、咖啡廳、購物、夜生活、飯店',
    searchPlaceholder: '搜尋餐廳、咖啡廳...',
    categoryAll: '全部',
    categoryFood: '美食',
    categoryCafe: '咖啡廳',
    categoryShopping: '購物',
    categoryNightlife: '夜生活',
    categoryHotel: '飯店',
    trending: '熱門',
    seeAll: '查看全部',
    trendingSection: '近期熱門',
    openMaps: '在 Google Maps 開啟',
    navigate: '導航',
    sourceTikTok: 'TikTok 熱傳',
    sourceIG: 'IG 爆紅',
    sourcePantip: 'Pantip 推薦',
    sourceWongnai: 'Wongnai 精選',
    sourceGoogleMaps: 'Google Maps',
    sourceManual: '編輯精選',
    expandMap: '展開地圖',
    priceRange: ['', '$', '$$', '$$$', '$$$$'],
  },
  en: {
    siteName: 'Bangkok Guide',
    heroTitle: 'Discover',
    heroTitleAccent: 'The Best of Bangkok',
    heroSubtitle: 'Curated food, cafes, shopping, nightlife & hotels',
    searchPlaceholder: 'Search restaurants, cafes...',
    categoryAll: 'All',
    categoryFood: 'Food',
    categoryCafe: 'Cafe',
    categoryShopping: 'Shopping',
    categoryNightlife: 'Nightlife',
    categoryHotel: 'Hotels',
    trending: 'Trending',
    seeAll: 'See all',
    trendingSection: 'Trending Now',
    openMaps: 'Open in Google Maps',
    navigate: 'Navigate',
    sourceTikTok: 'TikTok Viral',
    sourceIG: 'IG Trending',
    sourcePantip: 'Pantip Pick',
    sourceWongnai: 'Wongnai Top',
    sourceGoogleMaps: 'Google Maps',
    sourceManual: 'Editor\'s Pick',
    expandMap: 'Expand Map',
    priceRange: ['', '$', '$$', '$$$', '$$$$'],
  },
} satisfies Record<Lang, Record<string, string | string[]>>

export function t(lang: Lang, key: keyof typeof strings.zh): string {
  const val = strings[lang][key]
  return Array.isArray(val) ? val.join('') : val
}
```

- [ ] **Step 2: Create language hook**

Create `bangkok-guide/hooks/useLanguage.ts`:

```ts
'use client'
import { useState, useEffect } from 'react'
import type { Lang } from '@/lib/i18n'

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'zh' || stored === 'en') setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  return { lang, setLang }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/i18n.ts hooks/
git commit -m "feat: add i18n strings and useLanguage hook"
```

---

## Task 4: SVG Icons and UI Components

**Files:**
- Create: `bangkok-guide/components/icons/CategoryIcons.tsx`
- Create: `bangkok-guide/components/LanguageToggle.tsx`
- Create: `bangkok-guide/components/CategoryTabs.tsx`

- [ ] **Step 1: Create SVG category icon components**

Create `bangkok-guide/components/icons/CategoryIcons.tsx`:

```tsx
type IconProps = { size?: number; className?: string }

export function IconAll({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
    </svg>
  )
}

export function IconFood({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 14 Q5 20 12 20 Q19 20 19 14" fill="currentColor" opacity="0.9"/>
      <ellipse cx="12" cy="14" rx="7" ry="3" fill="currentColor"/>
      <ellipse cx="12" cy="14" rx="7" ry="3" fill="white" opacity="0.15"/>
      <path d="M9 14 Q11 12 12 14 Q13 16 15 14" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <line x1="9.5" y1="5" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="13" y1="4" x2="11.5" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCafe({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 12 L7.5 20 Q8 21 12 21 Q16 21 16.5 20 L18 12 Z" fill="currentColor" opacity="0.9"/>
      <ellipse cx="12" cy="21" rx="5" ry="1.2" fill="currentColor" opacity="0.5"/>
      <path d="M18 13.5 Q22 13.5 22 17 Q22 20 18 20" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M10.5 9 Q10.5 7 12 7.5 Q12.5 6 13.5 6.5 Q15 6 14.5 8 Q13.5 10 12.5 10Z" fill="currentColor" opacity="0.7"/>
    </svg>
  )
}

export function IconShopping({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" opacity="0.9"/>
      <path d="M9 11 Q9 7 12 7 Q15 7 15 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="12" cy="16.5" r="1.8" fill="white" opacity="0.5"/>
    </svg>
  )
}

export function IconNightlife({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 4 L19 4 L12 14 Z" fill="currentColor" opacity="0.9"/>
      <line x1="12" y1="14" x2="12" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8.5" y1="20" x2="15.5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="17" cy="7.5" r="2.2" fill="#f43f5e"/>
      <line x1="17" y1="9.5" x2="15" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconHotel({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="9" width="16" height="13" rx="1.5" fill="currentColor" opacity="0.9"/>
      <path d="M3 10 L12 3 L21 10" fill="currentColor" opacity="0.7"/>
      <rect x="7" y="13" width="3" height="3" rx="0.8" fill="white" opacity="0.5"/>
      <rect x="14" y="13" width="3" height="3" rx="0.8" fill="white" opacity="0.5"/>
      <rect x="10" y="17" width="4" height="5" rx="0.8" fill="white" opacity="0.4"/>
      <path d="M12 1 L12.5 3 L14 3 L13 4 L13.5 6 L12 5 L10.5 6 L11 4 L10 3 L11.5 3 Z" fill="#fbbf24"/>
    </svg>
  )
}

export function IconPin({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}
```

- [ ] **Step 2: Create LanguageToggle**

Create `bangkok-guide/components/LanguageToggle.tsx`:

```tsx
'use client'
import type { Lang } from '@/lib/i18n'

type Props = { lang: Lang; setLang: (l: Lang) => void }

export function LanguageToggle({ lang, setLang }: Props) {
  return (
    <div className="inline-flex bg-white/15 rounded-full p-0.5 text-xs">
      {(['zh', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-full transition-all ${
            lang === l
              ? 'bg-white text-[#1a1a2e] font-bold'
              : 'text-white/70 hover:text-white'
          }`}
        >
          {l === 'zh' ? '中文' : 'EN'}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create CategoryTabs**

Create `bangkok-guide/components/CategoryTabs.tsx`:

```tsx
'use client'
import { IconAll, IconFood, IconCafe, IconShopping, IconNightlife, IconHotel } from './icons/CategoryIcons'
import type { Category } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

type Tab = { id: Category | 'all'; labelKey: keyof typeof strings.zh; Icon: React.ComponentType<{ size?: number }> }

const TABS: Tab[] = [
  { id: 'all',       labelKey: 'categoryAll',       Icon: IconAll },
  { id: 'food',      labelKey: 'categoryFood',      Icon: IconFood },
  { id: 'cafe',      labelKey: 'categoryCafe',      Icon: IconCafe },
  { id: 'shopping',  labelKey: 'categoryShopping',  Icon: IconShopping },
  { id: 'nightlife', labelKey: 'categoryNightlife', Icon: IconNightlife },
  { id: 'hotel',     labelKey: 'categoryHotel',     Icon: IconHotel },
]

const TAB_COLORS: Record<string, string> = {
  all:       'bg-[#1e1b4b]',
  food:      'bg-gradient-to-br from-red-600 to-orange-500',
  cafe:      'bg-gradient-to-br from-amber-900 to-amber-600',
  shopping:  'bg-gradient-to-br from-emerald-800 to-emerald-500',
  nightlife: 'bg-gradient-to-br from-indigo-900 to-violet-700',
  hotel:     'bg-gradient-to-br from-sky-700 to-sky-400',
}

type Props = {
  active: Category | 'all'
  onChange: (cat: Category | 'all') => void
  lang: Lang
}

export function CategoryTabs({ active, onChange, lang }: Props) {
  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto bg-white border-b border-gray-100 no-scrollbar">
      {TABS.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="flex flex-col items-center gap-1.5 min-w-[52px] group"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-transform group-hover:scale-105 ${
            active === id ? TAB_COLORS[id] + ' scale-105 ring-2 ring-offset-1 ring-current' : TAB_COLORS[id] + ' opacity-70'
          }`}>
            <Icon size={22} />
          </div>
          <span className={`text-[10px] font-semibold ${active === id ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>
            {strings[lang][labelKey] as string}
          </span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/
git commit -m "feat: add SVG category icons, LanguageToggle, CategoryTabs components"
```

---

## Task 5: LocationCard Component

**Files:**
- Create: `bangkok-guide/components/LocationCard.tsx`

- [ ] **Step 1: Create LocationCard**

Create `bangkok-guide/components/LocationCard.tsx`:

```tsx
import Image from 'next/image'
import { IconPin } from './icons/CategoryIcons'
import type { Location, Source } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

const SOURCE_BADGE: Record<Source, { label: keyof typeof strings.zh; style: string }> = {
  tiktok:     { label: 'sourceTikTok',    style: 'bg-green-50 text-green-700 border border-green-200' },
  instagram:  { label: 'sourceIG',        style: 'bg-purple-50 text-purple-700 border border-purple-200' },
  pantip:     { label: 'sourcePantip',    style: 'bg-orange-50 text-orange-700 border border-orange-200' },
  wongnai:    { label: 'sourceWongnai',   style: 'bg-red-50 text-red-700 border border-red-200' },
  googlemaps: { label: 'sourceGoogleMaps',style: 'bg-blue-50 text-blue-700 border border-blue-200' },
  manual:     { label: 'sourceManual',    style: 'bg-gray-50 text-gray-600 border border-gray-200' },
}

type Props = { location: Location; lang: Lang }

export function LocationCard({ location, lang }: Props) {
  const badge = SOURCE_BADGE[location.source]
  const name = lang === 'zh' ? location.name_zh : location.name_en
  const desc = lang === 'zh' ? location.description_zh : location.description_en

  const mapsUrl = location.lat && location.lng
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name_en + ' Bangkok')}`

  const photo = location.photos[0] ?? 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=300&fit=crop'

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative h-24 w-full">
        <Image src={photo} alt={name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
      </div>
      <div className="p-2.5">
        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-lg mb-1 ${badge.style}`}>
          {strings[lang][badge.label] as string}
        </span>
        <h3 className="text-[13px] font-bold text-[#1a1a2e] leading-tight mb-0.5 line-clamp-1">{name}</h3>
        <p className="text-[10px] text-gray-400 mb-2 line-clamp-1">{desc}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-[#1e1b4b] text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-[#2d2a6e] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <IconPin size={11} />
            {strings[lang].navigate}
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/LocationCard.tsx
git commit -m "feat: add LocationCard component"
```

---

## Task 6: LocationMap Component (Google Maps)

**Files:**
- Create: `bangkok-guide/components/LocationMap.tsx`
- Modify: `bangkok-guide/next.config.ts`

- [ ] **Step 1: Allow Unsplash images in Next.js config**

Modify `bangkok-guide/next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Create LocationMap component**

Create `bangkok-guide/components/LocationMap.tsx`:

```tsx
'use client'
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { useState } from 'react'
import type { Location } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

const CATEGORY_COLORS: Record<string, string> = {
  food:      '#dc2626',
  cafe:      '#92400e',
  shopping:  '#065f46',
  nightlife: '#4c1d95',
  hotel:     '#0369a1',
}

type Props = { locations: Location[]; lang: Lang }

export function LocationMap({ locations, lang }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const selected = locations.find((l) => l.id === selectedId) ?? null

  return (
    <APIProvider apiKey={apiKey}>
      <div className="h-44 w-full">
        <Map
          defaultCenter={{ lat: 13.7563, lng: 100.5018 }}
          defaultZoom={12}
          mapId="bangkok-guide-map"
          disableDefaultUI
          gestureHandling="cooperative"
          onClick={() => setSelectedId(null)}
        >
          {locations.map((loc) => {
            const color = CATEGORY_COLORS[loc.category] ?? '#1e1b4b'
            const isSelected = selectedId === loc.id
            return (
              <AdvancedMarker
                key={loc.id}
                position={{ lat: loc.lat, lng: loc.lng }}
                onClick={(e) => { e.stop(); setSelectedId(isSelected ? null : loc.id) }}
              >
                <div
                  className="w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                  style={{ background: color, transform: isSelected ? 'scale(1.25)' : undefined }}
                >
                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              </AdvancedMarker>
            )
          })}

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelectedId(null)}
              pixelOffset={[0, -36]}
            >
              <div className="p-1 max-w-[180px]">
                <p className="font-bold text-sm text-[#1a1a2e] mb-0.5">
                  {lang === 'zh' ? selected.name_zh : selected.name_en}
                </p>
                <p className="text-xs text-gray-500 mb-2">★ {selected.rating.toFixed(1)}</p>
                <a
                  href={selected.lat && selected.lng
                    ? `https://www.google.com/maps?q=${selected.lat},${selected.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.name_en + ' Bangkok')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#1e1b4b] underline"
                >
                  {strings[lang].openMaps}
                </a>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/LocationMap.tsx next.config.ts
git commit -m "feat: add LocationMap with Google Maps embedded + custom pins"
```

---

## Task 7: Public Homepage

**Files:**
- Modify: `bangkok-guide/app/layout.tsx`
- Modify: `bangkok-guide/app/globals.css`
- Modify: `bangkok-guide/app/page.tsx`

- [ ] **Step 1: Update root layout**

Replace contents of `bangkok-guide/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '曼谷旅遊指南 | Bangkok Guide',
  description: '精選曼谷美食、咖啡廳、購物、夜生活、飯店推薦',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Add no-scrollbar utility to globals.css**

Append to `bangkok-guide/app/globals.css`:

```css
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 3: Build the public homepage**

Replace contents of `bangkok-guide/app/page.tsx`:

```tsx
import { readLocations } from '@/lib/data'
import { PublicHomepage } from './PublicHomepage'

export const dynamic = 'force-dynamic'

export default function Page() {
  const locations = readLocations()
  return <PublicHomepage locations={locations} />
}
```

- [ ] **Step 4: Create the client-side homepage component**

Create `bangkok-guide/app/PublicHomepage.tsx`:

```tsx
'use client'
import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/hooks/useLanguage'
import { strings } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { CategoryTabs } from '@/components/CategoryTabs'
import { LocationCard } from '@/components/LocationCard'
import { LocationMap } from '@/components/LocationMap'
import type { Location, Category } from '@/lib/types'

type Props = { locations: Location[] }

export function PublicHomepage({ locations }: Props) {
  const { lang, setLang } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return locations.filter((loc) => {
      const matchCat = activeCategory === 'all' || loc.category === activeCategory
      const q = query.toLowerCase()
      const matchSearch = !q || [loc.name_zh, loc.name_en, loc.description_zh, loc.description_en]
        .some((s) => s.toLowerCase().includes(q))
      return matchCat && matchSearch
    })
  }, [locations, activeCategory, query])

  const trending = useMemo(() => filtered.filter((l) => l.trending).slice(0, 6), [filtered])
  const rest = useMemo(() => filtered.filter((l) => !l.trending), [filtered])

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl">
      {/* HERO */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&fit=crop"
          alt="Bangkok skyline"
          fill className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1428]/80 to-[#0f1428]/50" />
        <div className="relative z-10 p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-auto">
            <span className="text-white/60 text-xs font-bold uppercase tracking-widest">{strings[lang].siteName}</span>
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
          <div>
            <h1 className="text-white text-2xl font-black leading-tight">
              {strings[lang].heroTitle}{' '}
              <span className="text-amber-400">{strings[lang].heroTitleAccent}</span>
            </h1>
            <p className="text-white/60 text-xs mt-1 mb-3">{strings[lang].heroSubtitle}</p>
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input
                className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
                placeholder={strings[lang].searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY TABS */}
      <CategoryTabs active={activeCategory} onChange={setActiveCategory} lang={lang} />

      {/* MAP */}
      <LocationMap locations={filtered} lang={lang} />

      {/* TRENDING SECTION */}
      {trending.length > 0 && (
        <section className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C10 7 5 8 5 13c0 4.5 3 7 7 7s7-2.5 7-7c0-5-5-6-7-11z"/>
            </svg>
            <h2 className="text-base font-black text-[#1a1a2e]">{strings[lang].trendingSection}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {trending.map((loc) => <LocationCard key={loc.id} location={loc} lang={lang} />)}
          </div>
        </section>
      )}

      {/* REST */}
      {rest.length > 0 && (
        <section className="px-3 pt-3 pb-6">
          <div className="grid grid-cols-2 gap-2.5">
            {rest.map((loc) => <LocationCard key={loc.id} location={loc} lang={lang} />)}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="text-sm">找不到符合的地點</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Start dev server and verify**

```bash
npm run dev
```

Open http://localhost:3000. Expected: homepage loads with hero, category tabs, empty state (no locations yet). Language toggle switches between 中文/EN.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: build public homepage with hero, tabs, map, and card grid"
```

---

## Task 8: API Routes

**Files:**
- Create: `bangkok-guide/app/api/admin/auth/route.ts`
- Create: `bangkok-guide/app/api/locations/route.ts`
- Create: `bangkok-guide/app/api/pending/route.ts`
- Create: `bangkok-guide/app/api/scraper/route.ts`

- [ ] **Step 1: Auth route**

Create `bangkok-guide/app/api/admin/auth/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}
```

- [ ] **Step 2: Locations route (approve + delete)**

Create `bangkok-guide/app/api/locations/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { readLocations, writeLocations, readPending, writePending } from '@/lib/data'
import { v4 as uuidv4 } from 'uuid'
import type { Location, PendingLocation } from '@/lib/types'

export async function GET() {
  return NextResponse.json(readLocations())
}

// POST: approve a pending item (body: { id: string }) or add a manual location (body: Location without id/approved_at)
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.id && !body.name_zh) {
    // Approve from pending
    const pending = readPending()
    const item = pending.find((p) => p.id === body.id)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { scraped_at, ...rest } = item as PendingLocation
    void scraped_at
    const approved: Location = { ...rest, approved_at: new Date().toISOString() }
    writeLocations([...readLocations(), approved])
    writePending(pending.filter((p) => p.id !== body.id))
    return NextResponse.json({ ok: true })
  }

  // Manual add
  const location: Location = {
    ...body,
    id: uuidv4(),
    approved_at: new Date().toISOString(),
  }
  writeLocations([...readLocations(), location])
  return NextResponse.json({ ok: true, id: location.id })
}

// DELETE: remove an approved location by id
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const locations = readLocations().filter((l) => l.id !== id)
  writeLocations(locations)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Pending route (list + reject)**

Create `bangkok-guide/app/api/pending/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { readPending, writePending } from '@/lib/data'

export async function GET() {
  return NextResponse.json(readPending())
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  writePending(readPending().filter((p) => p.id !== id))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Scraper trigger route**

Create `bangkok-guide/app/api/scraper/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { runAllScrapers } from '@/scrapers/index'

export async function POST() {
  try {
    const count = await runAllScrapers()
    return NextResponse.json({ ok: true, added: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Test auth route with curl**

Start dev server if not running: `npm run dev`

```bash
curl -X POST http://localhost:3000/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}'
```
Expected: `{"ok":false}` with status 401

```bash
curl -X POST http://localhost:3000/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}'
```
Expected: `{"ok":true}` with status 200

- [ ] **Step 6: Commit**

```bash
git add app/api/
git commit -m "feat: add API routes for auth, locations, pending, and scraper trigger"
```

---

## Task 9: Admin Panel

**Files:**
- Create: `bangkok-guide/app/admin/page.tsx`
- Create: `bangkok-guide/app/admin/AdminPanel.tsx`

- [ ] **Step 1: Create admin page (server component)**

Create `bangkok-guide/app/admin/page.tsx`:

```tsx
import { AdminPanel } from './AdminPanel'

export default function AdminPage() {
  return <AdminPanel />
}
```

- [ ] **Step 2: Create full admin panel client component**

Create `bangkok-guide/app/admin/AdminPanel.tsx`:

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { Location, PendingLocation, Category, Source } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

type Tab = 'pending' | 'approved' | 'add'

const SOURCE_LABEL: Record<Source, string> = {
  tiktok: 'TikTok', instagram: 'IG', pantip: 'Pantip',
  wongnai: 'Wongnai', googlemaps: 'Google Maps', manual: '手動新增',
}
const SOURCE_STYLE: Record<Source, string> = {
  tiktok: 'bg-green-50 text-green-700 border-green-200',
  instagram: 'bg-purple-50 text-purple-700 border-purple-200',
  pantip: 'bg-orange-50 text-orange-700 border-orange-200',
  wongnai: 'bg-red-50 text-red-700 border-red-200',
  googlemaps: 'bg-blue-50 text-blue-700 border-blue-200',
  manual: 'bg-gray-50 text-gray-600 border-gray-200',
}

// ---- AUTH OVERLAY ----
function AuthOverlay({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    if (res.ok) {
      sessionStorage.setItem('admin_authed', '1')
      onAuth()
    } else {
      setErr(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
        <h1 className="text-xl font-black text-[#0f172a] mb-1">管理後台</h1>
        <p className="text-sm text-gray-400 mb-6">Bangkok Guide Admin</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false) }}
          placeholder="輸入密碼"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 mb-3"
        />
        {err && <p className="text-xs text-red-500 mb-3">密碼錯誤</p>}
        <button type="submit" className="w-full bg-[#0f172a] text-white rounded-xl py-3 text-sm font-bold">
          登入
        </button>
      </form>
    </div>
  )
}

// ---- PENDING CARD ----
function PendingCard({
  item,
  onApprove,
  onReject,
}: {
  item: PendingLocation
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const photo = item.photos[0] ?? 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=220&h=120&fit=crop'
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-transparent hover:border-indigo-200 transition-colors flex">
      <div className="relative w-28 shrink-0">
        <Image src={photo} alt={item.name_en} fill className="object-cover" sizes="112px" />
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[#0f172a] text-sm leading-tight">{item.name_zh || item.name_en}</h3>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${SOURCE_STYLE[item.source]}`}>
            {SOURCE_LABEL[item.source]}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{item.category}</span>
          <span className="text-[10px] text-gray-400 truncate">{item.address}</span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description_zh || item.description_en}</p>
        <div className="flex items-center justify-between">
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 underline truncate max-w-[160px]">
              {item.source_url.replace(/^https?:\/\//, '')}
            </a>
          ) : <span />}
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onReject(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
              駁回
            </button>
            <button onClick={() => onApprove(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
              上架
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- APPROVED CARD ----
function ApprovedCard({ item, onRemove }: { item: Location; onRemove: (id: string) => void }) {
  const photo = item.photos[0] ?? 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=220&h=120&fit=crop'
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-transparent hover:border-slate-200 transition-colors flex">
      <div className="relative w-20 shrink-0">
        <Image src={photo} alt={item.name_en} fill className="object-cover" sizes="80px" />
      </div>
      <div className="flex-1 p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-[#0f172a] truncate">{item.name_zh || item.name_en}</h3>
          <p className="text-[10px] text-gray-400">{item.category} · ★ {item.rating}</p>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 shrink-0">
          下架
        </button>
      </div>
    </div>
  )
}

// ---- MANUAL ADD FORM ----
function AddForm({ onAdded }: { onAdded: () => void }) {
  const empty = {
    name_zh: '', name_en: '', description_zh: '', description_en: '',
    category: 'food' as Category, address: '', lat: 0, lng: 0,
    photosInput: '', source: 'manual' as Source,
    source_url: '', rating: 4, price_range: 2 as 1|2|3|4, trending: false,
  }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.type === 'number' ? Number(e.target.value) : e.target.value
      setForm((f) => ({ ...f, [key]: val }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      photos: form.photosInput ? form.photosInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }
    await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setForm(empty)
    setSaving(false)
    onAdded()
  }

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400'
  const label = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-6 max-w-2xl">
      <h2 className="text-lg font-black text-[#0f172a] mb-5">手動新增地點</h2>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>中文名稱</label><input className={inp} value={form.name_zh} onChange={field('name_zh')} required /></div>
        <div><label className={label}>English Name</label><input className={inp} value={form.name_en} onChange={field('name_en')} required /></div>
        <div className="col-span-2"><label className={label}>中文描述</label><textarea className={inp} rows={2} value={form.description_zh} onChange={field('description_zh')} /></div>
        <div className="col-span-2"><label className={label}>English Description</label><textarea className={inp} rows={2} value={form.description_en} onChange={field('description_en')} /></div>
        <div>
          <label className={label}>分類</label>
          <select className={inp} value={form.category} onChange={field('category')}>
            {(['food','cafe','shopping','nightlife','hotel'] as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>來源</label>
          <select className={inp} value={form.source} onChange={field('source')}>
            {(['manual','pantip','wongnai','googlemaps','tiktok','instagram'] as Source[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={label}>地址</label><input className={inp} value={form.address} onChange={field('address')} /></div>
        <div><label className={label}>緯度 (lat)</label><input type="number" step="any" className={inp} value={form.lat} onChange={field('lat')} /></div>
        <div><label className={label}>經度 (lng)</label><input type="number" step="any" className={inp} value={form.lng} onChange={field('lng')} /></div>
        <div className="col-span-2"><label className={label}>照片 URLs（逗號分隔）</label><input className={inp} value={form.photosInput} onChange={field('photosInput')} placeholder="https://..." /></div>
        <div><label className={label}>評分 (0-5)</label><input type="number" min="0" max="5" step="0.1" className={inp} value={form.rating} onChange={field('rating')} /></div>
        <div>
          <label className={label}>價位</label>
          <select className={inp} value={form.price_range} onChange={field('price_range')}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{'$'.repeat(n)}</option>)}
          </select>
        </div>
        <div><label className={label}>Source URL</label><input className={inp} value={form.source_url} onChange={field('source_url')} /></div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="trending" checked={form.trending} onChange={field('trending')} className="w-4 h-4" />
          <label htmlFor="trending" className="text-sm font-semibold text-gray-600">標記為熱門</label>
        </div>
      </div>
      <button type="submit" disabled={saving} className="mt-6 bg-[#0f172a] text-white rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-50">
        {saving ? '儲存中...' : '新增地點'}
      </button>
    </form>
  )
}

// ---- MAIN ADMIN PANEL ----
export function AdminPanel() {
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<PendingLocation[]>([])
  const [approved, setApproved] = useState<Location[]>([])
  const [scraperStatus, setScraperStatus] = useState<string>('就緒')
  const [scraperRunning, setScraperRunning] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === '1') setAuthed(true)
  }, [])

  const loadData = useCallback(async () => {
    const [p, a] = await Promise.all([
      fetch('/api/pending').then((r) => r.json()),
      fetch('/api/locations').then((r) => r.json()),
    ])
    setPending(p)
    setApproved(a)
  }, [])

  useEffect(() => {
    if (authed) loadData()
  }, [authed, loadData])

  async function handleApprove(id: string) {
    await fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  async function handleReject(id: string) {
    await fetch('/api/pending', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  async function handleRemove(id: string) {
    await fetch('/api/locations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  async function runScraper() {
    setScraperRunning(true)
    setScraperStatus('爬取中...')
    try {
      const res = await fetch('/api/scraper', { method: 'POST' })
      const data = await res.json()
      setScraperStatus(`完成 — 新增 ${data.added ?? 0} 筆`)
      loadData()
    } catch {
      setScraperStatus('執行失敗')
    } finally {
      setScraperRunning(false)
    }
  }

  if (!authed) return <AuthOverlay onAuth={() => setAuthed(true)} />

  const navLink = (t: Tab, label: string, count?: number) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm rounded-lg transition-colors ${
        tab === t ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  )

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* SIDEBAR */}
      <div className="w-56 bg-[#0f172a] flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-white font-black text-sm tracking-wide">Bangkok Guide</div>
          <div className="text-slate-500 text-xs mt-0.5">管理後台</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navLink('pending', '待審核地點', pending.length)}
          {navLink('approved', '已上架地點')}
          {navLink('add', '手動新增')}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={runScraper}
            disabled={scraperRunning}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2"
          >
            <svg className={`w-3.5 h-3.5 ${scraperRunning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            {scraperRunning ? '執行中...' : '執行爬蟲'}
          </button>
          <p className="text-slate-500 text-[10px] text-center mt-1.5">{scraperStatus}</p>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: '待審核', value: pending.length, color: 'text-amber-600' },
            { label: '已上架', value: approved.length, color: 'text-green-600' },
            { label: '總計', value: pending.length + approved.length, color: 'text-slate-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
              <div className={`text-3xl font-black ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {tab === 'pending' && (
          <div className="space-y-3">
            <h1 className="text-xl font-black text-[#0f172a] mb-4">待審核地點</h1>
            {pending.length === 0 && <p className="text-gray-400 text-sm py-12 text-center">沒有待審核的地點</p>}
            {pending.map((item) => (
              <PendingCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}

        {tab === 'approved' && (
          <div>
            <h1 className="text-xl font-black text-[#0f172a] mb-4">已上架地點</h1>
            <div className="space-y-2">
              {approved.length === 0 && <p className="text-gray-400 text-sm py-12 text-center">還沒有上架的地點</p>}
              {approved.map((item) => (
                <ApprovedCard key={item.id} item={item} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        {tab === 'add' && <AddForm onAdded={() => { loadData(); setTab('approved') }} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify admin panel**

With dev server running, open http://localhost:3000/admin.
- Expected: password prompt appears
- Enter wrong password → error shows
- Enter correct password (from `.env.local`) → panel appears with empty pending/approved lists
- Click "手動新增" → form appears
- Fill in a location and submit → see it appear in "已上架"

- [ ] **Step 4: Commit**

```bash
git add app/admin/
git commit -m "feat: build admin panel with auth, pending review, approved tab, and manual add"
```

---

## Task 10: Scraper Shared Utilities

**Files:**
- Create: `bangkok-guide/scrapers/shared.ts`

- [ ] **Step 1: Create shared scraper utilities**

Create `bangkok-guide/scrapers/shared.ts`:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add scrapers/shared.ts
git commit -m "feat: add scraper shared utilities and Firecrawl client"
```

---

## Task 11: Pantip and Wongnai Scrapers

**Files:**
- Create: `bangkok-guide/scrapers/pantip.ts`
- Create: `bangkok-guide/scrapers/wongnai.ts`

- [ ] **Step 1: Create Pantip scraper**

Create `bangkok-guide/scrapers/pantip.ts`:

```ts
import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const PANTIP_QUERIES = [
  'https://pantip.com/search#q=%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3+%E0%B8%81%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B9%80%E0%B8%97%E0%B8%9E&st=topic',
  'https://pantip.com/search#q=%E0%B8%84%E0%B8%B2%E0%B9%80%E0%B8%9F%E0%B9%88+%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B9%81%E0%B8%9F+Bangkok&st=topic',
]

function parseRestaurantsFromMarkdown(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  // Look for patterns like: **Name** or ## Name followed by address-like text
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    // Match bold headers that look like restaurant names (contain mixed Thai/English)
    const nameMatch = line.match(/^\*\*(.{3,50})\*\*/) || line.match(/^#{1,3}\s+(.{3,50})/)
    if (nameMatch) {
      const rawName = nameMatch[1].trim()
      // Skip if purely Thai (no ASCII letters) or too short
      if (rawName.length >= 3 && /[a-zA-Z\d]/.test(rawName)) {
        const description = lines.slice(i + 1, i + 4).join(' ').replace(/#+/g, '').trim().slice(0, 200)
        items.push({
          name_en: rawName,
          name_zh: rawName,
          description_en: description,
          description_zh: description,
          address: 'Bangkok, Thailand',
          lat: 13.7563,
          lng: 100.5018,
          photos: [],
          source_url: sourceUrl,
          rating: 4.0,
          price_range: 2,
          trending: true,
        })
      }
    }
    i++
    if (items.length >= 10) break
  }
  return items
}

export async function scrapePantip(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of PANTIP_QUERIES) {
    try {
      const markdown = await firecrawlScrape(url)
      const items = parseRestaurantsFromMarkdown(markdown, url)
      results.push(...items)
      await sleep(2000)
    } catch (err) {
      console.error('Pantip scrape failed for', url, err)
    }
  }
  return results
}
```

- [ ] **Step 2: Create Wongnai scraper**

Create `bangkok-guide/scrapers/wongnai.ts`:

```ts
import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const WONGNAI_URLS = [
  'https://www.wongnai.com/restaurants/bangkok',
  'https://www.wongnai.com/restaurants/bangkok?categories=cafe',
]

function parseWongnai(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // Wongnai typically renders restaurant names in bold or as links
    const nameMatch = line.match(/^\[(.{3,60})\]/) || line.match(/^\*\*(.{3,60})\*\*/)
    if (!nameMatch) continue

    const name = nameMatch[1].trim()
    if (name.length < 3) continue

    // Look for rating on nearby lines
    let rating = 4.0
    const ratingLine = lines.slice(i, i + 5).join(' ')
    const ratingMatch = ratingLine.match(/(\d+\.\d+)\s*\/\s*5/) || ratingLine.match(/★\s*(\d+\.\d+)/)
    if (ratingMatch) rating = parseFloat(ratingMatch[1])

    const description = lines.slice(i + 1, i + 3).join(' ').trim().slice(0, 200)

    items.push({
      name_en: name,
      name_zh: name,
      description_en: description,
      description_zh: description,
      address: 'Bangkok, Thailand',
      lat: 13.7563,
      lng: 100.5018,
      photos: [],
      source_url: sourceUrl,
      rating,
      price_range: 2,
      trending: false,
    })

    if (items.length >= 15) break
  }
  return items
}

export async function scrapeWongnai(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of WONGNAI_URLS) {
    try {
      const markdown = await firecrawlScrape(url)
      results.push(...parseWongnai(markdown, url))
      await sleep(2000)
    } catch (err) {
      console.error('Wongnai scrape failed', err)
    }
  }
  return results
}
```

- [ ] **Step 3: Commit**

```bash
git add scrapers/pantip.ts scrapers/wongnai.ts
git commit -m "feat: add Pantip and Wongnai scrapers"
```

---

## Task 12: Google Maps Places API Scraper

**Files:**
- Create: `bangkok-guide/scrapers/googlemaps.ts`

- [ ] **Step 1: Create Google Maps scraper**

Create `bangkok-guide/scrapers/googlemaps.ts`:

```ts
import type { ScrapedItem } from './shared'

const BANGKOK_LAT = 13.7563
const BANGKOK_LNG = 100.5018
const RADIUS = 10000 // 10km

const SEARCH_QUERIES = [
  { query: 'best restaurant Bangkok', category: 'food' as const },
  { query: 'best cafe Bangkok', category: 'cafe' as const },
  { query: 'night market Bangkok shopping', category: 'shopping' as const },
  { query: 'rooftop bar Bangkok nightlife', category: 'nightlife' as const },
  { query: 'boutique hotel Bangkok', category: 'hotel' as const },
]

type GMPlace = {
  name: string
  formatted_address: string
  rating?: number
  geometry: { location: { lat: number; lng: number } }
  photos?: Array<{ photo_reference: string }>
  price_level?: number
  place_id: string
}

export async function scrapeGoogleMaps(): Promise<ScrapedItem[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not set — skipping Google Maps scraper')
    return []
  }

  const results: ScrapedItem[] = []

  for (const { query, category } of SEARCH_QUERIES) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      url.searchParams.set('query', query)
      url.searchParams.set('location', `${BANGKOK_LAT},${BANGKOK_LNG}`)
      url.searchParams.set('radius', String(RADIUS))
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status !== 'OK') {
        console.error('Places API error:', data.status, data.error_message)
        continue
      }

      for (const place of (data.results as GMPlace[]).slice(0, 8)) {
        const photoRef = place.photos?.[0]?.photo_reference
        const photoUrl = photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`
          : ''

        results.push({
          name_en: place.name,
          name_zh: place.name,
          description_en: `${place.name} — ${place.formatted_address}`,
          description_zh: `${place.name} — ${place.formatted_address}`,
          address: place.formatted_address,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          photos: photoUrl ? [photoUrl] : [],
          source_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          rating: place.rating ?? 4.0,
          price_range: ((place.price_level ?? 1) + 1) as 1 | 2 | 3 | 4,
          trending: false,
        })
      }

      await new Promise((r) => setTimeout(r, 1000))
    } catch (err) {
      console.error('Google Maps scrape failed for', query, err)
    }
  }

  return results
}
```

- [ ] **Step 2: Commit**

```bash
git add scrapers/googlemaps.ts
git commit -m "feat: add Google Maps Places API scraper"
```

---

## Task 13: TikTok and Instagram Scrapers

**Files:**
- Create: `bangkok-guide/scrapers/tiktok.ts`
- Create: `bangkok-guide/scrapers/instagram.ts`

- [ ] **Step 1: Create TikTok scraper**

Create `bangkok-guide/scrapers/tiktok.ts`:

```ts
import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const TIKTOK_URLS = [
  'https://www.tiktok.com/search?q=bangkok+restaurant+food',
  'https://www.tiktok.com/search?q=bangkok+cafe+coffee',
]

function parseTikTokMarkdown(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  // TikTok descriptions often mention place names with @ or location tags
  const namePattern = /(?:@|#|📍|🍽️|☕)\s*([A-Z][A-Za-z\s&']{2,40})(?:\s|$)/g
  let match
  const seen = new Set<string>()

  while ((match = namePattern.exec(markdown)) !== null) {
    const name = match[1].trim()
    if (seen.has(name) || name.length < 4) continue
    seen.add(name)

    items.push({
      name_en: name,
      name_zh: name,
      description_en: `Trending on TikTok in Bangkok`,
      description_zh: `TikTok 曼谷熱傳`,
      address: 'Bangkok, Thailand',
      lat: 13.7563,
      lng: 100.5018,
      photos: [],
      source_url: sourceUrl,
      rating: 4.0,
      price_range: 2,
      trending: true,
    })

    if (items.length >= 8) break
  }
  return items
}

export async function scrapeTikTok(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of TIKTOK_URLS) {
    try {
      const markdown = await firecrawlScrape(url)
      results.push(...parseTikTokMarkdown(markdown, url))
      await sleep(3000)
    } catch (err) {
      console.error('TikTok scrape failed', err)
    }
  }
  return results
}
```

- [ ] **Step 2: Create Instagram scraper**

Create `bangkok-guide/scrapers/instagram.ts`:

```ts
import { firecrawlScrape, sleep, type ScrapedItem } from './shared'

const IG_URLS = [
  'https://www.instagram.com/explore/tags/bangkokfood/',
  'https://www.instagram.com/explore/tags/bangkokcafe/',
]

function parseInstagramMarkdown(markdown: string, sourceUrl: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  // Instagram posts often tag places with @ or list them in captions
  const namePattern = /(?:📍|🍽️|☕|at\s+|@)([A-Z][A-Za-z\s&'.]{2,40})(?:\n|,|!|\.|$)/g
  let match
  const seen = new Set<string>()

  while ((match = namePattern.exec(markdown)) !== null) {
    const name = match[1].trim()
    if (seen.has(name) || name.length < 4) continue
    seen.add(name)

    items.push({
      name_en: name,
      name_zh: name,
      description_en: `Trending on Instagram in Bangkok`,
      description_zh: `IG 曼谷爆紅`,
      address: 'Bangkok, Thailand',
      lat: 13.7563,
      lng: 100.5018,
      photos: [],
      source_url: sourceUrl,
      rating: 4.0,
      price_range: 2,
      trending: true,
    })

    if (items.length >= 8) break
  }
  return items
}

export async function scrapeInstagram(): Promise<ScrapedItem[]> {
  const results: ScrapedItem[] = []
  for (const url of IG_URLS) {
    try {
      const markdown = await firecrawlScrape(url)
      results.push(...parseInstagramMarkdown(markdown, url))
      await sleep(3000)
    } catch (err) {
      console.error('Instagram scrape failed', err)
    }
  }
  return results
}
```

- [ ] **Step 3: Commit**

```bash
git add scrapers/tiktok.ts scrapers/instagram.ts
git commit -m "feat: add TikTok and Instagram scrapers (Firecrawl-based)"
```

---

## Task 14: Scraper Index + Final Wiring

**Files:**
- Create: `bangkok-guide/scrapers/index.ts`
- Create: `bangkok-guide/.env.local` (local only, not committed)

- [ ] **Step 1: Create .env.local**

Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual keys:
```
ADMIN_PASSWORD=choose_a_strong_password
GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
FIRECRAWL_API_KEY=fc-...
```

Note: Use separate Google Maps API keys. The server key (`GOOGLE_MAPS_API_KEY`) is used for Places API calls in scrapers; the browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) is used in the embedded map. Restrict each key appropriately in Google Cloud Console.

- [ ] **Step 2: Create scraper index**

Create `bangkok-guide/scrapers/index.ts`:

```ts
import { v4 as uuidv4 } from 'uuid'
import { readLocations, readPending, writePending } from '@/lib/data'
import { isDuplicate } from '@/lib/dedup'
import type { PendingLocation } from '@/lib/types'
import { scrapePantip } from './pantip'
import { scrapeWongnai } from './wongnai'
import { scrapeGoogleMaps } from './googlemaps'
import { scrapeTikTok } from './tiktok'
import { scrapeInstagram } from './instagram'

const SOURCE_MAP = {
  pantip: scrapePantip,
  wongnai: scrapeWongnai,
  googlemaps: scrapeGoogleMaps,
  tiktok: scrapeTikTok,
  instagram: scrapeInstagram,
} as const

export async function runAllScrapers(): Promise<number> {
  const existing = [...readLocations(), ...readPending()]
  const newItems: PendingLocation[] = []

  for (const [source, scraper] of Object.entries(SOURCE_MAP)) {
    console.log(`Running ${source} scraper...`)
    try {
      const items = await scraper()
      for (const item of items) {
        if (!isDuplicate(item, existing)) {
          newItems.push({
            ...item,
            id: uuidv4(),
            source: source as PendingLocation['source'],
            approved_at: undefined,
            scraped_at: new Date().toISOString(),
          })
          // Add to existing check list to avoid intra-run duplicates
          existing.push({ ...item, id: 'temp', source: source as any, approved_at: undefined })
        }
      }
    } catch (err) {
      console.error(`Scraper ${source} failed:`, err)
    }
  }

  if (newItems.length > 0) {
    const current = readPending()
    writePending([...current, ...newItems])
  }

  console.log(`Scrapers done — added ${newItems.length} new items`)
  return newItems.length
}
```

- [ ] **Step 3: End-to-end workflow test**

Start the dev server: `npm run dev`

1. Open http://localhost:3000/admin and log in
2. Click "執行爬蟲" — watch the button spin; after ~30-60 seconds it should show "完成 — 新增 X 筆"
3. Pending tab should now show scraped results with photos, names, source badges
4. Click "上架" on a few items
5. Open http://localhost:3000 — approved items appear in card grid with pins on the map
6. Test language toggle — cards switch between 中文/EN
7. Click "導航" on a card — opens Google Maps in new tab
8. Click a map pin — info popup appears with "在 Google Maps 開啟" link

- [ ] **Step 4: Add seed data for local testing**

If no scrapers return results immediately (due to missing API keys), manually add a location via the admin form to verify the full flow works. Use a known Bangkok restaurant with a real photo URL from Google Maps or Unsplash.

- [ ] **Step 5: Final commit**

```bash
git add scrapers/index.ts
git commit -m "feat: add scraper index with deduplication — runs all platforms and appends to pending.json"
```

---

## Task 15: Deployment to Vercel

- [ ] **Step 1: Create GitHub repository**

```bash
cd /Users/jerryzhang/Downloads/jerry_claude/bangkok-guide
git remote add origin https://github.com/YOUR_USERNAME/bangkok-guide.git
git push -u origin main
```

- [ ] **Step 2: Connect to Vercel**

1. Go to https://vercel.com and log in
2. Click "Add New Project" → import the `bangkok-guide` GitHub repo
3. Framework: Next.js (auto-detected)
4. Add environment variable: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = your browser Maps key
5. Click Deploy

- [ ] **Step 3: Verify public site**

Visit the Vercel URL. The public site should load with the hero, tabs, and map. Initially empty (no approved locations) — that's correct.

- [ ] **Step 4: Daily update workflow**

```bash
# Run locally:
npm run dev
# → open admin at localhost:3000/admin
# → click 執行爬蟲
# → approve good locations
# → then push:
git add data/
git commit -m "data: approve new Bangkok locations"
git push
# Vercel auto-redeploys in ~30 seconds
```

---

## Notes

**TikTok / Instagram reliability:** These platforms aggressively block scrapers. Firecrawl may return limited content. Treat these as best-effort — most reliable data will come from Wongnai and Google Maps Places API.

**Google Maps photo URLs:** Photos from the Places API require an API key in the URL. These photos are served by Google and will load as long as your key is valid. No need to re-host them.

**Lat/Lng from scrapers:** Only Google Maps Places API returns accurate coordinates. Pantip/Wongnai/TikTok/Instagram results default to Bangkok center (13.7563, 100.5018). After approving a location, edit it in the admin to add precise coordinates for better map pin placement.
