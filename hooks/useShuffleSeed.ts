'use client'
import { useState, useEffect } from 'react'

// 每個分頁一個隨機洗牌種子，存在 sessionStorage：
// 一進站(新分頁)產生新種子→隨機；之後同分頁內導航/返回都用同一種子→順序固定。
// SSR 與首次 client render 回傳 null（維持原序，避免 hydration 不一致），掛載後才設種子。
export function useShuffleSeed(): number | null {
  const [seed, setSeed] = useState<number | null>(null)
  useEffect(() => {
    try {
      let s = Number(sessionStorage.getItem('bkk_shuffle_seed'))
      if (!s || Number.isNaN(s)) {
        s = Math.floor(Math.random() * 1e9) || 1
        sessionStorage.setItem('bkk_shuffle_seed', String(s))
      }
      setSeed(s)
    } catch {
      setSeed(1)
    }
  }, [])
  return seed
}
