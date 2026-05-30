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
