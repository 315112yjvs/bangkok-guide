// 精選地標：選一個就以它為中心顯示附近的店（用自家資料 + haversine 計算，零 API 成本）
// 座標為大略中心點，足夠用於 5km 半徑篩選。之後想加直接往清單補。
export type Landmark = { id: string; zh: string; en: string; emoji: string; lat: number; lng: number }

export const LANDMARKS: Landmark[] = [
  { id: 'chatuchak',     zh: '恰圖恰市集',    en: 'Chatuchak Market',   emoji: '🛍️', lat: 13.7999, lng: 100.5503 },
  { id: 'central-ladprao', zh: 'Central Ladprao', en: 'Central Ladprao', emoji: '🏬', lat: 13.8163, lng: 100.5610 },
  { id: 'siam',          zh: 'Siam 商圈',      en: 'Siam',               emoji: '🚇', lat: 13.7460, lng: 100.5340 },
  { id: 'centralworld',  zh: 'CentralWorld',   en: 'CentralWorld',       emoji: '🏬', lat: 13.7466, lng: 100.5396 },
  { id: 'asok',          zh: 'Asok / Terminal 21', en: 'Asok',          emoji: '🚇', lat: 13.7373, lng: 100.5601 },
  { id: 'phrom-phong',   zh: 'Phrom Phong / EmQuartier', en: 'Phrom Phong', emoji: '🏬', lat: 13.7305, lng: 100.5697 },
  { id: 'thonglor',      zh: 'Thonglor',       en: 'Thonglor',           emoji: '🍸', lat: 13.7240, lng: 100.5790 },
  { id: 'ekkamai',       zh: 'Ekkamai',        en: 'Ekkamai',            emoji: '🍜', lat: 13.7197, lng: 100.5853 },
  { id: 'ari',           zh: 'Ari',            en: 'Ari',                emoji: '☕', lat: 13.7797, lng: 100.5447 },
  { id: 'yaowarat',      zh: '唐人街 Yaowarat', en: 'Chinatown (Yaowarat)', emoji: '🏮', lat: 13.7400, lng: 100.5090 },
  { id: 'icon-siam',     zh: 'ICONSIAM',       en: 'ICONSIAM',           emoji: '🛍️', lat: 13.7266, lng: 100.5100 },
  { id: 'khaosan',       zh: '考山路',         en: 'Khaosan Road',       emoji: '🎒', lat: 13.7590, lng: 100.4977 },
  { id: 'sathorn',       zh: 'Sathorn',        en: 'Sathorn',            emoji: '🏙️', lat: 13.7220, lng: 100.5290 },
  { id: 'victory',       zh: '勝利紀念碑',     en: 'Victory Monument',   emoji: '🗽', lat: 13.7650, lng: 100.5380 },
]
