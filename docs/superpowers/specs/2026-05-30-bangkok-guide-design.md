# Bangkok Guide — Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

A bilingual (Chinese/English) Bangkok travel guide website that auto-collects trending spots from Thai social platforms, routes them through an admin review panel, and publishes approved locations to the public site with embedded Google Maps.

---

## Architecture

**Stack**
- Next.js 14 (App Router) + Tailwind CSS
- Data storage: JSON files committed to GitHub (`locations.json`, `pending.json`)
- Deployment: Vercel (free tier) — push to GitHub triggers auto-deploy
- Maps: Google Maps JavaScript API (embedded interactive map + deep-link navigation)
- Scrapers: Node.js scripts run locally, using Firecrawl for page extraction

**Directory Structure**
```
bangkok-guide/
├── app/
│   ├── page.tsx                   # Public homepage
│   ├── admin/
│   │   └── page.tsx               # Admin review panel (password-protected)
│   └── api/
│       ├── locations/route.ts     # GET approved, POST approve, DELETE
│       ├── pending/route.ts       # GET pending, POST reject
│       └── scraper/route.ts       # POST to trigger scraper run
├── data/
│   ├── locations.json             # Approved locations (public)
│   └── pending.json               # Awaiting admin review
├── scrapers/
│   ├── pantip.ts
│   ├── wongnai.ts
│   ├── googlemaps.ts
│   ├── tiktok.ts
│   └── instagram.ts
├── components/
│   ├── LocationCard.tsx
│   ├── LocationMap.tsx
│   ├── CategoryTabs.tsx
│   └── LanguageToggle.tsx
└── public/
```

---

## Data Model

Each location (approved or pending) shares the same shape:

```ts
type Location = {
  id: string                  // UUID
  name_zh: string
  name_en: string
  description_zh: string
  description_en: string
  category: 'food' | 'cafe' | 'shopping' | 'nightlife' | 'hotel'
  address: string
  lat: number
  lng: number
  photos: string[]            // URLs (from scraper or manual upload)
  source: 'pantip' | 'wongnai' | 'googlemaps' | 'tiktok' | 'instagram' | 'manual'
  source_url: string
  rating: number              // 0–5
  price_range: 1 | 2 | 3 | 4 // $ to $$$$
  trending: boolean
  approved_at?: string        // ISO date, set on approval
}
```

`pending.json` uses the same shape plus a `scraped_at` timestamp. `locations.json` is the array of approved locations read directly by the public site.

---

## Public Website (`/`)

**Layout**
- Hero: full-bleed Bangkok cityscape photo, site name, language toggle (中文 / EN), search bar
- Category tabs: 全部 / 美食 / 咖啡廳 / 購物 / 夜生活 / 飯店 — all use custom SVG icons, no emoji
- Embedded Google Maps: interactive, shows all approved locations as pins; clicking a pin opens an info card
- Card grid below map: two columns on mobile, three on desktop; each card shows real photo, name, source badge (TikTok / IG / Pantip / Wongnai), rating, and a navigation button
- Clicking the navigation button opens `https://www.google.com/maps/search/?api=1&query={name}+Bangkok` (or lat/lng if available)

**Language**
- All UI strings defined in `lib/i18n.ts` with `zh` and `en` keys
- Language preference stored in `localStorage`, defaulting to `zh`
- Location `name_zh/en` and `description_zh/en` swap on toggle

**Search**
- Client-side filter across `name_zh`, `name_en`, `description_zh`, `description_en`
- Combined with category tab filter

---

## Admin Panel (`/admin`)

**Authentication**
- Single password stored in `ADMIN_PASSWORD` env variable (`.env.local`, never committed)
- On load: if `sessionStorage` has no `admin_authed` key, show password prompt overlay
- Submit password → `POST /api/admin/auth` checks against `ADMIN_PASSWORD` env var; returns 200 or 401
- On 200, set `sessionStorage.admin_authed = "1"` and show the panel; on 401, show error

**Sidebar**
- 待審核 (with count badge) / 已上架 / 手動新增 / 爬蟲紀錄
- Footer: "執行爬蟲" button — calls `POST /api/scraper` (local dev server only) which runs all scrapers in sequence and appends deduplicated results to `data/pending.json`
- Last-run timestamp displayed below button

**Pending Tab**
- Each card: photo, name, source badge, category pill, address, description (2-line clamp), source URL link
- Actions: 編輯 (opens inline edit form) / 駁回 (removes from pending) / 上架 (moves to locations.json with `approved_at`)

**Approved Tab**
- Same card layout, actions: 編輯 / 下架 (moves back to pending or deletes)

**Manual Add Form**
- Fields: name_zh, name_en, description_zh, description_en, category, address, lat, lng, photos (URL input), source_url, rating, price_range, trending toggle
- Submits directly to `locations.json` (bypasses pending)

---

## Scrapers

Each scraper is a standalone async function in `scrapers/`. The admin "執行爬蟲" button calls `/api/scraper` which imports and runs all scrapers sequentially.

**Pantip** — search `"แนะนำ Bangkok" + category keywords`, extract restaurant/place names, descriptions, addresses from top threads. Uses Firecrawl `scrape`.

**Wongnai** — fetch top-rated listings per category (food, cafe, etc.) from Wongnai search pages. Structured data — extract name, address, rating, photos.

**Google Maps** — uses Google Places API (`nearbySearch` + `textSearch`) with Bangkok coordinates. Requires `GOOGLE_MAPS_API_KEY`. Returns structured lat/lng, photos, rating.

**TikTok** — search `#Bangkok` + category hashtags via Firecrawl. Extract video descriptions mentioning place names and addresses. Lower reliability; results are flagged `trending: true`.

**Instagram** — search location tags and hashtags via Firecrawl. Same approach as TikTok. Results flagged `trending: true`.

All scrapers deduplicate against existing `pending.json` and `locations.json` by name (fuzzy match on `name_en`). New items are appended to `pending.json`.

---

## Google Maps Integration

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env variable
- `LocationMap` component uses `@vis.gl/react-google-maps` (lightweight wrapper)
- Map centered on Bangkok (13.7563, 100.5018), zoom 12
- Each approved location rendered as a custom SVG pin colored by category
- Clicking pin: info popup with name, category, rating, "在 Google Maps 開啟" button
- Navigation button URL: `https://www.google.com/maps/search/?api=1&query={encodeURIComponent(name)}` or `https://www.google.com/maps?q={lat},{lng}` if coordinates available

---

## Deployment & Workflow

**Public site → Vercel**
- Connect GitHub repo to Vercel; set env vars: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Vercel serves only the public `/` route — the filesystem is read-only in production, so admin routes are not used there

**Admin & scrapers → local only**
- Run `npm run dev` on your Mac; access admin at `http://localhost:3000/admin`
- The local dev server CAN write to `data/pending.json` and `data/locations.json` (normal filesystem access)
- Set local env vars in `.env.local`: `ADMIN_PASSWORD`, `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `FIRECRAWL_API_KEY`

**Daily workflow**
1. Click "執行爬蟲" in local admin → scrapers run, results appended to `pending.json`
2. Review pending items in local admin → approve / reject / edit
3. `git add data/ && git commit -m "update locations" && git push`
4. Vercel auto-redeploys the public site with updated `locations.json`

---

## Out of Scope

- User accounts / favourites (no auth for public users)
- Comments or ratings from public users
- Automated scheduled scraping (manual trigger only for now)
- Mobile app
