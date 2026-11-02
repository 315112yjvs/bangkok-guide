import { Icon } from './Icon'

type IconProps = { size?: number; className?: string }

export function IconAll({ size = 24, className }: IconProps) {
  return <Icon name="layout-grid" size={size} className={className} />
}

export function IconFood({ size = 24, className }: IconProps) {
  return <Icon name="utensils" size={size} className={className} />
}

export function IconCafe({ size = 24, className }: IconProps) {
  return <Icon name="coffee" size={size} className={className} />
}

export function IconShopping({ size = 24, className }: IconProps) {
  return <Icon name="shopping-bag" size={size} className={className} />
}

export function IconNightlife({ size = 24, className }: IconProps) {
  return <Icon name="martini" size={size} className={className} />
}

export function IconHotel({ size = 24, className }: IconProps) {
  return <Icon name="bed-double" size={size} className={className} />
}

export function IconPin({ size = 16, className }: IconProps) {
  return <Icon name="map-pin" size={size} className={className} />
}
