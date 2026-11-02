import type { TempleInfo } from '@/lib/types'
import type { Lang } from '@/lib/i18n'

// 拜拜頁專屬：神明、求什麼、怎麼拜、供品、注意事項、泰文小知識。內容只有中文版。
export function TempleGuide({ temple, lang, sectionTitle }: { temple: TempleInfo; lang: Lang; sectionTitle: string }) {
  const zh = lang === 'zh'
  return (
    <>
      <div className="mb-6 rounded-lg bg-paper border border-line p-4">
        <p className="text-[11px] font-bold text-brand tracking-wide mb-1">{zh ? '主祀' : 'Deity'}</p>
        <p className="text-[16px] font-bold text-ink leading-snug">{temple.deity_zh}</p>
        {temple.hours_zh && <p className="text-[13px] text-muted mt-1.5">{temple.hours_zh}</p>}
      </div>

      <div className="mb-6">
        <h2 className={sectionTitle}>{zh ? '求什麼' : 'What to pray for'}</h2>
        <div className="flex flex-wrap gap-2">
          {temple.wishes_zh.map((w) => (
            <span key={w} className="text-[13px] text-ink border border-line px-2.5 py-1 rounded-sm">{w}</span>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className={sectionTitle}>{zh ? '怎麼拜' : 'How to pray'}</h2>
        <ol className="space-y-2.5">
          {temple.steps_zh.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] text-ink/85 leading-[1.7]">
              <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-brand text-white text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-6">
        <h2 className={sectionTitle}>{zh ? '供品' : 'Offerings'}</h2>
        <ul className="space-y-1.5">
          {temple.offerings_zh.map((o) => (
            <li key={o} className="text-[15px] text-ink/85 leading-[1.7] pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-brand">{o}</li>
          ))}
        </ul>
      </div>

      {(temple.tips_zh?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className={sectionTitle}>{zh ? '注意事項' : 'Good to know'}</h2>
          <ul className="space-y-1.5">
            {temple.tips_zh!.map((t) => (
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
                <dd className="text-[13px] text-ink/80 basis-full">{t.zh}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  )
}
