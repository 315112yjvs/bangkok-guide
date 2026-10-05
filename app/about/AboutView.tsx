'use client'
import Link from 'next/link'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageToggle } from '@/components/LanguageToggle'

const COPY = {
  zh: {
    back: '曼谷人',
    title: '關於曼谷人',
    lead: '曼谷人（BKK LOCAL）是一份曼谷的口袋名單，以餐廳、咖啡廳和酒吧為主，由旅居泰國的台灣人整理。',
    sections: [
      {
        h: '店家是怎麼選進來的',
        items: [
          '來源有三種：泰國的社群貼文、當地媒體的新店報導，以及 Google 地圖上在地評價高的店。',
          '每一家都會對照 Google 地圖，確認仍在營業、位置正確，再經人工審核後才上架。',
          '介紹文字是根據公開的評論與報導整理而成，上架前經過人工審核。',
        ],
      },
      {
        h: '資料有多新',
        items: [
          '每家店的頁面底部會標示收錄月份。',
          '營業時間取自 Google 地圖，大約每個月更新一次。',
          '評分是收錄當時的 Google 評分，之後可能有變動。',
          '曼谷的店家異動很快，出發前建議點頁面上的「在 Google Maps 導航」再確認一次。',
        ],
      },
      {
        h: '「最近的車站」怎麼算',
        items: [
          '以店家到 BTS、MRT、機場快線車站的直線距離推估步行時間，實際路線可能比較遠。超過 1.5 公里就不顯示。',
        ],
      },
      {
        h: '資料來源',
        items: [
          '店家資訊、評分、營業時間與照片：Google Maps Platform。',
          '車站位置：© OpenStreetMap 貢獻者（ODbL 授權）。',
        ],
      },
    ],
  },
  en: {
    back: 'BKK LOCAL',
    title: 'About BKK LOCAL',
    lead: 'BKK LOCAL is a shortlist of places in Bangkok, mostly restaurants, cafes and bars, put together by a Taiwanese resident of Thailand.',
    sections: [
      {
        h: 'How places are chosen',
        items: [
          'Places come from three sources: Thai social media posts, local press coverage of new openings, and well-reviewed local spots on Google Maps.',
          'Each one is checked against Google Maps to confirm it is still operating and correctly located, then reviewed by a person before it is listed.',
          'Descriptions are compiled from public reviews and coverage, and reviewed before publishing.',
        ],
      },
      {
        h: 'How current the information is',
        items: [
          'Each place page shows the month it was listed.',
          'Opening hours come from Google Maps and refresh about once a month.',
          'Ratings are the Google rating at the time of listing and may have changed.',
          'Bangkok venues change quickly, so tap "Navigate with Google Maps" to double-check before you go.',
        ],
      },
      {
        h: 'How "nearest station" works',
        items: [
          'Walking time is estimated from the straight-line distance to the nearest BTS, MRT or Airport Rail Link station, so the real route may be longer. Stations more than 1.5 km away are not shown.',
        ],
      },
      {
        h: 'Data sources',
        items: [
          'Place details, ratings, opening hours and photos: Google Maps Platform.',
          'Station locations: © OpenStreetMap contributors (ODbL).',
        ],
      },
    ],
  },
}

export function AboutView() {
  const { lang, setLang } = useLanguage()
  const c = COPY[lang]
  return (
    <div className="max-w-md lg:max-w-3xl mx-auto bg-white min-h-screen lg:border-x lg:border-line">
      <div className="px-4 lg:px-10 pt-5 pb-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-1.5 text-muted hover:text-ink text-sm transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {c.back}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} tone="light" />
        </div>
        <h1 className="font-liufen text-[28px] lg:text-[36px] text-ink leading-tight mb-3">{c.title}</h1>
        <p className="text-[15px] text-ink/85 leading-[1.75] mb-8">{c.lead}</p>
        {c.sections.map((s) => (
          <section key={s.h} className="border-t border-line pt-5 mb-6">
            <h2 className="text-[16px] font-bold text-ink mb-2.5">{s.h}</h2>
            <ul className="space-y-2">
              {s.items.map((t) => (
                <li key={t} className="text-[14px] text-ink/80 leading-[1.7] pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-1.5 before:h-px before:bg-muted">{t}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
