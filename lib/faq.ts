import type { Location } from './types'
import type { OpeningHours } from './placeInfo'
import type { NearestStation } from './transit'

export type Faq = { q: string; a: string }

const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

// 把每週營業時間合併成一句話，例如「週二至週日 08:00–18:00；週一公休」
export function weekHoursZh(hours: OpeningHours): string {
  if (hours.week === 'always') return '24 小時營業'
  const text = hours.week.map((d) => (d.length ? d.join('、') : '公休'))
  const rows: { from: number; to: number; t: string }[] = []
  text.forEach((t, i) => {
    const last = rows[rows.length - 1]
    if (last && last.t === t && last.to === i - 1) last.to = i
    else rows.push({ from: i, to: i, t })
  })
  return rows
    .map((r) => {
      const days = r.from === r.to ? DAYS[r.from] : `${DAYS[r.from]}至${DAYS[r.to]}`
      return r.t === '公休' ? `${days}公休` : `${days} ${r.t}`
    })
    .join('；')
}

const PRICE_ZH: Record<number, string> = {
  1: '平價（฿），一個人花不多',
  2: '中等價位（฿฿）',
  3: '偏高（฿฿฿），適合特別的一餐',
  4: '高價位（฿฿฿฿）',
}

// 地點頁的常見問題：全部由現有資料產生，沒有資料的題目就不出現
export function buildFaq(loc: Location, hours: OpeningHours | null, station: NearestStation | null): Faq[] {
  const name = loc.name_zh || loc.name_en
  const faq: Faq[] = []

  if (station || loc.address) {
    const sys = station?.sys === 'ARL' ? '機場快線' : station?.sys
    const how = station
      ? `搭 ${sys} 到 ${station.name} 站，步行約 ${station.walkMinutes} 分鐘（直線約 ${station.meters} 公尺）。`
      : '附近沒有走路能到的捷運站，建議搭計程車或 Grab。'
    faq.push({ q: `${name}怎麼去？`, a: how + (loc.address ? `地址：${loc.address}` : '') })
  }

  if (hours) {
    faq.push({ q: `${name}營業時間幾點？`, a: `${weekHoursZh(hours)}。資料取自 Google 地圖，節日可能調整，出發前建議再確認。` })
  }

  if (loc.price_range > 0 && loc.category !== 'temple' && PRICE_ZH[loc.price_range]) {
    faq.push({ q: `${name}大概要花多少錢？`, a: `${PRICE_ZH[loc.price_range]}。` })
  }

  if (loc.curator_note) {
    faq.push({ q: `住在曼谷的人怎麼看${name}？`, a: loc.curator_note })
  }

  return faq
}

export function faqJsonLd(faq: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}
