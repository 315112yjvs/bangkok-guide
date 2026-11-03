import type { LocationTag } from '@/lib/types'
import { Icon } from './Icon'

type IconProps = { size?: number; className?: string }

// 話題爆紅：火焰
export function IconTrending({ size = 24, className }: IconProps) {
  return <Icon name="flame" size={size} className={className} />
}

// 在地私藏：寶石
export function IconHiddenGem({ size = 24, className }: IconProps) {
  return <Icon name="gem" size={size} className={className} />
}

// 經典必訪：認證徽章
export function IconClassic({ size = 24, className }: IconProps) {
  return <Icon name="badge-check" size={size} className={className} />
}

export const TAG_ICON: Record<LocationTag, (p: IconProps) => React.ReactElement> = {
  trending: IconTrending,
  hidden_gem: IconHiddenGem,
  evergreen: IconClassic,
}
