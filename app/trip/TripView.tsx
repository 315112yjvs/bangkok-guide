'use client'
import Link from 'next/link'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Icon } from '@/components/icons/Icon'
import { TRIP_CONTACT_URL } from '@/lib/site'

const INCLUDES = [
  { icon: 'map', zh: ['每天的路線', '依地區排好順序，不用在曼谷東奔西跑'], en: ['Day-by-day route', 'Grouped by area so you are not crossing the city all day'] },
  { icon: 'utensils', zh: ['吃什麼、喝什麼', '餐廳和咖啡廳都附泰文店名，直接給司機看'], en: ['Where to eat', 'Restaurants and cafes with Thai names to show drivers'] },
  { icon: 'flower-2', zh: ['拜拜路線', '想拜哪幾尊、怎麼走最順、供品去哪買'], en: ['Temple route', 'Which shrines, in what order, and where to buy offerings'] },
  { icon: 'train-front', zh: ['交通怎麼搭', 'BTS、MRT、計程車、船，哪一段用哪一種最省時間'], en: ['Getting around', 'BTS, MRT, taxi or boat for each leg'] },
]

const STEPS = {
  zh: ['傳訊息告訴我：幾天、幾個人、大概預算、想做的事', '我依你的需求報價', '確認後，收到一份完整的行程'],
  en: ['Message me: how many days, how many people, budget, and what you want to do', 'I send you a quote', 'Once confirmed, you get the full itinerary'],
}

export function TripView() {
  const { lang, setLang } = useLanguage()
  const zh = lang === 'zh'
  const contact = (
    <a
      href={TRIP_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full lg:w-auto lg:px-10 py-3.5 bg-brand text-white font-bold text-[15px] rounded-lg hover:bg-brand-dark tap"
    >
      <Icon name="message-circle" size={18} strokeWidth={2} />
      {zh ? '傳訊息問行程' : 'Message me'}
    </a>
  )

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto bg-white min-h-screen lg:border-x lg:border-line">
      <div className="border-b border-line px-4 pt-5 pb-7 lg:px-10 lg:pt-8 lg:pb-10">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-1.5 text-muted hover:text-ink text-sm transition-colors">
            <Icon name="arrow-left" size={16} strokeWidth={2} />
            {zh ? '曼谷人' : 'BKK LOCAL'}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} tone="light" />
        </div>
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-brand tracking-[0.08em] mb-2">
          <Icon name="route" size={15} strokeWidth={2} /> {zh ? '客製行程' : 'CUSTOM TRIP'}
        </p>
        <h1 className="font-liufen text-[30px] lg:text-[40px] text-ink leading-tight mb-3">
          {zh ? '曼谷行程，幫你排好' : 'Your Bangkok trip, planned'}
        </h1>
        <p className="text-[15px] text-ink/80 leading-relaxed mb-6">
          {zh
            ? '住在曼谷的人，依你的天數、預算和喜好，排一份真的走得完的行程。網站上的店都是我挑過的，行程也一樣。'
            : 'A Bangkok local plans a trip around your days, budget and taste. Every place on this site was hand-picked, and so is every stop on your itinerary.'}
        </p>
        {contact}
      </div>

      <div className="px-4 lg:px-10 py-7 border-b border-line">
        <h2 className="text-[12px] font-bold text-muted tracking-[0.08em] mb-4">{zh ? '行程裡有什麼' : 'WHAT YOU GET'}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {INCLUDES.map((it) => {
            const [title, desc] = zh ? it.zh : it.en
            return (
              <div key={it.icon} className="flex gap-3">
                <span className="shrink-0 w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                  <Icon name={it.icon} size={19} />
                </span>
                <div>
                  <p className="text-[15px] font-bold text-ink">{title}</p>
                  <p className="text-[14px] text-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 lg:px-10 py-7">
        <h2 className="text-[12px] font-bold text-muted tracking-[0.08em] mb-4">{zh ? '怎麼進行' : 'HOW IT WORKS'}</h2>
        <ol className="space-y-3 mb-7">
          {STEPS[lang].map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-ink/85 leading-[1.7]">
              <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-brand text-white text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-muted mb-4">{zh ? '費用依天數與需求報價。' : 'Pricing depends on trip length and what you need.'}</p>
        {contact}
      </div>
    </div>
  )
}
