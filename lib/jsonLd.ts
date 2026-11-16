import type { Location } from './types'
import { INSTAGRAM_URL } from './site'

export const SITE_URL = 'https://www.bkk-local.com'

// 安全地把 JSON-LD 嵌進 <script>：跳脫會破壞 script 標籤的字元，避免店名或描述含 </script> 造成 XSS
export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

// 首頁：網站與品牌，sameAs 連到 IG，讓搜尋引擎和 AI 知道網站和 IG 是同一個品牌
export function siteJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: '曼谷人',
      alternateName: 'BKK LOCAL',
      url: SITE_URL,
      logo: `${SITE_URL}/logo-circle.png`,
      sameAs: [INSTAGRAM_URL],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: '曼谷人',
      alternateName: 'BKK LOCAL',
      url: SITE_URL,
      inLanguage: 'zh-TW',
      publisher: { '@id': `${SITE_URL}/#org` },
    },
  ]
}

// 分類、區域、主題頁：店家清單（只放前 30 家，太長沒有幫助）
export function itemListJsonLd(name: string, path: string, locations: Location[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: `${SITE_URL}${path}`,
    numberOfItems: locations.length,
    itemListElement: locations.slice(0, 30).map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: l.name_zh || l.name_en,
      url: `${SITE_URL}/location/${l.slug ?? l.id}`,
    })),
  }
}
