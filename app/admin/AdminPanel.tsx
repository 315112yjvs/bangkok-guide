'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { Location, PendingLocation, Category, Source } from '@/lib/types'

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
        <h1 className="text-xl font-black text-[#0f172a] mb-1">管理後台</h1>
        <p className="text-sm text-gray-400 mb-6">Bangkok Guide Admin</p>
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
}: {
  item: PendingLocation
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const photo = item.photos[0] ?? 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=220&h=120&fit=crop'
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-transparent hover:border-indigo-200 transition-colors flex">
      <div className="relative w-28 shrink-0">
        <Image src={photo} alt={item.name_en} fill className="object-cover" sizes="112px" />
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[#0f172a] text-sm leading-tight">{item.name_zh || item.name_en}</h3>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${SOURCE_STYLE[item.source]}`}>
            {SOURCE_LABEL[item.source]}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{item.category}</span>
          <span className="text-[10px] text-gray-400 truncate">{item.address}</span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description_zh || item.description_en}</p>
        <div className="flex items-center justify-between">
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 underline truncate max-w-[160px]">
              {item.source_url.replace(/^https?:\/\//, '')}
            </a>
          ) : <span />}
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onReject(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
              駁回
            </button>
            <button onClick={() => onApprove(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
              上架
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- APPROVED CARD ----
function ApprovedCard({ item, onRemove }: { item: Location; onRemove: (id: string) => void }) {
  const photo = item.photos[0] ?? 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=220&h=120&fit=crop'
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-transparent hover:border-slate-200 transition-colors flex">
      <div className="relative w-20 shrink-0">
        <Image src={photo} alt={item.name_en} fill className="object-cover" sizes="80px" />
      </div>
      <div className="flex-1 p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-[#0f172a] truncate">{item.name_zh || item.name_en}</h3>
          <p className="text-[10px] text-gray-400">{item.category} · ★ {item.rating}</p>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 shrink-0">
          下架
        </button>
      </div>
    </div>
  )
}

// ---- MANUAL ADD FORM ----
function AddForm({ onAdded }: { onAdded: () => void }) {
  const empty = {
    name_zh: '', name_en: '', description_zh: '', description_en: '',
    category: 'food' as Category, address: '', lat: 0, lng: 0,
    photosInput: '', source: 'manual' as Source,
    source_url: '', rating: 4, price_range: 2 as 1|2|3|4, trending: false,
  }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

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
    const { photosInput, ...rest } = form
    const payload = {
      ...rest,
      action: 'add',
      photos: photosInput ? photosInput.split(',').map((s) => s.trim()).filter(Boolean) : [],
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
      <h2 className="text-lg font-black text-[#0f172a] mb-5">手動新增地點</h2>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>中文名稱</label><input className={inp} value={form.name_zh} onChange={field('name_zh')} required /></div>
        <div><label className={label}>English Name</label><input className={inp} value={form.name_en} onChange={field('name_en')} required /></div>
        <div className="col-span-2"><label className={label}>中文描述</label><textarea className={inp} rows={2} value={form.description_zh} onChange={field('description_zh')} /></div>
        <div className="col-span-2"><label className={label}>English Description</label><textarea className={inp} rows={2} value={form.description_en} onChange={field('description_en')} /></div>
        <div>
          <label className={label}>分類</label>
          <select className={inp} value={form.category} onChange={field('category')}>
            {(['food','cafe','shopping','nightlife','hotel'] as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>來源</label>
          <select className={inp} value={form.source} onChange={field('source')}>
            {(['manual','pantip','wongnai','googlemaps','tiktok','instagram'] as Source[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={label}>地址</label><input className={inp} value={form.address} onChange={field('address')} /></div>
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
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="trending" checked={form.trending} onChange={field('trending')} className="w-4 h-4" />
          <label htmlFor="trending" className="text-sm font-semibold text-gray-600">標記為熱門</label>
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

  async function handleApprove(id: string) {
    await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', id }),
    })
    loadData()
  }

  async function handleReject(id: string) {
    await fetch('/api/pending', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  async function handleRemove(id: string) {
    await fetch('/api/locations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  async function runScraper() {
    setScraperRunning(true)
    setScraperStatus('爬取中...')
    try {
      const res = await fetch('/api/scraper', { method: 'POST' })
      const data = await res.json()
      setScraperStatus(`完成 — 新增 ${data.added ?? 0} 筆`)
      loadData()
    } catch {
      setScraperStatus('執行失敗')
    } finally {
      setScraperRunning(false)
    }
  }

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
    <div className="flex min-h-screen bg-slate-100">
      {/* SIDEBAR */}
      <div className="w-56 bg-[#0f172a] flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-white font-black text-sm tracking-wide">Bangkok Guide</div>
          <div className="text-slate-500 text-xs mt-0.5">管理後台</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navLink('pending', '待審核地點', pending.length)}
          {navLink('approved', '已上架地點')}
          {navLink('add', '手動新增')}
        </nav>
        <div className="p-4 border-t border-white/10">
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
            <h1 className="text-xl font-black text-[#0f172a] mb-4">待審核地點</h1>
            {pending.length === 0 && <p className="text-gray-400 text-sm py-12 text-center">沒有待審核的地點</p>}
            {pending.map((item) => (
              <PendingCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}

        {tab === 'approved' && (
          <div>
            <h1 className="text-xl font-black text-[#0f172a] mb-4">已上架地點</h1>
            <div className="space-y-2">
              {approved.length === 0 && <p className="text-gray-400 text-sm py-12 text-center">還沒有上架的地點</p>}
              {approved.map((item) => (
                <ApprovedCard key={item.id} item={item} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        {tab === 'add' && <AddForm onAdded={() => { loadData(); setTab('approved') }} />}
      </div>
    </div>
  )
}
