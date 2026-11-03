import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Location, PendingLocation } from './types'
import { buildSlugMap } from './slug'
import { getPlaceInfo } from './placeInfo'
import type { Tx } from './store'
import { isHiddenCategory } from './site'

function dataDir(): string {
  return process.env.DATA_DIR ?? join(process.cwd(), 'data')
}

function locPath(): string { return join(dataDir(), 'locations.json') }
function pendPath(): string { return join(dataDir(), 'pending.json') }

function ensureFile(path: string, fallback: string): void {
  const dir = join(path, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(path)) writeFileSync(path, fallback)
}

export function readLocations(): Location[] {
  ensureFile(locPath(), '[]')
  const raw: Location[] = JSON.parse(readFileSync(locPath(), 'utf-8'))
  const slugMap = buildSlugMap(raw)
  return raw.map((l) => ({ ...l, slug: l.slug || slugMap.get(l.id), ...getPlaceInfo(l.id) }))
}

// Slim projection for the homepage/listing cards. Drops fields that only the
// detail page needs (source_url is ~15% of the payload, plus approved_at,
// extra photos, hashtags…) so the client bundle ships far fewer bytes.
// Keeps everything LocationCard and the client-side filter/search rely on.
export function toCardLocation(loc: Location): Location {
  return {
    ...loc,
    source_url: '',
    photos: loc.photos?.slice(0, 1) ?? [],
    photo_refs: undefined,
    hashtags: undefined,
    social_embed_url: undefined,
    local_ratio: undefined,
    mentions: undefined,
    evidence: undefined,
    approved_at: undefined,
  }
}

// 網站上列得出來的店（不含 lib/site.ts 裡暫時隱藏的分類）
export function readVisibleLocations(): Location[] {
  return readLocations().filter((l) => !isHiddenCategory(l.category))
}

export function readCardLocations(): Location[] {
  return readVisibleLocations().map(toCardLocation)
}

export function writeLocations(locations: Location[]): void {
  ensureFile(locPath(), '[]')
  // hours / reviews 是讀取時從 hours.json 併進來的，存檔前拿掉，免得舊資料被寫死在 locations.json
  const clean = locations.map(({ hours: _h, reviews: _r, ...rest }) => rest)
  writeFileSync(locPath(), JSON.stringify(clean, null, 2))
}

export function readPending(): PendingLocation[] {
  ensureFile(pendPath(), '[]')
  return JSON.parse(readFileSync(pendPath(), 'utf-8'))
}

export function writePending(pending: PendingLocation[]): void {
  ensureFile(pendPath(), '[]')
  writeFileSync(pendPath(), JSON.stringify(pending, null, 2))
}

// ---------- 後台用（經過 lib/store：本機寫檔，正式站 commit 到 GitHub） ----------
export const LOCATIONS_FILE = 'data/locations.json'
export const PENDING_FILE = 'data/pending.json'

function decorate(raw: Location[]): Location[] {
  const slugMap = buildSlugMap(raw)
  return raw.map((l) => ({ ...l, slug: l.slug || slugMap.get(l.id), ...getPlaceInfo(l.id) }))
}

export async function txLocations(tx: Tx): Promise<Location[]> {
  return decorate(await tx.readJson<Location[]>(LOCATIONS_FILE, []))
}

export function txWriteLocations(tx: Tx, locations: Location[]): void {
  const clean = locations.map(({ hours: _h, reviews: _r, ...rest }) => rest)
  tx.writeText(LOCATIONS_FILE, JSON.stringify(clean, null, 2))
}

export async function txPending(tx: Tx): Promise<PendingLocation[]> {
  return tx.readJson<PendingLocation[]>(PENDING_FILE, [])
}

export function txWritePending(tx: Tx, pending: PendingLocation[]): void {
  tx.writeText(PENDING_FILE, JSON.stringify(pending, null, 2))
}

// 店被刪除或駁回時，照片資料夾一起清掉
export async function txRemovePhotos(tx: Tx, id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  for (const name of await tx.list(`public/photos/${id}`)) tx.remove(`public/photos/${id}/${name}`)
}
