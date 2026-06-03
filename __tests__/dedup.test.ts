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
}

describe('isDuplicate', () => {
  it('returns true for exact name match', () => {
    expect(isDuplicate({ name_en: 'Jay Fai' }, [base])).toBe(true)
  })

  it('returns true for case-insensitive match', () => {
    expect(isDuplicate({ name_en: 'jay fai' }, [base])).toBe(true)
  })

  it('returns true for partial match (>= 80% similarity)', () => {
    expect(isDuplicate({ name_en: 'Jay Fay' }, [base])).toBe(true)
  })

  it('returns false for unrelated name', () => {
    expect(isDuplicate({ name_en: 'Chatuchak Market' }, [base])).toBe(false)
  })

  it('returns false for empty existing array', () => {
    expect(isDuplicate({ name_en: 'Jay Fai' }, [])).toBe(false)
  })

  it('returns false when candidate name_en is empty string', () => {
    expect(isDuplicate({ name_en: '' }, [base])).toBe(false)
  })
})
