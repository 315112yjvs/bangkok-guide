'use client'
import { useEffect, useState } from 'react'
import { bangkokMinuteOfWeek } from './openStatus'

// 曼谷現在是這週的第幾分鐘。只在瀏覽器端算（頁面是預先產生的，伺服器上的時間是舊的），
// 所以第一次畫面是 null；之後每分鐘更新一次，頁面開著不動也不會顯示過時的營業狀態。
export function useBangkokMinute(): number | null {
  const [minute, setMinute] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setMinute(bangkokMinuteOfWeek())
    tick()
    const timer = setInterval(tick, 60000)
    return () => clearInterval(timer)
  }, [])
  return minute
}
