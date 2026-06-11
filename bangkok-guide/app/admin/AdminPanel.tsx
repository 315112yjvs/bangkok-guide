'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import type { Location, PendingLocation, Category, Source, LocationTag } from '@/lib/types'

type Tab = 'pending' | 'approved' | 'add'

const SOURCE_LABEL: Record<Source, string> = {
  tiktok: 'TikTok', instagram: 'IG', pantip: 'Pantip',
  wongnai: 'Wongnai', googlemaps: 'Google Maps', manual: '手動新增',
}
const SOURCE_STYLE: Record<Source, string> = {
  tiktok: 'bg-green-50 text-green-700 border-green-200',
  instagram: 'bg-purple-50 text-purple-700 border-purple-200',
  pantip: 'bg-orange-50 text-orange-700 border-orange-200',
  wongnai: 'bg-red-50 text-red-700 border-red-200',
  googlemaps: 'bg-blue-50 text-blue-700 border-blue-200',
  manual: 'bg-gray-50 text-gray-600 border-gray-200',
}

const TAG_OPTIONS: { value: LocationTag; emoji: string; zh: string; hint: string }[] = [
  { value: 'trending',    emoji: '🔥', zh: '本週熱門', hint: '社群正在瘋傳，高流量話題' },
  { value: 'hidden_gem',  emoji: '🗺', zh: '在地私藏', hint: '在地人才知道，觀光客少' },
  { value: 'new_opening', emoji: '✨', zh: '新開幕',   hint: '近期開幕，新鮮值得嘗試' },
]

function resolveTag(item: Location | PendingLocation): LocationTag {
  if ('tag' in item && item.tag) return item.tag as LocationTag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((item as any).trending === true) return 'trending'
  return 'evergreen'
}

// Scoring widget — helper only, not persisted
function ScoringWidget() {
  const [scores, setScores] = useState({ social: 0, verified: 0, recency: 0, utility: 0 })
  const total = scores.social + scores.verified + scores.recency + scores.utility
  const criteria = [
    { key: 'social',   label: '社群訊號', max: 40, hint: '被多少帳號提及、互動量' },
    { key: 'verified', label: '親身確認', max: 30, hint: '你親自去過 / 有可信照片' },
    { key: 'recency',  label: '時效性',   max: 20, hint: '近3個月有提及' },
    { key: 'utility',  label: '旅客實用', max: 10, hint: '台灣人容易抵達、合適' },
  ] as const
  const getTag = (): LocationTag => {
    if (total >= 70) return 'trending'
    if (total >= 50 && scores.social <= 20) return 'hidden_gem'
    if (scores.recency >= 15) return 'new_opening'
    return 'evergreen'
  }
  const suggestedTag = TAG_OPTIONS.find(t => t.value === getTag())!
  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-white mt-2">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">評分輔助工具</p>
      <div className="space-y-1.5">
        {criteria.map(({ key, label, max, hint }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-semibold text-gray-600">{label} <span className="text-gray-300">({hint})</span></span>
              <span className="text-[10px] font-bold text-gray-500">{scores[key]}/{max}</span>
            </div>
            <input
              type="range" min={0} max={max} value={scores[key]}
              onChange={e => setScores(s => ({ ...s, [key]: Number(e.target.value) }))}
              className="w-full h-1.5 accent-indigo-500"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] font-black text-gray-700">總分 {total}/100</span>
        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
          建議：{suggestedTag.emoji} {suggestedTag.zh}
        </span>
      </div>
    </div>
  )
}

// ---- AUTH OVERLAY ----
function AuthOverlay({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    if (res.ok) {
      sessionStorage.setItem('admin_authed', '1')
      onAuth()
    } else {
      setErr(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
        <h1 className="text-xl font-black text-[#0f172a] mb-1">曼谷人</h1>
        <p className="text-sm text-gray-400 mb-6">BKK LOCAL Admin</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false) }}
          placeholder="輸入密碼"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 mb-3"
        />
        {err && <p className="text-xs text-red-500 mb-3">密碼錯誤</p>}
        <button type="submit" className="w-full bg-[#0f172a] text-white rounded-xl py-3 text-sm font-bold">
          登入
        </button>
      </form>
    </div>
  )
}

// ---- PENDING CARD ----
function PendingCard({
  item,
  onApprove,
  onReject,
  onUpdate,
}: {
  item: PendingLocation
  onApprove: (id: string, category: Category, tag: LocationTag) => void
  onReject: (id: string) => void
  onUpdate: (id: string, updates: Partial<PendingLocation>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [showScoring, setShowScoring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggestingNote, setSuggestingNote] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [webGenerating, setWebGenerating] = useState(false)
  const [form, setForm] = useState({
    name_zh: item.name_zh || '',
    name_en: item.name_en,
    description_zh: item.description_zh || '',
    description_en: item.description_en || '',
    category: (item.category as Category) || 'food' as Category,
    tag: resolveTag(item),
    rating: item.rating,
    price_range: item.price_range,
    area: (item as PendingLocation & { area?: string }).area ?? '',
    address: item.address,
    highlights: (item.highlights ?? []).join(', '),
    curator_note: item.curator_note ?? '',
    social_embed_url: item.social_embed_url ?? '',
  })

  const raw = item.photos[0] ?? ''
  const photo = raw.startsWith('places/')
    ? `https://places.googleapis.com/v1/${raw}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : raw || 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=220&h=120&fit=crop'

  async function save() {
    setSaving(true)
    const updates = {
      ...form,
      highlights: form.highlights ? form.highlights.split(',').map(s => s.trim()).filter(Boolean) : [],
      price_range: Number(form.price_range) as 1|2|3|4,
      rating: Number(form.rating),
      curator_note: form.curator_note || undefined,
      social_embed_url: form.social_embed_url || undefined,
    }
    await fetch('/api/pending', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, ...updates }),
    })
    onUpdate(item.id, updates)
    setSaving(false)
    setEditing(false)
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400'

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-transparent hover:border-indigo-200 transition-colors">
      <div className="flex">
        <div className="relative w-28 shrink-0">
          <Image src={photo} alt={item.name_en} fill className="object-cover" sizes="112px" />
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-[#0f172a] text-sm leading-tight">{form.name_zh || form.name_en}</h3>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${SOURCE_STYLE[item.source]}`}>
              {SOURCE_LABEL[item.source]}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{form.category}</span>
            <span className="text-[10px] font-bold text-amber-500">★ {Number(form.rating).toFixed(1)}</span>
            <span className="text-[10px] text-gray-400 truncate">{form.address}</span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{form.description_zh || form.description_en}</p>

          {/* Inline tag picker */}
          <div className="flex gap-1 mb-2.5 flex-wrap">
            {TAG_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => setForm(f => ({ ...f, tag: t.value }))}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  form.tag === t.value
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'
                }`}
              >
                {t.emoji} {t.zh}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            {item.source_url ? (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 underline truncate max-w-[120px]">
                {item.source_url.replace(/^https?:\/\//, '')}
              </a>
            ) : <span />}
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => setShowScoring(!showScoring)} title="評分輔助" className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors">
                📊
              </button>
              <button onClick={() => setEditing(!editing)} title="編輯" className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                ✏️
              </button>
              <button onClick={() => onReject(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                駁回
              </button>
              <button onClick={() => onApprove(item.id, form.category, form.tag)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700">
                上架
              </button>
            </div>
          </div>
        </div>
      </div>

      {showScoring && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-3 bg-gray-50">
          <ScoringWidget />
        </div>
      )}

      {editing && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">中文名稱</p><input className={inp} value={form.name_zh} onChange={e => setForm(f => ({...f, name_zh: e.target.value}))} /></div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">English Name</p><input className={inp} value={form.name_en} onChange={e => setForm(f => ({...f, name_en: e.target.value}))} /></div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-gray-500">中文描述</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={webGenerating || regenerating}
                    onClick={async () => {
                      setWebGenerating(true)
                      try {
                        const res = await fetch('/api/generate-description', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name_en: form.name_en,
                            address: form.address,
                            source_url: item.source_url,
                            category: form.category,
                          }),
                        })
                        const data = await res.json()
                        if (res.ok && data.description_zh) {
                          setForm(f => ({
                            ...f,
                            description_zh: data.description_zh,
                            description_en: data.description_en || f.description_en,
                          }))
                        } else {
                          alert('生成失敗：' + (data.error ?? '未知錯誤'))
                        }
                      } catch (e) {
                        alert('生成失敗：' + (e instanceof Error ? e.message : String(e)))
                      }
                      setWebGenerating(false)
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    {webGenerating ? '查證中...' : '🌐 上網查證生成'}
                  </button>
                  <button
                    type="button"
                    disabled={regenerating || webGenerating}
                    onClick={async () => {
                      setRegenerating(true)
                      const res = await fetch('/api/quickimport', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: form.name_en, mapsUrl: item.source_url, category: form.category }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setForm(f => ({
                          ...f,
                          description_zh: data.description_zh ?? f.description_zh,
                          description_en: data.description_en ?? f.description_en,
                          highlights: (data.highlights ?? []).join(', ') || f.highlights,
                          category: data.category ?? f.category,
                        }))
                      }
                      setRegenerating(false)
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                  >
                    {regenerating ? '生成中...' : '🔄 快速重生成'}
                  </button>
                </div>
              </div>
              <textarea className={inp} rows={2} value={form.description_zh} onChange={e => setForm(f => ({...f, description_zh: e.target.value}))} />
            </div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">English Description</p><textarea className={inp} rows={2} value={form.description_en} onChange={e => setForm(f => ({...f, description_en: e.target.value}))} /></div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1">分類</p>
              <select className={inp} value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value as Category}))}>
                {(['food','cafe','shopping','nightlife','hotel','attraction'] as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-indigo-600 mb-1">標籤分類</p>
              <select className={inp} value={form.tag} onChange={e => setForm(f => ({...f, tag: e.target.value as LocationTag}))}>
                {TAG_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.zh}</option>)}
              </select>
            </div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">評分</p><input type="number" min="0" max="5" step="0.1" className={inp} value={form.rating} onChange={e => setForm(f => ({...f, rating: Number(e.target.value)}))} /></div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1">價位 (1–4)</p>
              <select className={inp} value={form.price_range} onChange={e => setForm(f => ({...f, price_range: Number(e.target.value) as 1|2|3|4}))}>
                {[1,2,3,4].map(n => <option key={n} value={n}>{'$'.repeat(n)}</option>)}
              </select>
            </div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">區域</p><input className={inp} placeholder="e.g. Thonglor" value={form.area ?? ''} onChange={e => setForm(f => ({...f, area: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">地址</p><input className={inp} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">亮點（逗號分隔）</p><input className={inp} value={form.highlights} onChange={e => setForm(f => ({...f, highlights: e.target.value}))} /></div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-indigo-500">💬 在地人怎麼說（選填）</p>
                <button
                  type="button"
                  disabled={suggestingNote}
                  onClick={async () => {
                    setSuggestingNote(true)
                    const res = await fetch('/api/suggest-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name_en: form.name_en, description_zh: form.description_zh }) })
                    const { note } = await res.json()
                    if (note) setForm(f => ({ ...f, curator_note: note }))
                    setSuggestingNote(false)
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                >
                  {suggestingNote ? 'AI 生成中...' : '✨ AI 建議'}
                </button>
              </div>
              <textarea className={inp} rows={2} placeholder="你自己的觀察，1–2句即可" value={form.curator_note} onChange={e => setForm(f => ({...f, curator_note: e.target.value}))} />
            </div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">社群貼文 URL（TikTok / IG）</p><input className={inp} value={form.social_embed_url} onChange={e => setForm(f => ({...f, social_embed_url: e.target.value}))} placeholder="https://www.tiktok.com/..." /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="flex-1 bg-[#0f172a] text-white text-xs font-bold rounded-xl py-2 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 bg-gray-200 text-gray-600 text-xs font-bold rounded-xl py-2">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- APPROVED CARD ----
function ApprovedCard({ item, onRemove, onUpdate }: {
  item: Location
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: Partial<Location>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name_zh: item.name_zh,
    name_en: item.name_en,
    name_th: item.name_th ?? '',
    description_zh: item.description_zh,
    description_en: item.description_en,
    address: item.address,
    address_th: item.address_th ?? '',
    rating: item.rating,
    price_range: item.price_range,
    highlights: (item.highlights ?? []).join(', '),
    hashtags: (item.hashtags ?? []).join(', '),
    local_ratio: item.local_ratio?.toString() ?? '',
    source: item.source,
    source_url: item.source_url,
    social_embed_url: item.social_embed_url ?? '',
  })
  const [saving, setSaving] = useState(false)

  const raw = item.photos[0] ?? ''
  const photo = raw.startsWith('places/')
    ? `https://places.googleapis.com/v1/${raw}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : raw || 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=220&h=120&fit=crop'

  async function save() {
    setSaving(true)
    const updates: Partial<Location> = {
      ...form,
      highlights: form.highlights ? form.highlights.split(',').map(s => s.trim()).filter(Boolean) : [],
      hashtags: form.hashtags ? form.hashtags.split(',').map(s => s.trim()).filter(Boolean) : [],
      local_ratio: form.local_ratio !== '' ? Number(form.local_ratio) : undefined,
      price_range: Number(form.price_range) as 1|2|3|4,
      rating: Number(form.rating),
      source: form.source as Source,
      social_embed_url: form.social_embed_url || undefined,
    }
    await onUpdate(item.id, updates)
    setSaving(false)
    setEditing(false)
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400'

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-transparent hover:border-slate-200 transition-colors">
      <div className="flex">
        <div className="relative w-20 shrink-0">
          <Image src={photo} alt={item.name_en} fill className="object-cover" sizes="80px" unoptimized={raw.startsWith('places/')} />
        </div>
        <div className="flex-1 p-3 flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-[#0f172a] truncate">{item.name_zh || item.name_en}</h3>
              <span className="text-[10px]">{TAG_OPTIONS.find(t => t.value === resolveTag(item))?.emoji}</span>
            </div>
            <p className="text-[10px] text-gray-400">{item.category} · ★ {item.rating}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={resolveTag(item)}
              onChange={e => onUpdate(item.id, { tag: e.target.value as LocationTag })}
              className="text-[10px] font-bold border border-gray-200 rounded-lg px-1.5 py-1 outline-none focus:border-indigo-400 bg-white"
            >
              {TAG_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.zh}</option>)}
            </select>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs font-bold px-2 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              ✏️
            </button>
            <button
              onClick={() => { if (confirm(`確定下架「${item.name_zh || item.name_en}」？`)) onRemove(item.id) }}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              下架
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">中文名稱</p><input className={inp} value={form.name_zh} onChange={e => setForm(f => ({...f, name_zh: e.target.value}))} /></div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">English Name</p><input className={inp} value={form.name_en} onChange={e => setForm(f => ({...f, name_en: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">泰文店名</p><input className={inp} value={form.name_th} onChange={e => setForm(f => ({...f, name_th: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">中文描述</p><textarea className={inp} rows={2} value={form.description_zh} onChange={e => setForm(f => ({...f, description_zh: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">English Description</p><textarea className={inp} rows={2} value={form.description_en} onChange={e => setForm(f => ({...f, description_en: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">地址</p><input className={inp} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">泰文地址</p><input className={inp} value={form.address_th} onChange={e => setForm(f => ({...f, address_th: e.target.value}))} /></div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1">來源</p>
              <select className={inp} value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value as Source}))}>
                {(['googlemaps','tiktok','instagram','pantip','wongnai','manual'] as Source[]).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </select>
            </div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">評分</p><input type="number" min="0" max="5" step="0.1" className={inp} value={form.rating} onChange={e => setForm(f => ({...f, rating: Number(e.target.value)}))} /></div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">價位 (1–4)</p><input type="number" min="1" max="4" className={inp} value={form.price_range} onChange={e => setForm(f => ({...f, price_range: e.target.value as unknown as 1|2|3|4}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">亮點（逗號分隔）</p><input className={inp} value={form.highlights} onChange={e => setForm(f => ({...f, highlights: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">Hashtags（逗號分隔）</p><input className={inp} value={form.hashtags} onChange={e => setForm(f => ({...f, hashtags: e.target.value}))} /></div>
            <div><p className="text-[10px] font-semibold text-gray-500 mb-1">在地客 %</p><input type="number" min="0" max="100" className={inp} value={form.local_ratio} onChange={e => setForm(f => ({...f, local_ratio: e.target.value}))} /></div>
            <div className="col-span-2"><p className="text-[10px] font-semibold text-gray-500 mb-1">社群貼文 URL（TikTok / Instagram）</p><input className={inp} value={form.social_embed_url} onChange={e => setForm(f => ({...f, social_embed_url: e.target.value}))} placeholder="https://www.tiktok.com/@.../video/... 或 https://www.instagram.com/p/..." /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="flex-1 bg-[#0f172a] text-white text-xs font-bold rounded-xl py-2 disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 bg-gray-200 text-gray-600 text-xs font-bold rounded-xl py-2">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- MANUAL ADD FORM ----
function AddForm({ onAdded }: { onAdded: () => void }) {
  const empty = {
    name_zh: '', name_en: '', name_th: '', description_zh: '', description_en: '',
    category: 'food' as Category, address: '', address_th: '', lat: 0, lng: 0,
    photosInput: '', source: 'manual' as Source,
    source_url: '', rating: 4, price_range: 2 as 1|2|3|4, tag: 'evergreen' as LocationTag,
    hashtagsInput: '', local_ratio: '' as string, social_embed_url: '',
  }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [importName, setImportName] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

  async function quickImport() {
    if (!importName.trim()) return
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/quickimport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: importName.trim(), mapsUrl: importUrl.trim() || undefined, category: form.category }),
      })
      if (!res.ok) { setImportError('找不到這個地點，請確認名稱後重試'); return }
      const data = await res.json()
      setForm(f => ({
        ...f,
        name_en: data.name_en ?? f.name_en,
        name_zh: data.name_zh ?? f.name_zh,
        description_zh: data.description_zh ?? f.description_zh,
        description_en: data.description_en ?? f.description_en,
        category: data.category ?? f.category,
        address: data.address ?? f.address,
        lat: data.lat ?? f.lat,
        lng: data.lng ?? f.lng,
        rating: data.rating ?? f.rating,
        photosInput: (data.photos ?? []).join(', '),
        hashtagsInput: (data.hashtags ?? []).join(', '),
        source: 'googlemaps',
        source_url: importUrl.trim() || f.source_url,
      }))
      setImportName('')
      setImportUrl('')
    } catch {
      setImportError('匯入失敗，請稍後再試')
    } finally {
      setImporting(false)
    }
  }

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.type === 'number' ? Number(e.target.value) : e.target.value
      setForm((f) => ({ ...f, [key]: val }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { photosInput, hashtagsInput, local_ratio, social_embed_url, tag, ...rest } = form
    const payload = {
      ...rest,
      tag,
      action: 'add',
      photos: photosInput ? photosInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
      hashtags: hashtagsInput ? hashtagsInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
      local_ratio: local_ratio !== '' ? Number(local_ratio) : undefined,
      social_embed_url: social_embed_url || undefined,
    }
    await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setForm(empty)
    setSaving(false)
    onAdded()
  }

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400'
  const label = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-6 max-w-2xl">
      <h2 className="text-lg font-black text-[#0f172a] mb-4">新增地點</h2>

      {/* ── QUICK IMPORT ── */}
      <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
        <p className="text-xs font-black text-indigo-600 uppercase tracking-wide mb-3">⚡ 快速匯入</p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={importName}
            onChange={e => setImportName(e.target.value)}
            placeholder="店名（英文或泰文）"
            className="flex-1 border border-indigo-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), quickImport())}
          />
          <button
            type="button"
            onClick={quickImport}
            disabled={importing || !importName.trim()}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
          >
            {importing
              ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>匯入中…</>
              : '自動填入'}
          </button>
        </div>
        <input
          type="text"
          value={importUrl}
          onChange={e => setImportUrl(e.target.value)}
          placeholder="Google Maps URL（選填，提高比對準確度）"
          className="w-full border border-indigo-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
        />
        {importError && <p className="text-xs text-red-500 mt-2">{importError}</p>}
        <p className="text-[10px] text-indigo-400 mt-2">自動查詢地址、座標、評分、照片，並用 AI 生成中英文介紹</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>中文名稱</label><input className={inp} value={form.name_zh} onChange={field('name_zh')} required /></div>
        <div><label className={label}>English Name</label><input className={inp} value={form.name_en} onChange={field('name_en')} required /></div>
        <div className="col-span-2"><label className={label}>泰文店名 ชื่อร้าน（複製給計程車用）</label><input className={inp} value={form.name_th} onChange={field('name_th')} placeholder="เช่น ร้านอาหาร..." /></div>
        <div className="col-span-2"><label className={label}>中文描述</label><textarea className={inp} rows={2} value={form.description_zh} onChange={field('description_zh')} /></div>
        <div className="col-span-2"><label className={label}>English Description</label><textarea className={inp} rows={2} value={form.description_en} onChange={field('description_en')} /></div>
        <div>
          <label className={label}>分類</label>
          <select className={inp} value={form.category} onChange={field('category')}>
            {(['food','cafe','shopping','nightlife','hotel','attraction'] as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>來源</label>
          <select className={inp} value={form.source} onChange={field('source')}>
            {(['manual','pantip','wongnai','googlemaps','tiktok','instagram'] as Source[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={label}>地址（英文）</label><input className={inp} value={form.address} onChange={field('address')} /></div>
        <div className="col-span-2"><label className={label}>泰文地址 ที่อยู่（選填）</label><input className={inp} value={form.address_th} onChange={field('address_th')} placeholder="ที่อยู่ภาษาไทย..." /></div>
        <div><label className={label}>緯度 (lat)</label><input type="number" step="any" className={inp} value={form.lat} onChange={field('lat')} /></div>
        <div><label className={label}>經度 (lng)</label><input type="number" step="any" className={inp} value={form.lng} onChange={field('lng')} /></div>
        <div className="col-span-2"><label className={label}>照片 URLs（逗號分隔）</label><input className={inp} value={form.photosInput} onChange={field('photosInput')} placeholder="https://..." /></div>
        <div><label className={label}>評分 (0-5)</label><input type="number" min="0" max="5" step="0.1" className={inp} value={form.rating} onChange={field('rating')} /></div>
        <div>
          <label className={label}>價位</label>
          <select className={inp} value={form.price_range} onChange={field('price_range')}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{'$'.repeat(n)}</option>)}
          </select>
        </div>
        <div><label className={label}>Source URL</label><input className={inp} value={form.source_url} onChange={field('source_url')} /></div>
        <div><label className={label}>在地客比例 % (0–100)</label><input type="number" min="0" max="100" className={inp} value={form.local_ratio} onChange={field('local_ratio')} placeholder="例：80 代表八成是泰國人" /></div>
        <div className="col-span-2"><label className={label}>泰文 Hashtags（逗號分隔）</label><input className={inp} value={form.hashtagsInput} onChange={field('hashtagsInput')} placeholder="คาเฟ่เปิดใหม่, บรรยากาศดี" /></div>
        <div className="col-span-2"><label className={label}>社群貼文 URL（TikTok / Instagram，選填）</label><input className={inp} value={form.social_embed_url} onChange={field('social_embed_url')} placeholder="https://www.tiktok.com/@.../video/... 或 https://www.instagram.com/p/..." /></div>
        <div>
          <label className={label}>標籤分類</label>
          <select className={inp} value={form.tag} onChange={field('tag')}>
            {TAG_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.zh} — {t.hint}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" disabled={saving} className="mt-6 bg-[#0f172a] text-white rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-50">
        {saving ? '儲存中...' : '新增地點'}
      </button>
    </form>
  )
}

// ---- MAIN ADMIN PANEL ----
export function AdminPanel() {
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<PendingLocation[]>([])
  const [approved, setApproved] = useState<Location[]>([])
  const [scraperStatus, setScraperStatus] = useState<string>('就緒')
  const [scraperRunning, setScraperRunning] = useState(false)
  const [retranslating, setRetranslating] = useState(false)
  const [retranslateStatus, setRetranslateStatus] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [deployStatus, setDeployStatus] = useState<string>('')
  const [deploying, setDeploying] = useState(false)
  const [approvedSearch, setApprovedSearch] = useState('')
  const [pendingSourceFilter, setPendingSourceFilter] = useState<string>('all')
  const [pendingAreaFilter, setPendingAreaFilter] = useState<string>('all')
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0, current: '' })
  const batchStopRef = useRef(false)

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === '1') setAuthed(true)
  }, [])

  const loadData = useCallback(async () => {
    const [p, a] = await Promise.all([
      fetch('/api/pending').then((r) => r.json()),
      fetch('/api/locations').then((r) => r.json()),
    ])
    setPending(p)
    setApproved(a)
  }, [])

  useEffect(() => {
    if (authed) loadData()
  }, [authed, loadData])

  async function handleApprove(id: string, category?: Category, tag?: LocationTag) {
    await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id, ...(category ? { category } : {}), ...(tag ? { tag } : {}) }),
    })
    loadData()
  }

  function handleUpdatePending(id: string, updates: Partial<PendingLocation>) {
    setPending(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  async function handleReject(id: string) {
    await fetch('/api/pending', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  async function handleRejectAll() {
    if (!confirm(`確定要駁回全部 ${pending.length} 筆待審核地點嗎？`)) return
    await fetch('/api/pending', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    loadData()
  }

  async function handleApproveAll() {
    const visible = pending.filter(p =>
      (pendingSourceFilter === 'all' || p.source === pendingSourceFilter) &&
      (pendingAreaFilter === 'all' || (p as PendingLocation & { area?: string }).area === pendingAreaFilter)
    )
    if (!confirm(`確定要全部上架 ${visible.length} 筆待審核地點嗎？上架後會自動部署。`)) return
    await Promise.all(visible.map((item) =>
      fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', id: item.id, tag: resolveTag(item) }) })
    ))
    loadData()
    deploy()
  }

  async function handleRemove(id: string) {
    await fetch('/api/locations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  function stopBatch() { batchStopRef.current = true }

  async function generateAllDescriptions() {
    const visible = pending.filter(p =>
      (pendingSourceFilter === 'all' || p.source === pendingSourceFilter) &&
      (pendingAreaFilter === 'all' || (p as PendingLocation & { area?: string }).area === pendingAreaFilter)
    )
    if (visible.length === 0) return
    if (!confirm(`要對這 ${visible.length} 筆待審核地點「上網查證生成」中英描述嗎？\n\n每筆約 30–40 秒，會逐筆覆蓋現有描述並存檔。過程中可隨時停止，已完成的會保留。請保持本機後台開著。`)) return

    batchStopRef.current = false
    setBatchRunning(true)
    setBatchProgress({ done: 0, total: visible.length, ok: 0, fail: 0, current: '' })

    let ok = 0, fail = 0
    for (let i = 0; i < visible.length; i++) {
      if (batchStopRef.current) break
      const item = visible[i]
      setBatchProgress({ done: i, total: visible.length, ok, fail, current: item.name_en })
      try {
        const res = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name_en: item.name_en,
            address: item.address,
            source_url: item.source_url,
            category: item.category,
          }),
        })
        const data = await res.json()
        if (res.ok && data.description_zh) {
          await fetch('/api/pending', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, description_zh: data.description_zh, description_en: data.description_en || item.description_en }),
          })
          ok++
        } else {
          fail++
        }
      } catch {
        fail++
      }
      setBatchProgress({ done: i + 1, total: visible.length, ok, fail, current: item.name_en })
    }

    setBatchRunning(false)
    batchStopRef.current = false
    await loadData()
  }

  async function handleUpdate(id: string, updates: Partial<Location>) {
    await fetch('/api/locations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
    loadData()
  }

  async function runScraper() {
    setScraperRunning(true)
    const keywords = customKeywords.split('\n').map(s => s.trim()).filter(Boolean)
    setScraperStatus(keywords.length ? `搜尋「${keywords[0]}」等 ${keywords.length} 個關鍵字...` : '爬取中...')
    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customKeywords: keywords.length ? keywords : [] }),
      })
      const data = await res.json()
      setScraperStatus(`完成 — 新增 ${data.added ?? 0} 筆`)
      loadData()
    } catch {
      setScraperStatus('執行失敗')
    } finally {
      setScraperRunning(false)
    }
  }

  async function retranslate() {
    setRetranslating(true)
    setRetranslateStatus('翻譯中...')
    try {
      const res = await fetch('/api/retranslate', { method: 'POST' })
      const data = await res.json()
      setRetranslateStatus(`完成，更新了 ${data.updated} 筆`)
      loadData()
    } catch {
      setRetranslateStatus('失敗，請重試')
    } finally {
      setRetranslating(false)
    }
  }

  async function deploy() {
    setDeploying(true)
    setDeployStatus('上傳中...')
    try {
      const res = await fetch('/api/deploy', { method: 'POST' })
      const data = await res.json()
      setDeployStatus(data.ok ? '✓ 已推送到 Vercel' : `失敗：${data.error?.slice(0, 60)}`)
    } catch {
      setDeployStatus('連線失敗')
    } finally {
      setDeploying(false)
    }
  }

  const isVercel = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)

  if (!authed) return <AuthOverlay onAuth={() => setAuthed(true)} />

  const navLink = (t: Tab, label: string, count?: number) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm rounded-lg transition-colors ${
        tab === t ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  )

  return (
    <div className="flex h-screen bg-slate-100 flex-col overflow-hidden">
      {isVercel && (
        <div className="bg-amber-400 text-amber-900 text-xs font-bold px-4 py-2.5 flex items-center gap-2">
          ⚠️ 目前在 Vercel 上，所有編輯、🔥 熱門切換、上下架操作都無法儲存。請在本機執行 <code className="bg-amber-300 px-1.5 py-0.5 rounded font-mono">npm run dev</code> 後至 <code className="bg-amber-300 px-1.5 py-0.5 rounded font-mono">localhost:3000/admin</code> 操作。
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-56 bg-[#0f172a] flex flex-col shrink-0 overflow-y-auto">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-white font-black text-sm tracking-wide">BKK LOCAL</div>
          <div className="text-slate-500 text-xs mt-0.5">曼谷人 管理後台</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navLink('pending', '待審核地點', pending.length)}
          {navLink('approved', '已上架地點')}
          {navLink('add', '手動新增')}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-slate-400 text-[10px] font-semibold mb-1.5 uppercase tracking-wide">自訂關鍵字（每行一個）</p>
          <textarea
            value={customKeywords}
            onChange={(e) => setCustomKeywords(e.target.value)}
            placeholder={'例：\nThonglor new restaurant 2025\nAri café brunch:cafe\nSukhumvit rooftop bar:nightlife\n（冒號後可指定分類）'}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[11px] text-slate-300 placeholder-slate-600 resize-none outline-none focus:border-white/20 mb-2"
          />
          <button
            onClick={runScraper}
            disabled={scraperRunning}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2"
          >
            <svg className={`w-3.5 h-3.5 ${scraperRunning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            {scraperRunning ? '執行中...' : '執行爬蟲'}
          </button>
          <p className="text-slate-500 text-[10px] text-center mt-1.5">{scraperStatus}</p>
          <button
            onClick={retranslate}
            disabled={retranslating}
            className="mt-2 w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2"
          >
            <svg className={`w-3.5 h-3.5 ${retranslating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M5 8l4-4 4 4M9 4v9M19 16l-4 4-4-4M15 20v-9"/>
            </svg>
            {retranslating ? '翻譯中...' : '重新翻譯英文'}
          </button>
          {retranslateStatus && <p className="text-slate-500 text-[10px] text-center mt-1.5">{retranslateStatus}</p>}
          <button
            onClick={deploy}
            disabled={deploying}
            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2"
          >
            <svg className={`w-3.5 h-3.5 ${deploying ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            {deploying ? '上傳中...' : '存檔並上傳'}
          </button>
          {deployStatus && <p className="text-slate-500 text-[10px] text-center mt-1.5">{deployStatus}</p>}
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: '待審核', value: pending.length, color: 'text-amber-600' },
            { label: '已上架', value: approved.length, color: 'text-green-600' },
            { label: '總計', value: pending.length + approved.length, color: 'text-slate-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
              <div className={`text-3xl font-black ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {tab === 'pending' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-black text-[#0f172a]">待審核地點</h1>
              {pending.length > 0 && (
                <div className="flex gap-2">
                  {batchRunning ? (
                    <button
                      onClick={stopBatch}
                      className="text-xs font-bold px-4 py-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    >
                      ■ 停止生成
                    </button>
                  ) : (
                    <button
                      onClick={generateAllDescriptions}
                      className="text-xs font-bold px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      🌐 全部上網生成
                    </button>
                  )}
                  <button
                    onClick={handleApproveAll}
                    disabled={batchRunning}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
                  >
                    全部上架 ({pending.filter(p =>
                      (pendingSourceFilter === 'all' || p.source === pendingSourceFilter) &&
                      (pendingAreaFilter === 'all' || (p as PendingLocation & { area?: string }).area === pendingAreaFilter)
                    ).length})
                  </button>
                  <button
                    onClick={handleRejectAll}
                    disabled={batchRunning}
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    全部駁回
                  </button>
                </div>
              )}
            </div>

            {/* Batch progress */}
            {batchRunning && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-700 mb-1.5">
                  <span>上網查證生成中… {batchProgress.done}/{batchProgress.total}（✓{batchProgress.ok} ✗{batchProgress.fail}）</span>
                  <span className="text-blue-400 font-normal truncate ml-2 max-w-[50%]">{batchProgress.current}</span>
                </div>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${batchProgress.total ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            {/* Source + Area filters */}
            {pending.length > 0 && (() => {
              const areas = Array.from(new Set(pending.map(p => (p as PendingLocation & { area?: string }).area).filter(Boolean))).sort()
              const filtered = pending.filter(p =>
                (pendingSourceFilter === 'all' || p.source === pendingSourceFilter) &&
                (pendingAreaFilter === 'all' || (p as PendingLocation & { area?: string }).area === pendingAreaFilter)
              )
              return (
                <>
                  <div className="flex gap-2 flex-wrap mb-1">
                    {(['all', ...Array.from(new Set(pending.map(p => p.source)))]).map((src) => (
                      <button key={src} onClick={() => setPendingSourceFilter(src)}
                        className={`text-[11px] font-bold px-3 py-1 rounded-full transition-colors ${pendingSourceFilter === src ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {src === 'all' ? `全部 (${pending.length})` : `${SOURCE_LABEL[src as Source] ?? src} (${pending.filter(p => p.source === src).length})`}
                      </button>
                    ))}
                  </div>
                  {areas.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {(['all', ...areas]).map((a) => (
                        <button key={a} onClick={() => setPendingAreaFilter(a as string)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${pendingAreaFilter === a ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}>
                          {a === 'all' ? '所有區域' : a as string}
                        </button>
                      ))}
                    </div>
                  )}
                  {filtered.length === 0 && <p className="text-gray-400 text-sm py-8 text-center">沒有符合條件的地點</p>}
                  {filtered.map((item) => (
                    <PendingCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} onUpdate={handleUpdatePending} />
                  ))}
                </>
              )
            })()}
            {pending.length === 0 && <p className="text-gray-400 text-sm py-12 text-center">沒有待審核的地點</p>}
          </div>
        )}

        {tab === 'approved' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-xl font-black text-[#0f172a]">已上架地點</h1>
              <div className="flex-1 relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
                </svg>
                <input
                  value={approvedSearch}
                  onChange={(e) => setApprovedSearch(e.target.value)}
                  placeholder="搜尋地點名稱..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="space-y-2">
              {approved.length === 0 && <p className="text-gray-400 text-sm py-12 text-center">還沒有上架的地點</p>}
              {approved
                .filter(item => !approvedSearch || item.name_zh?.toLowerCase().includes(approvedSearch.toLowerCase()) || item.name_en.toLowerCase().includes(approvedSearch.toLowerCase()))
                .map((item) => (
                  <ApprovedCard key={item.id} item={item} onRemove={handleRemove} onUpdate={handleUpdate} />
                ))}
            </div>
          </div>
        )}

        {tab === 'add' && <AddForm onAdded={() => { loadData(); setTab('approved') }} />}
      </div>
      </div>
    </div>
  )
}
