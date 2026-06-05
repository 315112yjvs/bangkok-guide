import { NextResponse } from 'next/server'
import { readLocations, writeLocations } from '@/lib/data'
import { readPending, writePending } from '@/lib/data'
import { translateZhToEn } from '@/scrapers/translate'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST() {
  const locations = readLocations()
  const pending = readPending()

  let updated = 0

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    if (!loc.description_zh) continue
    try {
      const en = await translateZhToEn(loc.description_zh)
      if (en && en !== loc.description_zh) {
        locations[i] = { ...loc, description_en: en }
        updated++
      }
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 100))
  }
  writeLocations(locations)

  for (let i = 0; i < pending.length; i++) {
    const loc = pending[i]
    if (!loc.description_zh) continue
    try {
      const en = await translateZhToEn(loc.description_zh)
      if (en && en !== loc.description_zh) {
        pending[i] = { ...loc, description_en: en }
        updated++
      }
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 100))
  }
  writePending(pending)

  return NextResponse.json({ ok: true, updated })
}
