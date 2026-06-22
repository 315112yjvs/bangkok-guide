import type { LocationTag } from '@/lib/types'

type IconProps = { size?: number; className?: string }

// 話題爆紅：皇冠
export function IconCrown({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3.4 16.2 5.4 9 9 12.4 12 5.2 15 12.4 18.6 9 20.6 16.2Z" />
      <circle cx="5.4" cy="8.4" r="1.5" />
      <circle cx="12" cy="4.4" r="1.5" />
      <circle cx="18.6" cy="8.4" r="1.5" />
      <rect x="5.4" y="17.6" width="13.2" height="2.6" rx="0.8" />
    </svg>
  )
}

// 在地私藏：定位圖釘（中空孔以 evenodd 鏤空，任何底色都適用）
export function IconNearby({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 4.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5Z"
      />
    </svg>
  )
}

// 新開幕：NEW 方框
export function IconNew({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <text
        x="12"
        y="15.4"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="800"
        fontFamily="Arial, sans-serif"
        fill="currentColor"
      >
        NEW
      </text>
    </svg>
  )
}

// 經典必訪：大人＋小孩（兩個人）
export function IconClassic({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="8" cy="5" r="2.3" />
      <path d="M5 21v-7.5a3 3 0 016 0V21Z" />
      <circle cx="16.5" cy="7.5" r="1.9" />
      <path d="M14 21v-5.6a2.5 2.5 0 015 0V21Z" />
    </svg>
  )
}

export const TAG_ICON: Record<LocationTag, (p: IconProps) => React.ReactElement> = {
  trending: IconCrown,
  hidden_gem: IconNearby,
  new_opening: IconNew,
  evergreen: IconClassic,
}
