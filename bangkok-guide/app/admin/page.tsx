import type { Metadata } from 'next'
import { AdminPanel } from './AdminPanel'

export const metadata: Metadata = {
  title: '曼谷人管理後台',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminPanel />
}
