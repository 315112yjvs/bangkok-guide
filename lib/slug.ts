// 由英文店名產生網址用的 slug，例如 "ONDA cafe" → "onda-cafe"
export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/['"`’‘]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 給每筆地點一個唯一 slug：撞名加 -2/-3，純泰文等無英文名的用短 id 後備
export function buildSlugMap(locs: { id: string; name_en: string }[]): Map<string, string> {
  const used = new Map<string, number>()
  const map = new Map<string, string>()
  for (const l of locs) {
    let base = slugify(l.name_en)
    if (!base) base = `place-${l.id.slice(0, 8)}`
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    map.set(l.id, n === 0 ? base : `${base}-${n + 1}`)
  }
  return map
}
