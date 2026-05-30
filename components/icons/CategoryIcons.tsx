type IconProps = { size?: number; className?: string }

export function IconAll({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
    </svg>
  )
}

export function IconFood({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 14 Q5 20 12 20 Q19 20 19 14" fill="currentColor" opacity="0.9"/>
      <ellipse cx="12" cy="14" rx="7" ry="3" fill="currentColor"/>
      <ellipse cx="12" cy="14" rx="7" ry="3" fill="white" opacity="0.15"/>
      <path d="M9 14 Q11 12 12 14 Q13 16 15 14" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <line x1="9.5" y1="5" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="13" y1="4" x2="11.5" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCafe({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 12 L7.5 20 Q8 21 12 21 Q16 21 16.5 20 L18 12 Z" fill="currentColor" opacity="0.9"/>
      <ellipse cx="12" cy="21" rx="5" ry="1.2" fill="currentColor" opacity="0.5"/>
      <path d="M18 13.5 Q22 13.5 22 17 Q22 20 18 20" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M10.5 9 Q10.5 7 12 7.5 Q12.5 6 13.5 6.5 Q15 6 14.5 8 Q13.5 10 12.5 10Z" fill="currentColor" opacity="0.7"/>
    </svg>
  )
}

export function IconShopping({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" opacity="0.9"/>
      <path d="M9 11 Q9 7 12 7 Q15 7 15 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="12" cy="16.5" r="1.8" fill="white" opacity="0.5"/>
    </svg>
  )
}

export function IconNightlife({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 4 L19 4 L12 14 Z" fill="currentColor" opacity="0.9"/>
      <line x1="12" y1="14" x2="12" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8.5" y1="20" x2="15.5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="17" cy="7.5" r="2.2" fill="#f43f5e"/>
      <line x1="17" y1="9.5" x2="15" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconHotel({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="9" width="16" height="13" rx="1.5" fill="currentColor" opacity="0.9"/>
      <path d="M3 10 L12 3 L21 10" fill="currentColor" opacity="0.7"/>
      <rect x="7" y="13" width="3" height="3" rx="0.8" fill="white" opacity="0.5"/>
      <rect x="14" y="13" width="3" height="3" rx="0.8" fill="white" opacity="0.5"/>
      <rect x="10" y="17" width="4" height="5" rx="0.8" fill="white" opacity="0.4"/>
      <path d="M12 1 L12.5 3 L14 3 L13 4 L13.5 6 L12 5 L10.5 6 L11 4 L10 3 L11.5 3 Z" fill="#fbbf24"/>
    </svg>
  )
}

export function IconPin({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}
