import type { TempleInfo } from '@/lib/types'
import type { Lang } from '@/lib/i18n'

// 拜拜頁專屬：神明、求什麼、怎麼拜、供品、注意事項、泰文小知識。內容只有中文版。
export function TempleGuide({ temple, lang, sectionTitle }: { temple: TempleInfo; lang: Lang; sectionTitle: string }) {
  const zh = lang === 'zh'
  // 後台剛新增、還沒填參拜內容的廟先不顯示這一塊
  if (!temple.deity_zh) return null
  // 英文介面用英文欄位，沒填的退回中文
  const pick = <T,>(en: T | undefined, zhv: T): T => (!zh && en && (!Array.isArray(en) || en.length) ? en : zhv)
  const deity = pick(temple.deity_en, temple.deity_zh)
  const hours = pick(temple.hours_en, temple.hours_zh)
  const wishes = pick(temple.wishes_en, temple.wishes_zh)
  const steps = pick(temple.steps_en, temple.steps_zh)
  const offerings = pick(temple.offerings_en, temple.offerings_zh)
  const tips = pick(temple.tips_en, temple.tips_zh ?? [])
  return (
    <>
      <div className="mb-6 rounded-lg bg-paper border border-line p-4">
        <p className="text-[11px] font-bold text-brand tracking-wide mb-1">{zh ? '主祀' : 'Deity'}</p>
        <p className="text-[16px] font-bold text-ink leading-snug">{deity}</p>
        {hours && <p className="text-[13px] text-muted mt-1.5">{hours}</p>}
      </div>

      <div className="mb-6">
        <h2 className={sectionTitle}>{zh ? '求什麼' : 'What to pray for'}</h2>
        {/* 一段文字敘述（換行就分段） */}
        <div className="space-y-2">
          {wishes.map((w) => (
            <p key={w} className="text-[15px] text-ink/85 leading-[1.75]">{w}</p>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className={sectionTitle}>{zh ? '怎麼拜' : 'How to pray'}</h2>
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-ink/85 leading-[1.7]">
              <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-brand text-white text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-6">
        <h2 className={sectionTitle}>{zh ? '供品' : 'Offerings'}</h2>
        <div className="space-y-2">
          {offerings.map((o) => (
            <p key={o} className="text-[15px] text-ink/85 leading-[1.75]">{o}</p>
          ))}
        </div>
      </div>

      {tips.length > 0 && (
        <div className="mb-6">
          <h2 className={sectionTitle}>{zh ? '注意事項' : 'Good to know'}</h2>
          <ul className="space-y-1.5">
            {tips.map((t) => (
              <li key={t} className="text-[14px] text-ink/80 leading-[1.7] pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-muted">{t}</li>
            ))}
          </ul>
        </div>
      )}

      {(temple.thai?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className={sectionTitle}>{zh ? '泰文小知識' : 'Thai words'}</h2>
          <dl className="divide-y divide-line border-y border-line">
            {temple.thai!.map((t) => (
              <div key={t.th} className="py-2.5 flex items-baseline gap-3 flex-wrap">
                <dt className="text-[17px] text-ink">{t.th}</dt>
                <dd className="text-[13px] text-muted">{t.read}</dd>
                <dd className="text-[13px] text-ink/80 basis-full">{!zh && t.en ? t.en : t.zh}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  )
}
