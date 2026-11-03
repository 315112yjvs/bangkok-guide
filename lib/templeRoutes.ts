import routes from '@/data/temple-routes.json'

// 拜拜路線：把走路可以串起來的幾間廟排成順序，每站附一句怎麼走、要準備什麼。
export type TempleRoute = {
  slug: string
  title_zh: string
  short_zh: string        // 卡片、入口用的短標題
  intro_zh: string
  start_zh: string        // 怎麼到起點
  duration_zh: string
  stops: { id: string; note_zh: string; note_en: string }[]
  tips_zh: string[]
  // 英文介面用
  title_en: string
  short_en: string
  intro_en: string
  start_en: string
  duration_en: string
  tips_en: string[]
}

// 路線內容存在 data/temple-routes.json，後台「拜拜」區可以編輯
export const TEMPLE_ROUTES = routes as TempleRoute[]

export function routeOfStop(id: string): { route: TempleRoute; index: number } | null {
  for (const route of TEMPLE_ROUTES) {
    const index = route.stops.findIndex((s) => s.id === id)
    if (index !== -1) return { route, index }
  }
  return null
}
