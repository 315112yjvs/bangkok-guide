// 拜拜路線：把走路可以串起來的幾間廟排成順序，每站附一句怎麼走、要準備什麼。
export type TempleRoute = {
  slug: string
  title_zh: string
  short_zh: string        // 卡片、入口用的短標題
  intro_zh: string
  start_zh: string        // 怎麼到起點
  duration_zh: string
  stops: { id: string; note_zh: string }[]
  tips_zh: string[]
}

export const TEMPLE_ROUTES: TempleRoute[] = [
  {
    slug: 'ratchaprasong',
    title_zh: 'Ratchaprasong 拜拜路線：五尊神走路一次拜完',
    short_zh: 'Ratchaprasong 五尊神一次拜完',
    intro_zh: '四面佛所在的 Ratchaprasong 路口一帶，走路幾分鐘內就有五尊神：四面佛、帝釋天、吉祥天女、愛神、象神。照這個順序走，不用回頭，最後停在 Central World，拜完直接逛街吃飯。',
    start_zh: 'BTS Chit Lom 站下車，走空橋往 Ratchaprasong 方向，下樓就是四面佛。',
    duration_zh: '走路約 15 分鐘，加上參拜大約 1 到 1.5 小時',
    stops: [
      { id: '8765f13a-30e7-49bc-aafc-833010a260e2', note_zh: '起點。在入口櫃檯買整套供品，從正面開始順時針拜四面。' },
      { id: 'bcc02e1b-c564-46ad-9842-642842f963cd', note_zh: '出四面佛沿 Ploenchit 路往東走兩三分鐘，在 InterContinental 飯店門口。' },
      { id: 'b34ba8a7-afc9-4567-bb0e-22af1b6f96bc', note_zh: '往回走進 Gaysorn，搭電梯上樓到戶外平台。樓上沒有賣供品，建議在四面佛那邊先買好。' },
      { id: 'c2971c85-bb20-4916-8840-063f9503be13', note_zh: '走空橋或過 Ratchaprasong 路口往北，Central World 正門前廣場。紅玫瑰在旁邊攤位買。' },
      { id: 'a4d13909-1ef2-41b1-accf-36e1967b26c6', note_zh: '就在愛神旁邊幾步路，準備香蕉、甜點或花環。' },
    ],
    tips_zh: [
      '供品可以每站分開買，也可以在四面佛一次買齊',
      '想求愛情的人常在週四晚上來，愛神那站會比較擠',
      '白天很熱，可以走 BTS 空橋，不用一直過馬路',
      '每一站都說清楚自己的名字和生日再許願',
    ],
  },
]

export function routeOfStop(id: string): { route: TempleRoute; index: number } | null {
  for (const route of TEMPLE_ROUTES) {
    const index = route.stops.findIndex((s) => s.id === id)
    if (index !== -1) return { route, index }
  }
  return null
}
