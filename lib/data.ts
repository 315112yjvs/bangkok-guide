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
