import { readLocations } from '@/lib/data'
import { PublicHomepage } from './PublicHomepage'

export const revalidate = 3600

export default function Page() {
  const locations = readLocations()
  return <PublicHomepage locations={locations} />
}
