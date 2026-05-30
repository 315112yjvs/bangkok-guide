import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Location, PendingLocation } from './types'

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
  return JSON.parse(readFileSync(locPath(), 'utf-8'))
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
