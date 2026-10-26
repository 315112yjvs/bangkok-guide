import type { LocationTag } from './types'

// 四種標籤各配一個繪本風色塊（文字一律用墨灰，色塊只當底色）
export const TAG_BG: Record<LocationTag, string> = {
  trending: 'bg-coral',
  hidden_gem: 'bg-matcha',
  new_opening: 'bg-mustard',
  evergreen: 'bg-mizu',
}
