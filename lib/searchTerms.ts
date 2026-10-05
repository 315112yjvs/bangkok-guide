// 中文搜尋詞 → 店名/介紹裡實際會出現的英文、泰文寫法。
// 店名幾乎都是英文或泰文，使用者打「燒肉」時要能找到 Mookata、BBQ 這些店。
const SYNONYMS: Record<string, string[]> = {
  燒肉: ['mookata', 'moo kata', 'หมูกระทะ', 'bbq', 'barbecue', 'yakiniku', '烤肉'],
  烤肉: ['mookata', 'moo kata', 'หมูกระทะ', 'bbq', 'barbecue', 'yakiniku', '燒肉'],
  火鍋: ['hotpot', 'hot pot', 'shabu', 'suki', 'สุกี้', 'ชาบู'],
  拉麵: ['ramen'],
  壽司: ['sushi', 'omakase'],
  日式: ['japanese', 'izakaya', 'sushi', 'ramen', 'omakase', '日本'],
  日本料理: ['japanese', 'izakaya', 'sushi', 'ramen', 'omakase'],
  居酒屋: ['izakaya'],
  韓式: ['korean', '韓國'],
  義大利: ['italian', 'pasta', 'pizza', '義式'],
  披薩: ['pizza'],
  牛排: ['steak'],
  漢堡: ['burger'],
  海鮮: ['seafood'],
  泰菜: ['thai', '泰式'],
  泰式: ['thai', '泰菜'],
  麵: ['noodle', 'ก๋วยเตี๋ยว'],
  船麵: ['boat noodle'],
  粥: ['porridge', 'congee', 'โจ๊ก'],
  雞飯: ['chicken rice', 'khao man gai', 'ข้าวมันไก่'],
  點心: ['dim sum', 'dimsum', '港式'],
  港式: ['dim sum', 'dimsum', 'cantonese', 'hong kong'],
  早午餐: ['brunch'],
  早餐: ['breakfast', 'brunch'],
  甜點: ['dessert', 'cake', 'bakery', 'pastry', 'croissant'],
  蛋糕: ['cake', 'cheesecake'],
  麵包: ['bakery', 'bread', 'croissant', 'sourdough'],
  可頌: ['croissant'],
  抹茶: ['matcha'],
  咖啡: ['coffee', 'cafe', 'café', 'roaster'],
  下午茶: ['afternoon tea', 'tea room', 'cafe'],
  酒吧: ['bar', 'cocktail', 'speakeasy', 'pub'],
  調酒: ['cocktail', 'bar', 'speakeasy'],
  啤酒: ['beer', 'brew', 'taproom'],
  紅酒: ['wine'],
  爵士: ['jazz'],
  現場音樂: ['live music', 'jazz'],
  高空: ['rooftop', 'sky bar', 'skybar'],
  頂樓: ['rooftop', 'sky bar', 'skybar'],
  夜景: ['rooftop', 'sky bar', 'skybar', 'night view'],
  河景: ['river', 'riverside', 'chao phraya', '昭披耶'],
  素食: ['vegetarian', 'vegan', 'plant-based', 'เจ'],
  米其林: ['michelin', 'bib gourmand'],
  市集: ['market', 'ตลาด'],
  夜市: ['night market', 'market'],
  飯店: ['hotel', 'resort'],
  唐人街: ['yaowarat', 'chinatown'],
  中國城: ['yaowarat', 'chinatown'],
}

// 把使用者輸入展開成一組要比對的字詞（原字詞＋同義寫法），全部小寫
export function expandQuery(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = new Set([q])
  for (const [zh, alts] of Object.entries(SYNONYMS)) {
    if (q.includes(zh)) for (const a of alts) terms.add(a.toLowerCase())
  }
  return Array.from(terms)
}
