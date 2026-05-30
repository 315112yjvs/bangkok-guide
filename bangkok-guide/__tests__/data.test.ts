import { readLocations, writeLocations, readPending, writePending } from '@/lib/data'
import { writeFileSync } from 'fs'
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
