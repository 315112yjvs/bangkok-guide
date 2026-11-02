// 全站圖標：Lucide（ISC 授權，https://lucide.dev）內嵌路徑，viewBox 0 0 24 24、線條描邊。
// 只收網站用到的圖，新增時從 lucide-static 的 icons/<名稱>.svg 複製內容進來。
type IconProps = { size?: number; className?: string; strokeWidth?: number; fill?: string }

const PATHS: Record<string, string> = {
  "layout-grid": "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\"/> <rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/>",
  "utensils": "<path d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\"/> <path d=\"M7 2v20\"/> <path d=\"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\"/>",
  "coffee": "<path d=\"M10 2v2\"/> <path d=\"M14 2v2\"/> <path d=\"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1\"/> <path d=\"M6 2v2\"/>",
  "shopping-bag": "<path d=\"M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z\"/> <path d=\"M3 6h18\"/> <path d=\"M16 10a4 4 0 0 1-8 0\"/>",
  "martini": "<path d=\"M8 22h8\"/> <path d=\"M12 11v11\"/> <path d=\"m19 3-7 8-7-8Z\"/>",
  "bed-double": "<path d=\"M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8\"/> <path d=\"M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4\"/> <path d=\"M12 4v6\"/> <path d=\"M2 18h20\"/>",
  "ferris-wheel": "<circle cx=\"12\" cy=\"12\" r=\"2\"/> <path d=\"M12 2v4\"/> <path d=\"m6.8 15-3.5 2\"/> <path d=\"m20.7 7-3.5 2\"/> <path d=\"M6.8 9 3.3 7\"/> <path d=\"m20.7 17-3.5-2\"/> <path d=\"m9 22 3-8 3 8\"/> <path d=\"M8 22h8\"/> <path d=\"M18 18.7a9 9 0 1 0-12 0\"/>",
  "flame": "<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"/>",
  "gem": "<path d=\"M6 3h12l4 6-10 13L2 9Z\"/> <path d=\"M11 3 8 9l4 13 4-13-3-6\"/> <path d=\"M2 9h20\"/>",
  "sparkles": "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"/> <path d=\"M20 3v4\"/> <path d=\"M22 5h-4\"/> <path d=\"M4 17v2\"/> <path d=\"M5 18H3\"/>",
  "badge-check": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\"/> <path d=\"m9 12 2 2 4-4\"/>",
  "camera": "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\"/> <circle cx=\"12\" cy=\"13\" r=\"3\"/>",
  "moon-star": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9\"/> <path d=\"M20 3v4\"/> <path d=\"M22 5h-4\"/>",
  "croissant": "<path d=\"m4.6 13.11 5.79-3.21c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11Z\"/> <path d=\"m10.5 9.5-1-2.29C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83\"/> <path d=\"M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4\"/> <path d=\"m14.5 13.5 2.29 1c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2\"/> <path d=\"M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5\"/>",
  "compass": "<path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/> <circle cx=\"12\" cy=\"12\" r=\"10\"/>",
  "store": "<path d=\"m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7\"/> <path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\"/> <path d=\"M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4\"/> <path d=\"M2 7h20\"/> <path d=\"M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7\"/>",
  "train-front": "<path d=\"M8 3.1V7a4 4 0 0 0 8 0V3.1\"/> <path d=\"m9 15-1-1\"/> <path d=\"m15 15 1-1\"/> <path d=\"M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z\"/> <path d=\"m8 19-2 3\"/> <path d=\"m16 19 2 3\"/>",
  "soup": "<path d=\"M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z\"/> <path d=\"M7 21h10\"/> <path d=\"M19.5 12 22 6\"/> <path d=\"M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62\"/> <path d=\"M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62\"/> <path d=\"M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62\"/>",
  "backpack": "<path d=\"M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z\"/> <path d=\"M8 10h8\"/> <path d=\"M8 18h8\"/> <path d=\"M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6\"/> <path d=\"M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2\"/>",
  "building-2": "<path d=\"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z\"/> <path d=\"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2\"/> <path d=\"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2\"/> <path d=\"M10 6h4\"/> <path d=\"M10 10h4\"/> <path d=\"M10 14h4\"/> <path d=\"M10 18h4\"/>",
  "landmark": "<line x1=\"3\" x2=\"21\" y1=\"22\" y2=\"22\"/> <line x1=\"6\" x2=\"6\" y1=\"18\" y2=\"11\"/> <line x1=\"10\" x2=\"10\" y1=\"18\" y2=\"11\"/> <line x1=\"14\" x2=\"14\" y1=\"18\" y2=\"11\"/> <line x1=\"18\" x2=\"18\" y1=\"18\" y2=\"11\"/> <polygon points=\"12 2 20 7 4 7\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/> <path d=\"m21 21-4.3-4.3\"/>",
  "map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\"/> <path d=\"M15 5.764v15\"/> <path d=\"M9 3.236v15\"/>",
  "locate": "<line x1=\"2\" x2=\"5\" y1=\"12\" y2=\"12\"/> <line x1=\"19\" x2=\"22\" y1=\"12\" y2=\"12\"/> <line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"5\"/> <line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\"/> <circle cx=\"12\" cy=\"12\" r=\"7\"/>",
  "heart": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>",
  "share": "<path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\"/> <polyline points=\"16 6 12 2 8 6\"/> <line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"15\"/>",
  "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/> <circle cx=\"12\" cy=\"10\" r=\"3\"/>",
  "arrow-left": "<path d=\"m12 19-7-7 7-7\"/> <path d=\"M19 12H5\"/>",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\"/>",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\"/>",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\"/>",
  "x": "<path d=\"M18 6 6 18\"/> <path d=\"m6 6 12 12\"/>",
  "quote": "<path d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"/> <path d=\"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"/>",
  "navigation": "<polygon points=\"3 11 22 2 13 21 11 13 3 11\"/>",
  "check": "<path d=\"M20 6 9 17l-5-5\"/>",
  "star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>"
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24, className, strokeWidth = 1.75, fill = 'none' }: IconProps & { name: IconName }) {
  const inner = PATHS[name]
  if (!inner) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

// 資料檔（分類、主題、地標）裡存的是舊的 Material 圖標名稱，這裡對應到 Lucide
const LEGACY: Record<string, IconName> = {
  local_cafe: 'coffee', restaurant: 'utensils', local_bar: 'martini', shopping_bag: 'shopping-bag',
  hotel: 'bed-double', attractions: 'ferris-wheel', photo_camera: 'camera', nightlife: 'moon-star',
  brunch_dining: 'croissant', explore: 'compass', auto_awesome: 'sparkles', storefront: 'store',
  directions_subway: 'train-front', festival: 'soup', backpack: 'backpack', location_city: 'building-2',
  tour: 'landmark', near_me: 'navigation', format_quote: 'quote', place: 'map-pin', search: 'search',
}

export function MIcon({ name, ...rest }: IconProps & { name: string }) {
  const mapped = LEGACY[name]
  return mapped ? <Icon name={mapped} {...rest} /> : null
}
