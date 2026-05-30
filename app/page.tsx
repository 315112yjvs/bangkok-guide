import { readLocations } from '@/lib/data'
import { PublicHomepage } from './PublicHomepage'

export const dynamic = 'force-dynamic'

export default function Page() {
  const locations = readLocations()
  return <PublicHomepage locations={locations} />
}
