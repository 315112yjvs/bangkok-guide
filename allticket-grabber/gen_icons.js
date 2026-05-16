// 純 Node.js 原生模組產生 PNG icon
// 不需要外部套件
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG 工具 ──────────────────────────────────────────────
function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let k = n;
    for (let i = 0; i < 8; i++) k = (k & 1) ? (0xEDB88320 ^ (k >>> 1)) : (k >>> 1);
    table[n] = k;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeB = Buffer.from(type, 'ascii');
  const len   = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body  = Buffer.concat([typeB, data]);
  const crc   = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePNG(size, drawFn) {
  // RGBA pixel buffer
  const pixels = new Uint8Array(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
  };
  const fill = (r, g, b, a = 255) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) set(x, y, r, g, b, a);
  };
  const circle = (cx, cy, rad, r, g, b, a = 255) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy <= rad*rad) set(x, y, r, g, b, a);
      }
  };
  const rect = (x0, y0, w, h, r, g, b, a = 255) => {
    for (let y = y0; y < y0+h; y++)
      for (let x = x0; x < x0+w; x++) set(x, y, r, g, b, a);
  };
  const triangle = (pts, r, g, b, a = 255) => {
    const minY = Math.floor(Math.min(...pts.map(p=>p[1])));
    const maxY = Math.ceil(Math.max(...pts.map(p=>p[1])));
    for (let y = minY; y <= maxY; y++) {
      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const [x1,y1] = pts[i], [x2,y2] = pts[(i+1)%pts.length];
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
          const t = (y - y1) / (y2 - y1);
          const xi = x1 + t * (x2 - x1);
          minX = Math.min(minX, xi); maxX = Math.max(maxX, xi);
        }
      }
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) set(x, y, r, g, b, a);
    }
  };

  drawFn({ size, set, fill, circle, rect, triangle });

  // Build PNG rows (filter byte 0 = None)
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(0);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      rows.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    }
  }
  const rawData = Buffer.from(rows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon 設計：金色閃電票 on 深藍 ─────────────────────────
// 配色：深藍 #0d2137 背景，金黃 #f5a623 閃電，白色細節
// 風格：圓角正方形外框 + 閃電符號 — 與 TTM 紅色票根差異明顯
function drawIcon(ctx) {
  const { size, fill, circle, rect, triangle, set } = ctx;
  const s = size;
  const pad = Math.round(s * 0.07);

  // 背景：透明
  fill(0, 0, 0, 0);

  // 圓角矩形（用圓角模擬）
  const bg = { r: 13, g: 33, b: 55 };    // 深海藍 #0d2137
  const gr = Math.round(s * 0.18);        // 圓角半徑

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // 四角圓角判斷
      let inside = true;
      if (x < gr && y < gr)         inside = (x-gr)**2+(y-gr)**2 <= gr**2;
      if (x > s-1-gr && y < gr)     inside = (x-(s-1-gr))**2+(y-gr)**2 <= gr**2;
      if (x < gr && y > s-1-gr)     inside = (x-gr)**2+(y-(s-1-gr))**2 <= gr**2;
      if (x > s-1-gr && y > s-1-gr) inside = (x-(s-1-gr))**2+(y-(s-1-gr))**2 <= gr**2;
      if (inside) set(x, y, bg.r, bg.g, bg.b, 255);
    }
  }

  // 閃電符號（金黃色 #f5a623）
  const gold = [245, 166, 35];
  const cx = s / 2;

  // 閃電：簡單多邊形（上三角 + 下三角，中段交錯）
  const lw = s * 0.48;  // 閃電寬
  const lh = s * 0.70;  // 閃電高
  const ly = (s - lh) / 2;

  // 上半（大三角指向右下）
  const top = [
    [cx - lw*0.05, ly],              // 左上
    [cx + lw*0.50, ly],              // 右上
    [cx - lw*0.10, ly + lh*0.50],   // 左中
    [cx + lw*0.20, ly + lh*0.46],   // 右中（稍右）
  ];
  // 下半（小三角指向左上）
  const bot = [
    [cx + lw*0.05, ly + lh],        // 右下
    [cx - lw*0.48, ly + lh],        // 左下
    [cx + lw*0.12, ly + lh*0.50],   // 右中
    [cx - lw*0.18, ly + lh*0.55],   // 左中
  ];

  const drawPoly = (pts, r, g, b) => {
    // scanline fill
    const minY = Math.floor(Math.min(...pts.map(p=>p[1])));
    const maxY = Math.ceil(Math.max(...pts.map(p=>p[1])));
    for (let y = minY; y <= maxY; y++) {
      let xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1,y1] = pts[i], [x2,y2] = pts[(i+1)%pts.length];
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
          xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
        }
      }
      xs.sort((a,b)=>a-b);
      for (let xi = 0; xi < xs.length - 1; xi += 2)
        for (let x = Math.floor(xs[xi]); x <= Math.ceil(xs[xi+1]); x++)
          set(x, y, r, g, b, 255);
    }
  };

  // 閃電整體輪廓（先畫略大的白色邊）
  const expand = (pts, e) => pts.map(([x,y]) => {
    const cx2 = pts.reduce((s,p)=>s+p[0],0)/pts.length;
    const cy2 = pts.reduce((s,p)=>s+p[1],0)/pts.length;
    const dx = x-cx2, dy = y-cy2;
    const len = Math.sqrt(dx*dx+dy*dy)||1;
    return [x + dx/len*e, y + dy/len*e];
  });

  drawPoly(expand(top, s*0.025), 255, 255, 255);
  drawPoly(expand(bot, s*0.025), 255, 255, 255);
  drawPoly(top, ...gold);
  drawPoly(bot, ...gold);

  // 小星星裝飾（右上角，白色）
  const starX = Math.round(s * 0.76), starY = Math.round(s * 0.22);
  const sr = Math.round(s * 0.06);
  circle(starX, starY, sr, 255, 220, 100, 200);
}

// ── 輸出 ─────────────────────────────────────────────────
const outDir = path.join(__dirname, 'icons');
[16, 48, 128].forEach(size => {
  const buf = makePNG(size, drawIcon);
  const out = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✓ ${out} (${buf.length} bytes)`);
});
console.log('Icons generated!');
