import { NextResponse } from 'next/server'
import { readLocations, writeLocations } from '@/lib/data'
import { buildDescZh, buildDescEn, cleanHighlights } from '@/lib/buildDescriptions'

export const runtime = 'nodejs'

export async function POST() {
  const locations = readLocations()
  let updated = 0

  const next = locations.map((loc) => {
    const highlights = cleanHighlights(loc.highlights)

    // Only rebuild if description is still generic
    const isGenericZh = !loc.description_zh || loc.description_zh.startsWith('曼谷人氣') || loc.description_zh.startsWith('曼谷熱門') || loc.description_zh.startsWith('Highly')
    const isGenericEn = !loc.description_en || loc.description_en.startsWith('Highly recommended')

    const newZh = isGenericZh ? buildDescZh(loc, highlights) : loc.description_zh
    const newEn = isGenericEn ? buildDescEn(loc, highlights) : loc.description_en
    const hlChanged = JSON.stringify(highlights) !== JSON.stringify(loc.highlights ?? [])

    if (newZh !== loc.description_zh || newEn !== loc.description_en || hlChanged) {
      updated++
      return { ...loc, description_zh: newZh, description_en: newEn, highlights }
    }
    return loc
  })

  writeLocations(next)
  return NextResponse.json({ ok: true, updated, total: locations.length })
}
