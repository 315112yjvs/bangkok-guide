import type { Metadata } from 'next'
import Link from 'next/link'
import { readCardLocations } from '@/lib/data'
import { CATEGORY_META, listAreas } from '@/lib/collections'
import { THEMES } from '@/lib/themes'
import { PublicHomepage } from './PublicHomepage'

export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Page() {
  const locations = readCardLocations()
  const areas = listAreas(locations)
  const featured = locations.slice(0, 36)

  return (
    <>
      <PublicHomepage locations={locations} />

      {/* SEO: server-rendered content + internal links. Visually hidden so the
          app design is untouched, but gives crawlers real text and a link graph
          that the client-only homepage otherwise lacks. */}
      <section className="sr-only">
        <h1>曼谷人 BKK LOCAL — 住在曼谷的人推薦的在地私藏景點、美食與咖啡廳</h1>
        <p>
          住在曼谷的人告訴你最近在瘋什麼。每日更新的曼谷美食、咖啡廳、酒吧夜生活、購物、景點與飯店推薦，
          從 TikTok 爆紅地點到在地人才知道的隱藏巷弄，幫你避開觀光客陷阱，玩到真正有趣的曼谷。
        </p>

        <nav aria-label="依分類瀏覽">
          <h2>依分類瀏覽</h2>
          <ul>
            {Object.values(CATEGORY_META).map((c) => (
              <li key={c.slug}><Link href={`/category/${c.slug}`}>{c.h1Zh}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="主題玩法">
          <h2>主題玩法</h2>
          <ul>
            {THEMES.map((t) => (
              <li key={t.slug}><Link href={`/theme/${t.slug}`}>{t.h1Zh}</Link></li>
            ))}
          </ul>
        </nav>

        {areas.length > 0 && (
          <nav aria-label="依區域瀏覽">
            <h2>依區域瀏覽</h2>
            <ul>
              {areas.map((a) => (
                <li key={a.slug}><Link href={`/area/${a.slug}`}>{a.area} 美食咖啡廳推薦</Link></li>
              ))}
            </ul>
          </nav>
        )}

        <nav aria-label="精選地點">
          <h2>精選地點</h2>
          <ul>
            {featured.map((l) => (
              <li key={l.id}>
                <Link href={`/location/${l.slug ?? l.id}`}>{l.name_zh}（{l.name_en}）</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </>
  )
}
