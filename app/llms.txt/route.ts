import { readVisibleLocations } from '@/lib/data'
import { CATEGORY_META, listAreas } from '@/lib/collections'
import { THEMES } from '@/lib/themes'
import { TEMPLE_ROUTES } from '@/lib/templeRoutes'
import { INSTAGRAM_URL } from '@/lib/site'
import { SITE_URL } from '@/lib/jsonLd'

export const revalidate = 86400

// 給 AI 看的網站簡介（llms.txt 慣例格式：Markdown，標題、一段摘要、各區連結）
export function GET() {
  const locations = readVisibleLocations()
  const lines = [
    '# 曼谷人 BKK LOCAL',
    '',
    `> 住在曼谷的台灣人整理的曼谷在地指南，繁體中文。收錄 ${locations.length} 家住在曼谷的人自己會去的餐廳、咖啡廳、寺廟與景點，每家都有地址、最近的捷運站、營業時間與介紹。`,
    '',
    `站主會親自去店裡拍影片，有拍過的店頁面會標示「曼谷人拍過」並附上影片。IG：${INSTAGRAM_URL}`,
    '',
    '## 分類',
    ...Object.values(CATEGORY_META).map((c) => `- [${c.h1Zh}](${SITE_URL}/category/${c.slug}): ${c.descZh}`),
    '',
    '## 主題',
    ...THEMES.map((t) => `- [${t.h1Zh}](${SITE_URL}/theme/${t.slug}): ${t.descZh}`),
    '',
    '## 拜拜路線',
    ...TEMPLE_ROUTES.map((r) => `- [${r.title_zh}](${SITE_URL}/guide/${r.slug}): ${r.duration_zh}`),
    '',
    '## 區域',
    ...listAreas(locations).map((a) => `- [${a.area}](${SITE_URL}/area/${a.slug}): ${a.count} 家`),
    '',
    '## 其他',
    `- [曼谷日記](${SITE_URL}/diary)`,
    `- [網站地圖](${SITE_URL}/sitemap.xml): 所有店家頁面`,
    '',
  ]
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
