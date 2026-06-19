import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Location, PendingLocation } from './types'
import { buildSlugMap } from './slug'

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
  return raw.map((l) => ({ ...l, slug: l.slug || slugMap.get(l.id) }))
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
    hashtags: undefined,
    social_embed_url: undefined,
    local_ratio: undefined,
    approved_at: undefined,
  }
}

export function readCardLocations(): Location[] {
  return readLocations().map(toCardLocation)
}

export function writeLocations(locations: Location[]): void {
  ensureFile(locPath(), '[]')
  writeFileSync(locPath(), JSON.stringify(locations, null, 2))
}

export function readPending(): PendingLocation[] {
  ensureFile(pendPath(), '[]')
  return JSON.parse(readFileSync(pendPath(), 'utf-8'))
}

export function writePending(pending: PendingLocation[]): void {
  ensureFile(pendPath(), '[]')
  writeFileSync(pendPath(), JSON.stringify(pending, null, 2))
}
