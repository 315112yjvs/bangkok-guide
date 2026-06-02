// 產生 Zipevent Auto Buyer icon（藍底 + 白色票券輪廓）
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

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

  const scanPoly = (pts, r, g, b, a = 255) => {
    const minY = Math.floor(Math.min(...pts.map(p=>p[1])));
    const maxY = Math.ceil( Math.max(...pts.map(p=>p[1])));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1,y1] = pts[i], [x2,y2] = pts[(i+1)%pts.length];
        if ((y1<=y && y<y2)||(y2<=y && y<y1))
          xs.push(x1+(y-y1)/(y2-y1)*(x2-x1));
      }
      xs.sort((a,b)=>a-b);
      for (let xi = 0; xi < xs.length-1; xi+=2)
        for (let x = Math.floor(xs[xi]); x <= Math.ceil(xs[xi+1]); x++)
          set(x, y, r, g, b, a);
    }
  };

  drawFn({ size, set, fill, scanPoly });

  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(0);
    for (let x = 0; x < size; x++) {
      const i = (y*size+x)*4;
      rows.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rows), { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon({ size: s, set, fill, scanPoly }) {
  fill(0, 0, 0, 0); // 透明底

  // 圓角矩形藍色背景
  const gr = Math.round(s * 0.22);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let inside = true;
      const xl = x < gr, xr = x > s-1-gr, yt = y < gr, yb = y > s-1-gr;
      if (xl && yt) inside = (x-gr)**2+(y-gr)**2         <= gr**2;
      else if (xr && yt) inside = (x-(s-1-gr))**2+(y-gr)**2     <= gr**2;
      else if (xl && yb) inside = (x-gr)**2+(y-(s-1-gr))**2     <= gr**2;
      else if (xr && yb) inside = (x-(s-1-gr))**2+(y-(s-1-gr))**2 <= gr**2;
      if (inside) set(x, y, 0, 112, 243, 255); // #0070f3
    }
  }

  // 票券形狀（白色，兩側半圓缺口）
  const tw = Math.round(s * 0.74);
  const th = Math.round(s * 0.38);
  const tx = Math.round((s - tw) / 2);
  const ty = Math.round((s - th) / 2);
  const nr = Math.round(th * 0.28);

  for (let y = ty; y < ty+th; y++) {
    for (let x = tx; x < tx+tw; x++) {
      const ldx = x - tx,      ldy = y - (ty + th/2);
      const rdx = x - (tx+tw), rdy = y - (ty + th/2);
      if (ldx < nr && ldx*ldx + ldy*ldy <= nr*nr) continue;
      if (rdx > -nr && rdx*rdx + rdy*rdy <= nr*nr) continue;
      set(x, y, 255, 255, 255, 255);
    }
  }

  // 中央虛線（票券撕開線）
  const midX = Math.round(s / 2);
  const dashLen = Math.round(th * 0.18);
  for (let y = ty+2; y < ty+th-2; y++) {
    const phase = Math.floor((y - ty) / dashLen) % 2;
    if (phase === 0) set(midX, y, 0, 112, 243, 200); // 藍色虛線
  }

  // 右半部分：打勾符號（✓）
  if (s >= 48) {
    const cx = tx + tw * 0.72;
    const cy = ty + th * 0.5;
    const cs = th * 0.28;
    const pts = [
      [cx - cs*0.5, cy],
      [cx - cs*0.1, cy + cs*0.38],
      [cx + cs*0.5, cy - cs*0.38],
      [cx + cs*0.5, cy - cs*0.18],
      [cx - cs*0.1, cy + cs*0.55],
      [cx - cs*0.5, cy + cs*0.18],
    ];
    scanPoly(pts, 0, 200, 100, 230);
  }
}

const outDir = path.join(__dirname, 'icons');
[16, 48, 128].forEach(size => {
  const buf = makePNG(size, drawIcon);
  const out = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✓ ${out} (${buf.length} bytes)`);
});
console.log('Zipevent icons generated!');
