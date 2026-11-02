// 把「拜拜」分類的寺廟、神壇加進 data/locations.json。
// 參拜內容（神明、求什麼、怎麼拜、供品、泰文）寫在下面的 TEMPLES；
// 位置、地址、泰文名、評分、照片 ref 從 Google 抓。已經在資料裡的廟（同一個 place id）會跳過。
//
//   node scripts/add-temples.mjs           預覽，只印出會新增哪幾間
//   node scripts/add-temples.mjs --apply   寫入 locations.json
//
// 寫入後再跑 python3 scripts/download-photos.py 把照片存成本機檔、node scripts/refresh-hours.mjs 補營業時間。
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'

const env = readFileSync('.env.local', 'utf-8')
const key = env.match(/^GOOGLE_MAPS_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
if (!key) { console.error('找不到 GOOGLE_MAPS_API_KEY'); process.exit(1) }
const apply = process.argv.includes('--apply')

const SATHU = { th: 'สาธุ', read: 'sǎa-thú', zh: '拜完雙手合十說的「善哉」，像是願望成真的祝福語' }

const TEMPLES = [
  {
    query: 'Erawan Shrine Ratchaprasong Bangkok',
    name_zh: '四面佛',
    tag: 'evergreen',
    description_zh: '曼谷香火最旺的神壇，就在 Ratchaprasong 路口、Grand Hyatt Erawan 旁邊，BTS Chit Lom 站走過來兩分鐘。四面佛其實是印度教的梵天，四張臉各管不同的願望，所以大家都會繞一圈四面都拜。旁邊常有泰國舞者在跳舞，那是願望成真的人回來還願請的。',
    description_en: 'Bangkok’s busiest shrine, right at the Ratchaprasong intersection next to Grand Hyatt Erawan. The four-faced Brahma is said to grant a different kind of wish on each side, so people walk around and pray at all four. The dancers you see were hired by people returning to give thanks.',
    temple: {
      deity_zh: '梵天（泰文 Phra Phrom，華人習慣叫四面佛）',
      wishes_zh: ['事業與健康（正面）', '愛情與婚姻（第二面）', '財運（第三面）', '平安與家庭（第四面）'],
      steps_zh: [
        '在入口櫃檯買一整套供品，裡面有香、蠟燭和花環',
        '從正對入口的那一面開始，順時針繞',
        '每一面點香、獻上花環，雙手合十默念自己的名字、生日和願望',
        '四面都拜完就完成了，願望實現後記得回來還願',
      ],
      offerings_zh: ['香、蠟燭、萬壽菊或茉莉花環（現場整套販售）', '還願：木雕大象、花環，或請舞者跳一段舞（依人數和時間計價）'],
      tips_zh: ['四面的分工是民間流傳的說法，各地版本略有不同', '人潮很多，注意隨身物品', '許了願就要還，承諾的還願方式要做到'],
      thai: [{ th: 'ศาลพระพรหม', read: 'sǎan phrá-phrom', zh: '四面佛祠' }, SATHU],
    },
  },
  {
    query: 'Trimurti Shrine Central World Bangkok',
    name_zh: '愛神（Trimurti 三相神）',
    tag: 'trending',
    description_zh: '在 Central World 正門前的廣場，來求愛情的人多到晚上要排隊。Trimurti 是梵天、毗濕奴、濕婆三位合一，華人都叫祂愛神。整座神壇被紅玫瑰淹沒，單身的、想復合的、想穩定下來的都會來。',
    description_en: 'In the plaza in front of Central World. Trimurti, the three great Hindu gods in one, is known locally as the god of love, and the shrine is buried in red roses every evening.',
    temple: {
      deity_zh: '三相神 Trimurti（梵天、毗濕奴、濕婆合一）',
      wishes_zh: ['姻緣、脫單', '感情穩定', '復合'],
      steps_zh: [
        '在旁邊的攤位買紅玫瑰、紅色的香和紅蠟燭',
        '點香點燭，雙手合十，說出自己的名字、生日，以及想要的對象或感情狀態',
        '把玫瑰獻上，插在神壇前',
        '旁邊就是象神，很多人會一起拜',
      ],
      offerings_zh: ['紅玫瑰（常見是 9 朵）', '紅色的香、紅蠟燭', '還願：再送一次玫瑰或水果'],
      hours_zh: '傳說每週四晚上 9 點半神明會降臨，那時候人最多',
      tips_zh: ['許願要說得具體，例如想要什麼樣的對象', '週四晚上人很多，想安靜拜可以改其他時間'],
      thai: [{ th: 'ตรีมูรติ', read: 'dtrii-muu-rá-dtì', zh: '三相神' }, SATHU],
    },
  },
  {
    query: 'Ganesha Shrine Central World Bangkok',
    name_zh: '象神（Central World）',
    tag: 'evergreen',
    description_zh: '就在愛神旁邊，一樣在 Central World 前面的廣場。象神是排除障礙、保佑事業和學業的神，泰國很多做生意的人、學生、藝術工作者都拜祂。拜完愛神順便拜象神是很多人的固定行程。',
    description_en: 'Right beside the Trimurti shrine in front of Central World. Ganesha removes obstacles and looks after work, study and the arts.',
    temple: {
      deity_zh: '象神 Ganesha（泰文 Phra Phikanet）',
      wishes_zh: ['事業順利', '考試、學業', '排除障礙', '藝術與創作'],
      steps_zh: [
        '準備供品，象神喜歡甜食和水果',
        '點香，雙手合十說出名字和願望',
        '把供品放在神壇前',
      ],
      offerings_zh: ['香蕉、甘蔗、甜點', '萬壽菊花環', '香和蠟燭'],
      tips_zh: ['可以跟旁邊的愛神一起拜，兩座走幾步就到'],
      thai: [{ th: 'พระพิฆเนศ', read: 'phrá-phí-khá-nêet', zh: '象神' }, SATHU],
    },
  },
  {
    query: 'Lakshmi Shrine Gaysorn Village Bangkok',
    name_zh: '吉祥天女（Gaysorn）',
    tag: 'hidden_gem',
    description_zh: '藏在 Gaysorn 商場樓上的戶外平台，從四面佛走過去幾分鐘。吉祥天女是掌管財富和美貌的女神，比樓下的四面佛清幽很多，很多人拜完四面佛會順路上來。',
    description_en: 'Up on an outdoor terrace of Gaysorn, a short walk from Erawan Shrine. Lakshmi, goddess of wealth and beauty, gets far fewer crowds than the shrines below.',
    temple: {
      deity_zh: '吉祥天女 Lakshmi（毗濕奴的妻子）',
      wishes_zh: ['財富', '美貌', '人緣與愛情'],
      steps_zh: [
        '搭電梯到 Gaysorn 樓上的戶外平台，循著指標走',
        '點香，雙手合十說出名字和願望',
        '把花和供品放在神壇前',
      ],
      offerings_zh: ['紅玫瑰或蓮花', '水果、甜點', '香和蠟燭'],
      tips_zh: ['上去前可以先在樓下或四面佛旁買好供品', '商場的營業時間就是能上去的時間'],
      thai: [{ th: 'พระแม่ลักษมี', read: 'phrá-mâe lák-sà-mii', zh: '吉祥天女' }, SATHU],
    },
  },
  {
    query: 'Indra Shrine InterContinental Bangkok Ratchaprasong',
    name_zh: '帝釋天',
    tag: 'hidden_gem',
    description_zh: '在 InterContinental 飯店前面，Ratchaprasong 一帶的神壇之一。帝釋天是眾神之王，祂的坐騎就是四面佛祠名字裡的愛侶灣三頭象。這一區還有四面佛、愛神、象神、吉祥天女，走一圈可以全部拜完。',
    description_en: 'In front of InterContinental Bangkok. Indra is king of the gods, and his three-headed elephant Erawan gave the famous shrine nearby its name.',
    temple: {
      deity_zh: '帝釋天 Indra（泰文 Phra In，眾神之王）',
      wishes_zh: ['事業、升遷', '心想事成', '保佑平安'],
      steps_zh: ['點香，雙手合十說出名字和願望', '獻上花環和供品'],
      offerings_zh: ['花環', '香和蠟燭', '水果'],
      tips_zh: ['可以安排成 Ratchaprasong 一圈：四面佛、帝釋天、吉祥天女、愛神、象神'],
      thai: [{ th: 'พระอินทร์', read: 'phrá-in', zh: '帝釋天' }, SATHU],
    },
  },
  {
    query: 'Ganesha Shrine Huai Khwang intersection Bangkok',
    name_zh: '匯權象神',
    tag: 'trending',
    description_zh: '在 Huai Khwang 路口，MRT Huai Khwang 站出來就到，24 小時都有人在拜。泰國人說這尊象神特別靈、願望實現得快，所以香火從早到半夜都沒停過。拜完旁邊就是匯權夜市，可以順便吃宵夜。',
    description_en: 'At the Huai Khwang intersection by the MRT station, busy around the clock. Locals swear this Ganesha answers wishes fast. The night market is right next door.',
    temple: {
      deity_zh: '象神 Ganesha（泰文 Phra Phikanet）',
      wishes_zh: ['事業、財運', '考試', '想要很快實現的願望'],
      steps_zh: [
        '在周邊攤位買香、花環和供品',
        '點香，雙手合十說出名字和願望',
        '找到象神旁邊的老鼠雕像（老鼠是象神的坐騎），一手摀住老鼠一邊耳朵，對著另一邊耳朵小聲說出願望，傳說這樣願望不會漏掉',
        '願望實現後回來還願',
      ],
      offerings_zh: ['香蕉、甘蔗、甜食', '萬壽菊花環', '還願常見：椰子、水果、甜點'],
      hours_zh: '24 小時開放',
      tips_zh: ['深夜也很熱鬧，晚上來可以接著逛匯權夜市', '路口車多，過馬路小心'],
      thai: [{ th: 'ห้วยขวาง', read: 'hûai-khwǎang', zh: '匯權（地名）' }, { th: 'พระพิฆเนศ', read: 'phrá-phí-khá-nêet', zh: '象神' }, SATHU],
    },
  },
  {
    query: 'Wat Mangkon Kamalawat Bangkok',
    name_zh: '龍蓮寺',
    tag: 'evergreen',
    description_zh: '中國城最大的華人佛寺，在 Charoen Krung 路上，MRT Wat Mangkon 站走路就到。拜法跟台灣的廟很像，香、燭、金紙一應俱全，安太歲和點光明燈都可以。過年前後人潮滿到門外。',
    description_en: 'The biggest Chinese Buddhist temple in Chinatown, on Charoen Krung Road near MRT Wat Mangkon. Worship here feels just like a temple back in Taiwan or Hong Kong.',
    temple: {
      deity_zh: '釋迦牟尼佛、觀音菩薩、太歲星君等（華人大乘佛寺）',
      wishes_zh: ['安太歲', '補財庫', '平安、健康'],
      steps_zh: [
        '在入口處買香和供品',
        '跟台灣的廟一樣，依序拜各殿',
        '要安太歲或點光明燈，到服務處登記',
      ],
      offerings_zh: ['香、蠟燭、金紙', '水果、餅乾', '光明燈、太歲燈（登記付費）'],
      tips_zh: ['農曆新年前後人非常多', '出寺之後就是耀華力路，可以接著逛中國城'],
      thai: [{ th: 'วัดมังกรกมลาวาส', read: 'wát mang-gɔɔn gà-má-laa-wâat', zh: '龍蓮寺' }, SATHU],
    },
  },
  {
    query: 'Sri Maha Mariamman Temple Silom Bangkok',
    name_zh: '印度廟（Sri Maha Mariamman）',
    tag: 'evergreen',
    description_zh: '在 Silom 路上，曼谷最老的印度教廟，外牆滿滿是彩色的神像雕刻。泰國人叫它「Wat Khaek」。主祀烏瑪女神，祭司會幫信眾在額頭點紅。每年十月的九夜節是最熱鬧的時候，整條 Silom 路都會封起來遊行。',
    description_en: 'Bangkok’s oldest Hindu temple, on Silom Road, its tower covered in painted deities. Thais call it Wat Khaek. The Navaratri festival in October closes Silom Road for a parade.',
    temple: {
      deity_zh: '烏瑪女神 Sri Maha Mariamman（濕婆的妻子）',
      wishes_zh: ['平安、健康', '家庭和睦', '事業'],
      steps_zh: [
        '在門口脫鞋，寄放鞋子',
        '在門口攤位買花環和供品',
        '進廟後把供品交給祭司，祭司祝禱後會在你額頭點紅',
        '順時針繞行各神龕',
      ],
      offerings_zh: ['花環', '椰子、香蕉', '蓮花'],
      tips_zh: ['廟內禁止拍照', '穿著要遮肩、過膝', '十月九夜節期間人潮非常多'],
      thai: [{ th: 'วัดแขก', read: 'wát khàek', zh: '印度廟（泰國人的叫法）' }, SATHU],
    },
  },
  {
    query: 'Wat Pho Bangkok',
    name_zh: '臥佛寺',
    tag: 'evergreen',
    description_zh: '曼谷最古老的寺廟之一，裡面有一尊 46 公尺長的金色臥佛，腳底鑲滿螺鈿。臥佛後面有一整排 108 個銅缽，換一杯硬幣一缽丟一枚，是來這裡必做的祈福。寺裡也是泰式按摩的發源地，有按摩學校可以直接體驗。',
    description_en: 'One of Bangkok’s oldest temples, home to a 46-metre golden reclining Buddha. Drop a coin into each of the 108 bronze bowls behind it for good luck. The birthplace of Thai massage, with a school on site.',
    temple: {
      deity_zh: '臥佛（釋迦牟尼佛涅槃像）',
      wishes_zh: ['平安', '好運', '健康'],
      steps_zh: [
        '買門票入寺，先到臥佛殿參觀',
        '在殿內換一杯硬幣',
        '沿著臥佛背後的 108 個銅缽，一缽丟一枚，邊走邊許願',
      ],
      offerings_zh: ['硬幣（殿內兌換）', '蓮花、金箔'],
      tips_zh: ['需要購買門票，價格以現場公告為準', '穿著要遮肩、過膝，不合規定可在門口借衣服', '早上剛開門時人最少'],
      thai: [{ th: 'วัดโพธิ์', read: 'wát phoo', zh: '臥佛寺' }, SATHU],
    },
  },
  {
    query: 'Mae Nak Phra Khanong Shrine Wat Mahabut Bangkok',
    name_zh: '娜娜女鬼廟（Mae Nak）',
    tag: 'hidden_gem',
    description_zh: '在 On Nut 附近的 Wat Mahabut 寺內，供奉泰國最有名的鬼故事主角娜娜。傳說她難產過世，卻一直等丈夫從戰場回家。泰國男生抽兵役前會來求不中籤，也有人來求平安生產和樂透。神壇前堆滿了給她的泰式衣服、化妝品，還有給她孩子的玩具。',
    description_en: 'Inside Wat Mahabut near On Nut, the shrine of Mae Nak, heroine of Thailand’s most famous ghost story. Young men come to pray their way out of the military draft lottery.',
    temple: {
      deity_zh: '娜娜 Mae Nak（泰國民間傳說人物）',
      wishes_zh: ['避兵役（抽籤不中）', '平安生產', '樂透、偏財', '姻緣'],
      steps_zh: [
        '在寺內攤位買香、花環和供品',
        '到娜娜神壇前點香，說出名字和願望',
        '把供品放在神壇前',
      ],
      offerings_zh: ['泰式傳統服裝、化妝品', '嬰兒衣服、玩具（給她的孩子）', '花環、香'],
      tips_zh: ['寺旁的小運河可以餵魚', '從 BTS On Nut 搭計程車或摩托計程車比較方便'],
      thai: [{ th: 'แม่นาค', read: 'mâe nâak', zh: '娜娜' }, SATHU],
    },
  },
]

const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.businessStatus'

async function search(query, lang) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS, 'Referer': 'https://www.bkk-local.com/' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, regionCode: 'TH', languageCode: lang }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return (await res.json()).places?.[0] ?? null
}

const areaOf = (address) => address.match(/Khet ([A-Za-z ]+?)(,| Krung| Bangkok)/)?.[1]?.trim() ?? ''

const locations = JSON.parse(readFileSync('data/locations.json', 'utf-8'))
const existing = new Set(locations.map((l) => l.source_url?.match(/query_place_id=([^&\s]+)/)?.[1]).filter(Boolean))
const added = []

for (const t of TEMPLES) {
  const en = await search(t.query, 'en')
  if (!en) { console.log(`找不到：${t.name_zh}`); continue }
  if (existing.has(en.id)) { console.log(`已存在，跳過：${t.name_zh}`); continue }
  const th = await search(t.query, 'th')
  const address = en.formattedAddress ?? 'Bangkok, Thailand'
  console.log(`${t.name_zh}  →  ${en.displayName?.text}｜${th?.displayName?.text ?? ''}｜${address}｜★${en.rating} (${en.userRatingCount})`)
  added.push({
    id: randomUUID(),
    name_zh: t.name_zh,
    name_en: en.displayName?.text ?? t.query,
    name_th: th?.id === en.id ? th.displayName?.text : undefined,
    description_zh: t.description_zh,
    description_en: t.description_en,
    category: 'temple',
    address,
    address_th: th?.id === en.id ? th.formattedAddress : undefined,
    lat: en.location.latitude,
    lng: en.location.longitude,
    photos: (en.photos ?? []).slice(0, 6).map((p) => p.name),
    source: 'manual',
    source_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${en.displayName?.text} ${address}`)}&query_place_id=${en.id}`,
    rating: en.rating ?? 0,
    price_range: 1,
    tag: t.tag,
    area: areaOf(address),
    temple: t.temple,
    approved_at: new Date().toISOString(),
  })
}

if (apply && added.length) {
  writeFileSync('data/locations.json', JSON.stringify([...locations, ...added], null, 2))
  console.log(`已寫入 ${added.length} 間`)
} else {
  console.log(`預覽：會新增 ${added.length} 間（加 --apply 才寫入）`)
}
