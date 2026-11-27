import { parseProfile, parseCaption, igCode, sameName } from '@/lib/igParse'

describe('IG 同步解析', () => {
  it('個人頁抓出貼文代碼與日期', () => {
    const md = `## Recent posts

- [一年只開一次，金山寺夜市來了！🏮 曼谷…](https://instagram.com/p/Df2C0HCCTee) · 2026-11-17 · 1,103 likes · 20 comments
- [喝咖啡還能現場印衣服？☕ …](https://instagram.com/p/Dfjg5XzCjA-) · 2026-11-10 · 53 likes
- [重複一次](https://instagram.com/p/Dfjg5XzCjA-) · 2026-11-10
Links: https://www.bkk-local.com/ig`
    const posts = parseProfile(md)
    expect(posts.map((p) => p.code)).toEqual(['Df2C0HCCTee', 'Dfjg5XzCjA-'])
    expect(posts[0].posted).toBe('2026-11-17')
    expect(posts[1].url).toBe('https://www.instagram.com/p/Dfjg5XzCjA-/')
  })

  it('單篇貼文去掉標題與按讚數', () => {
    const md = `# Reel by 曼谷人 (@bkklocal555)

喝咖啡還能現場印衣服？☕

📍 ACE JOLUN

2026-11-10 · 53 likes · 4 comments · 1,555 plays
`
    const { caption, posted } = parseCaption(md)
    expect(posted).toBe('2026-11-10')
    expect(caption).toBe('喝咖啡還能現場印衣服？☕\n\n📍 ACE JOLUN')
  })

  it('從各種 IG 網址取出代碼', () => {
    expect(igCode('https://www.instagram.com/p/Dfjg5XzCjA-/')).toBe('Dfjg5XzCjA-')
    expect(igCode('https://www.instagram.com/reel/DfwPZ0-RXc8/?igsh=abc')).toBe('DfwPZ0-RXc8')
    expect(igCode('https://www.instagram.com/bkklocal555/p/Dfr8ZxTiVZI/')).toBe('Dfr8ZxTiVZI')
    expect(igCode('https://www.tiktok.com/@x/video/1')).toBeNull()
  })

  it('座標比對的店名：百貨本身不能對到百貨裡的店', () => {
    expect(sameName('Central Chidlom', 'MUJI Coffee (Central Chidlom)')).toBe(false)
    expect(sameName('centralwOrld', 'Laem Charoen Seafood Central World')).toBe(false)
    expect(sameName('centralwOrld', 'UNO! (centralwOrld)')).toBe(false)
    expect(sameName('Wat Saket Ratchawora Mahawihan', 'Wat Saket Ratchawora Mahawihan')).toBe(true)
    expect(sameName('Ganesha Shrine', 'Ganesha Shrine (CentralWorld)')).toBe(true)
  })
})
