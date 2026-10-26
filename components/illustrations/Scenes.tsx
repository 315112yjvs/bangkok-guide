// 繪本風插圖：平塗色塊＋3px 墨灰線，不用漸層。
// vectorEffect="non-scaling-stroke" 讓線條不管插圖放多大都維持 3px。

const INK = '#3E3A39'
const C = { coral: '#F2A497', mustard: '#F6D27A', mizu: '#A8D3E6', matcha: '#B9DAA5', white: '#FFFFFF', sky: '#E1F0F7' }

const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, vectorEffect: 'non-scaling-stroke' as const }

// 嘟嘟車（首頁主圖與空白畫面共用）
function TukTuk({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...line}>
      <path d="M6 6 Q6 0 12 0 H54 Q60 0 60 6 V10 H6 Z" fill={C.coral} />
      <path d="M12 10 V26 M54 10 V26" fill="none" />
      <rect x="14" y="14" width="16" height="9" rx="2" fill={C.white} />
      <path d="M0 22 H64 V34 Q64 38 60 38 H4 Q0 38 0 34 Z" fill={C.mustard} />
      <path d="M64 24 Q76 24 76 36 V38 H64 Z" fill={C.mustard} />
      <circle cx="73" cy="30" r="2" fill={C.white} />
      <circle cx="13" cy="40" r="6" fill={C.white} />
      <circle cx="56" cy="40" r="6" fill={C.white} />
    </g>
  )
}

// 首頁主圖：鄭王廟、椰子樹、BTS 高架列車、嘟嘟車、昭披耶河上的長尾船
export function HeroScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 222" className={className} role="img" aria-label="曼谷街景插圖：鄭王廟、BTS 列車、嘟嘟車與長尾船" preserveAspectRatio="xMidYMax slice">
      <rect width="400" height="222" fill={C.sky} />
      {/* 太陽、雲、鳥 */}
      <circle cx="338" cy="44" r="19" fill={C.mustard} {...line} />
      <path d="M40 56 Q40 45 52 45 Q55 32 70 34 Q80 24 93 34 Q106 34 106 47 Q114 49 112 56 Z" fill={C.white} {...line} />
      <path d="M228 40 Q228 32 237 32 Q240 22 252 24 Q260 17 270 25 Q280 25 280 35 Q286 37 284 42 Z" fill={C.white} {...line} />
      <path d="M176 36 q5 -6 10 0 q5 -6 10 0 M196 52 q4 -5 8 0 q4 -5 8 0" fill="none" {...line} />

      {/* 地面與河 */}
      <path d="M0 150 Q100 138 200 148 T400 146 V222 H0 Z" fill={C.matcha} {...line} />
      <path d="M0 174 Q50 167 100 174 T200 174 T300 174 T400 174 V226 H-4 Z" fill={C.mizu} {...line} />
      <path d="M24 188 q6 -5 12 0 M250 192 q6 -5 12 0 M330 186 q6 -5 12 0 M60 208 q6 -5 12 0 M300 210 q6 -5 12 0" fill="none" {...line} />

      {/* 椰子樹 */}
      <path d="M26 152 Q23 124 31 98 L38 99 Q31 124 35 152 Z" fill={C.mustard} {...line} />
      <path d="M35 98 Q20 84 6 92 Q22 89 35 98 Z M35 98 Q50 82 64 90 Q48 89 35 98 Z M35 98 Q30 78 16 74 Q28 84 35 98 Z M35 98 Q45 77 58 76 Q44 86 35 98 Z" fill={C.matcha} {...line} />

      {/* 鄭王廟：主塔與兩側小塔 */}
      <g {...line}>
        <path d="M64 146 V126 Q64 110 70 100 Q76 110 76 126 V146" fill={C.coral} />
        <path d="M70 100 V90" fill="none" />
        <path d="M164 146 V126 Q164 110 170 100 Q176 110 176 126 V146" fill={C.coral} />
        <path d="M170 100 V90" fill="none" />
        <rect x="80" y="132" width="80" height="16" rx="2" fill={C.white} />
        <rect x="90" y="116" width="60" height="16" rx="2" fill={C.coral} />
        <rect x="98" y="102" width="44" height="14" rx="2" fill={C.white} />
        <path d="M104 102 Q104 66 120 40 Q136 66 136 102 Z" fill={C.mustard} />
        <path d="M107 86 H133 M111 70 H129" fill="none" />
        <path d="M120 40 V22" fill="none" />
        <circle cx="120" cy="20" r="2.5" fill={C.white} />
      </g>

      {/* BTS 高架軌道與列車 */}
      <g {...line}>
        <rect x="244" y="112" width="9" height="40" fill={C.white} />
        <rect x="350" y="112" width="9" height="38" fill={C.white} />
        <rect x="212" y="104" width="196" height="9" fill={C.white} />
        <rect x="226" y="74" width="150" height="30" rx="10" fill={C.white} />
        <path d="M226 96 H376" fill="none" stroke={C.coral} />
        <rect x="236" y="81" width="18" height="10" rx="2" fill={C.mizu} />
        <rect x="260" y="81" width="18" height="10" rx="2" fill={C.mizu} />
        <rect x="284" y="81" width="18" height="10" rx="2" fill={C.mizu} />
        <rect x="308" y="81" width="18" height="10" rx="2" fill={C.mizu} />
        <rect x="332" y="81" width="18" height="10" rx="2" fill={C.mizu} />
      </g>

      <TukTuk x={266} y={120} />

      {/* 長尾船 */}
      <g {...line}>
        <path d="M146 176 V164 M182 176 V164" fill="none" />
        <rect x="140" y="159" width="50" height="6" rx="3" fill={C.mustard} />
        <path d="M126 176 H206 Q200 190 182 190 H146 Q132 189 126 176 Z" fill={C.coral} />
        <path d="M206 178 L226 186" fill="none" />
      </g>
    </svg>
  )
}

// 空白畫面（沒有搜尋結果、沒有收藏）用的小插圖：停著的嘟嘟車
export function EmptyScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true">
      <path d="M4 66 H116" fill="none" {...line} />
      <circle cx="96" cy="18" r="9" fill={C.mustard} {...line} />
      <TukTuk x={20} y={20} />
    </svg>
  )
}
