// 由每週營業時間算出「現在有沒有開」。純計算，瀏覽器和伺服器都能用。
// week：週一到週日各一個陣列，元素如 "11:00–22:00"；跨夜的時段（"18:00–02:00"）記在開門那天。

export type Week = string[][] | 'always'

export type OpenStatus =
  | { open: true; always: true }
  | { open: true; always: false; closesAt: string; closingSoon: boolean }
  | { open: false; opensAt: string; dayOffset: number; weekday: number }   // dayOffset：0 今天、1 明天…；weekday：0=週一
  | { open: false; opensAt: null }                                         // 整週都沒有營業時段

const DAY = 1440
const WEEK = DAY * 7

// 曼谷現在是這週的第幾分鐘（週一 00:00 = 0）。泰國固定 UTC+7、沒有日光節約時間。
export function bangkokMinuteOfWeek(now: Date = new Date()): number {
  const t = new Date(now.getTime() + 7 * 3600000)
  return ((t.getUTCDay() + 6) % 7) * DAY + t.getUTCHours() * 60 + t.getUTCMinutes()
}

const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
const toText = (min: number) => { const m = ((min % DAY) + DAY) % DAY; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

export function openStatus(week: Week, minuteOfWeek: number): OpenStatus {
  if (week === 'always') return { open: true, always: true }
  let spans: [number, number][] = []
  week.forEach((day, d) => {
    for (const s of day) {
      const [a, b] = s.split('–')
      const start = d * DAY + toMin(a)
      // 沒有打烊時間的時段當作開到當天結束
      let end = b ? d * DAY + toMin(b) : (d + 1) * DAY
      if (end <= start) end += DAY
      spans.push([start, end])
    }
  })
  if (!spans.length) return { open: false, opensAt: null }
  // 接在一起的時段併成一段（例如開到 24:00、隔天 00:00 又開），否則會顯示「00:00 打烊」
  spans.sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1])
    else merged.push([s[0], s[1]])
  }
  spans = merged
  if (spans.length === 1 && spans[0][1] - spans[0][0] >= WEEK) return { open: true, always: true }

  // 週日跨夜的時段會延伸到下週一，所以現在的時間用「本週」和「加一週」兩種位置各比一次
  for (const m of [minuteOfWeek, minuteOfWeek + WEEK]) {
    const hit = spans.find(([a, b]) => a <= m && m < b)
    if (hit) return { open: true, always: false, closesAt: toText(hit[1]), closingSoon: hit[1] - m <= 60 }
  }
  const next = spans.find(([a]) => a > minuteOfWeek) ?? [spans[0][0] + WEEK, 0]
  const today = Math.floor(minuteOfWeek / DAY)
  const day = Math.floor(next[0] / DAY)
  return { open: false, opensAt: toText(next[0]), dayOffset: day - today, weekday: day % 7 }
}

const WD = { zh: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }

export function openStatusText(s: OpenStatus, lang: 'zh' | 'en'): string {
  const zh = lang === 'zh'
  if (s.open) {
    if (s.always) return zh ? '24 小時營業' : 'Open 24 hours'
    return zh ? `營業中，${s.closesAt} 打烊` : `Open until ${s.closesAt}`
  }
  if (!s.opensAt) return zh ? '目前沒有營業' : 'Closed'
  const when = s.dayOffset === 0 ? (zh ? '今天' : 'today') : s.dayOffset === 1 ? (zh ? '明天' : 'tomorrow') : WD[lang][s.weekday]
  return zh ? `休息中，${when} ${s.opensAt} 開` : `Closed, opens ${when} ${s.opensAt}`
}

// 拆成「標籤」和「說明」兩段：標籤放在色塊裡（營業中綠、快打烊黃、休息中灰），說明用一般文字
export function openStatusParts(s: OpenStatus, lang: 'zh' | 'en'): { label: string; detail: string; bg: string } {
  const zh = lang === 'zh'
  if (s.open) {
    if (s.always) return { label: zh ? '24 小時營業' : 'Open 24 hours', detail: '', bg: 'bg-matcha' }
    return {
      label: s.closingSoon ? (zh ? '快打烊' : 'Closing soon') : (zh ? '營業中' : 'Open'),
      detail: zh ? `${s.closesAt} 打烊` : `until ${s.closesAt}`,
      bg: s.closingSoon ? 'bg-mustard' : 'bg-matcha',
    }
  }
  if (!s.opensAt) return { label: zh ? '目前沒有營業' : 'Closed', detail: '', bg: 'bg-line' }
  const when = s.dayOffset === 0 ? (zh ? '今天' : 'today') : s.dayOffset === 1 ? (zh ? '明天' : 'tomorrow') : WD[lang][s.weekday]
  return { label: zh ? '休息中' : 'Closed', detail: zh ? `${when} ${s.opensAt} 開` : `opens ${when} ${s.opensAt}`, bg: 'bg-line' }
}
