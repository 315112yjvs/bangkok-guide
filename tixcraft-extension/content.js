// TixCraft 搶票助手 v2.0
// 流程: DETAIL → 場次(立即訂購) → AREA(選票區) → TICKET(選張數+驗證碼+送出)

(() => {
'use strict';

// ── 頁面類型 ─────────────────────────────────────────────
const PAGE = (() => {
  const p = location.pathname;
  if (p.includes('/activity/detail/')) return 'DETAIL';
  if (p.includes('/activity/game/'))   return 'GAME';
  if (p.includes('/ticket/area/'))     return 'AREA';
  if (p.includes('/ticket/ticket/'))   return 'TICKET';
  return 'OTHER';
})();

const ACTIVE = PAGE !== 'OTHER';
console.log('[TixCraft搶票] PAGE=', PAGE, location.pathname);

// ── 狀態 ────────────────────────────────────────────────
let isRunning        = false;
let tickTimer        = null;
let tickCount        = 0;
let cfg              = {};
let overlayEl        = null;
let done             = false;
let detailBuyClicked = false;
let areaClicked      = false;
let ticketSetup      = false;
let captchaSolving   = false;
let keepaliveTimer   = null;
let mutObs           = null;

// ── Gaussian 隨機 (Box-Muller) ──────────────────────────
function gaussRandom(mean, std) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(mean * 0.3, Math.min(mean * 3, mean + z * std));
}

// ── 開賣時間 → 階段 ──────────────────────────────────────
function getPhase() {
  if (!cfg.saleTime) return 'ACTIVE';
  const now  = new Date();
  const [h, m] = cfg.saleTime.split(':').map(Number);
  const sale = new Date(now);
  sale.setHours(h, m, 0, 0);
  if (sale <= now) sale.setDate(sale.getDate() + 1);
  const diffMs = sale - now;
  if (diffMs > 20_000) return 'WAITING';
  if (diffMs > 0)      return 'READY';
  return 'ACTIVE';
}

function getSaleCountdown() {
  if (!cfg.saleTime) return '';
  const now  = new Date();
  const [h, m] = cfg.saleTime.split(':').map(Number);
  const sale = new Date(now);
  sale.setHours(h, m, 0, 0);
  if (sale <= now) sale.setDate(sale.getDate() + 1);
  const s = Math.max(0, Math.round((sale - now) / 1000));
  return ` | T-${s}s`;
}

function getTickDelay() {
  const base = cfg.interval || 300;
  switch (getPhase()) {
    case 'WAITING': return gaussRandom(5000, 1200);
    case 'READY':   return gaussRandom(80, 25);
    default:        return gaussRandom(base, base * 0.25);
  }
}

// ── HUD overlay ──────────────────────────────────────────
function createOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.id = '__tix_hud__';
  overlayEl.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
    'background:rgba(8,6,20,.96)', 'color:#e0e0f0',
    'border:1.5px solid #00d4ff', 'border-radius:10px',
    'padding:10px 14px', 'font:600 11px/1.7 monospace',
    'min-width:230px', 'max-width:340px',
    'box-shadow:0 4px 24px rgba(0,212,255,.2)', 'pointer-events:none'
  ].join(';');
  overlayEl.innerHTML = `
    <div style="color:#00d4ff;font-size:12px;margin-bottom:2px">🎯 TixCraft 搶票助手</div>
    <div id="__tix_msg__" style="color:#aaa">初始化...</div>
    <div id="__tix_sub__" style="color:#4a5070;font-size:10px;margin-top:1px"></div>
  `;
  document.body.appendChild(overlayEl);
}

function hud(msg, color, sub) {
  if (!overlayEl) createOverlay();
  if (msg !== undefined) {
    const m = document.getElementById('__tix_msg__');
    if (m) { m.textContent = msg; m.style.color = color || '#aaa'; }
  }
  if (sub !== undefined) {
    const s = document.getElementById('__tix_sub__');
    if (s) s.textContent = sub;
  }
}

function removeOverlay() { overlayEl?.remove(); overlayEl = null; }

// ── 工具 ────────────────────────────────────────────────
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function isVisible(el) {
  if (!el) return false;
  const s = getComputedStyle(el);
  return !!(el.offsetWidth || el.offsetHeight) &&
    s.display !== 'none' && s.visibility !== 'hidden';
}

// ── 人類模擬點擊（隨機座標 + micro-delay）───────────────
async function doClick(el) {
  if (!el) return;
  try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) {}
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width  * (0.3 + Math.random() * 0.4);
  const cy = r.top  + r.height * (0.3 + Math.random() * 0.4);
  const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
  el.dispatchEvent(new MouseEvent('mouseover',  opts));
  await wait(gaussRandom(35, 12));
  el.dispatchEvent(new MouseEvent('mousedown',  opts));
  await wait(gaussRandom(55, 18));
  el.dispatchEvent(new MouseEvent('mouseup',    opts));
  el.dispatchEvent(new MouseEvent('click',      opts));
  el.click();
}

// ── Session keepalive ─────────────────────────────────
function startKeepalive() {
  stopKeepalive();
  keepaliveTimer = setInterval(() => {
    fetch('/images/tmtw-logo.svg', { credentials: 'include', cache: 'no-store' })
      .catch(() => {});
  }, 3 * 60 * 1000);
}

function stopKeepalive() {
  if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
}

// ── MutationObserver (DETAIL/GAME/AREA 即時觸發) ────────
function setupObserver() {
  if (mutObs) return;
  if (!['DETAIL', 'GAME', 'AREA'].includes(PAGE)) return;
  mutObs = new MutationObserver(() => {
    if (!isRunning || done) return;
    clearTimeout(tickTimer);
    tick();
    scheduleTick();
  });
  mutObs.observe(document.body, { childList: true, subtree: true, attributes: false });
}

function stopObserver() {
  if (mutObs) { mutObs.disconnect(); mutObs = null; }
}

// ── 自調度 tick ───────────────────────────────────────
function scheduleTick() {
  if (tickTimer) clearTimeout(tickTimer);
  if (!isRunning || done) return;
  tickTimer = setTimeout(() => {
    tick();
    scheduleTick();
  }, getTickDelay());
}

// ── 啟動 / 停止 ───────────────────────────────────────
function start(newCfg) {
  if (isRunning) return;
  cfg              = newCfg || {};
  isRunning        = true;
  done             = false;
  tickCount        = 0;
  detailBuyClicked = false;
  areaClicked      = false;
  ticketSetup      = false;
  captchaSolving   = false;
  createOverlay();
  hud('就緒，開始搶票', '#4cff91', PAGE);
  console.log('[TixCraft搶票] 啟動 PAGE=', PAGE, 'cfg=', JSON.stringify(cfg));
  setupObserver();
  startKeepalive();
  scheduleTick();
}

function stop() {
  isRunning = false;
  clearTimeout(tickTimer);
  tickTimer = null;
  stopObserver();
  stopKeepalive();
  removeOverlay();
  chrome.storage.local.set({ tix_running: false });
}

// ── 訊息監聽 ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'START') start(msg.cfg);
  if (msg.action === 'STOP')  stop();
});

chrome.storage.local.get(['tix_running', 'tix_cfg'], (d) => {
  if (d.tix_running && ACTIVE) start(d.tix_cfg || {});
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.tix_running?.newValue === true  && !isRunning && ACTIVE)
    chrome.storage.local.get('tix_cfg', d => start(d.tix_cfg || {}));
  if (changes.tix_running?.newValue === false && isRunning) stop();
});

// ── 主迴圈 ───────────────────────────────────────────────
function tick() {
  if (!isRunning || done) return;
  tickCount++;

  const phase = getPhase();
  const sub   = `第 ${tickCount} 次 | ${PAGE}` + (phase === 'WAITING' ? getSaleCountdown() : '');
  hud(undefined, undefined, sub);

  if (phase === 'WAITING') {
    hud(`等待開賣 ${cfg.saleTime}${getSaleCountdown()}`, '#ffbd2e');
    return;
  }
  if (phase === 'READY') {
    hud('即將開賣，衝！', '#00ff88');
  }

  if      (PAGE === 'DETAIL') handleDetail();
  else if (PAGE === 'GAME')   handleGame();
  else if (PAGE === 'AREA')   handleArea();
  else if (PAGE === 'TICKET') handleTicket();
}

// ════════════════════════════════════════════════════════
// DETAIL / GAME — 找「立即訂購」或先點「立即購票」
// ════════════════════════════════════════════════════════
function handleDetail() {
  const orderBtn = document.querySelector('button[data-href*="ticket/area"]');
  if (orderBtn && !orderBtn.disabled && isVisible(orderBtn)) {
    const label = orderBtn.closest('tr')?.textContent.trim().replace(/\s+/g, ' ').substring(0, 40) || '';
    hud('點擊「立即訂購」', '#4cff91', label);
    done = true;
    clearTimeout(tickTimer);
    const href = orderBtn.getAttribute('data-href');
    if (href) location.href = href;
    else doClick(orderBtn);
    return;
  }

  if (!detailBuyClicked) {
    const buyBtn =
      document.querySelector('a.btn-primary[href*="game"]') ||
      document.querySelector('a[href*="/activity/game/"]') ||
      Array.from(document.querySelectorAll('a,button'))
        .find(el => el.textContent.trim() === '立即購票' && isVisible(el));

    if (!buyBtn) { hud('找不到「立即購票」', '#ffbd2e'); return; }
    hud('點擊「立即購票」...', '#88aaff');
    detailBuyClicked = true;
    doClick(buyBtn);
    return;
  }

  hud('等待場次表格...', '#ffbd2e');
}

function handleGame() { handleDetail(); }

// ════════════════════════════════════════════════════════
// AREA — 選票區
// ════════════════════════════════════════════════════════
function handleArea() {
  if (areaClicked) return;

  const links = Array.from(document.querySelectorAll('.area-list li a'))
    .filter(a => parseFloat(a.style.opacity ?? '1') > 0.3);

  if (!links.length) { hud('等待票區載入...', '#88aaff'); return; }

  function remaining(a) {
    const m = a.textContent.match(/剩餘\s*(\d+)/);
    return m ? parseInt(m[1]) : 0;
  }

  const priorities = (cfg.areas || []).map(s => s.trim()).filter(Boolean);
  let chosen = null;

  for (const kw of priorities) {
    const kw2 = kw.replace(/\s+/g, '');
    const match = links.find(a => a.textContent.replace(/\s+/g, '').includes(kw2) && remaining(a) > 0);
    if (match) { chosen = match; break; }
  }

  if (!chosen) {
    const avail = links.filter(a => remaining(a) > 0);
    if (!avail.length) { hud('所有票區售罄！', '#ff4757'); return; }
    avail.sort((a, b) => remaining(b) - remaining(a));
    chosen = avail[0];
  }

  hud(`選票區：${chosen.textContent.trim().replace(/\s+/g, ' ')}`, '#4cff91');
  areaClicked = true;
  chrome.storage.local.set({ tix_running: true });
  doClick(chosen);
}

// ════════════════════════════════════════════════════════
// TICKET — 選張數 + OCR 驗證碼 + 同意 + 送出
// ════════════════════════════════════════════════════════
function handleTicket() {
  if (ticketSetup) return;

  const qty    = String(cfg.qty || 1);
  const typeKw = (cfg.ticketType || '').replace(/\s+/g, '');
  const selects = Array.from(document.querySelectorAll('select[name^="TicketForm[ticketPrice]"]'));
  if (!selects.length) { hud('等待票種載入...', '#88aaff'); return; }

  let targetSelect = selects[0];
  if (typeKw) {
    const match = selects.find(s =>
      s.closest('tr')?.textContent.replace(/\s+/g, '').includes(typeKw));
    if (match) targetSelect = match;
  }

  if (targetSelect.value !== qty) {
    const opt = Array.from(targetSelect.options).find(o => o.value === qty);
    if (opt) {
      targetSelect.value = qty;
      targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
      targetSelect.dispatchEvent(new Event('input',  { bubbles: true }));
      const label = targetSelect.closest('tr')?.querySelector('td:first-child a')?.textContent.trim().substring(0, 20) || '';
      hud(`已選 ${qty} 張：${label}`, '#4cff91');
    }
  }

  const captchaInput = document.querySelector('#TicketForm_verifyCode');
  const captchaImg   = document.querySelector('#TicketForm_verifyCode-image');
  if (!captchaInput || !captchaImg) { hud('等待驗證碼元素...', '#88aaff'); return; }

  ticketSetup = true;

  captchaImg.style.cssText   += 'transform:scale(2.5);transform-origin:left center;margin-bottom:60px;cursor:pointer;display:block;';
  captchaInput.style.cssText += 'border:3px solid #00d4ff !important;box-shadow:0 0 14px rgba(0,212,255,.5) !important;font-size:16px !important;';

  hud('🔍 OCR 識別驗證碼中...', '#88aaff');
  solveCaptchaWithOCR(captchaImg, captchaInput);
}

// ── Canvas 前處理（3倍放大 + 灰階 + 對比拉伸 + 二值化）──
async function preprocessCaptcha(imgEl) {
  await new Promise(resolve => {
    if (imgEl.complete && imgEl.naturalWidth) { resolve(); return; }
    imgEl.onload = resolve;
  });

  const scale  = 3;
  const canvas = document.createElement('canvas');
  canvas.width  = imgEl.naturalWidth  * scale;
  canvas.height = imgEl.naturalHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = max - min || 1;

  for (let i = 0; i < data.length; i += 4) {
    const g   = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] - min) / range * 255;
    const bw  = g > 140 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = bw;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
}

// ── OCR.space 自動識別驗證碼 ─────────────────────────────
async function solveCaptchaWithOCR(imgEl, inputEl) {
  if (captchaSolving) return;
  captchaSolving = true;

  const ocrKey = 'K84710177388957';
  let retries  = 0;

  async function attempt() {
    try {
      hud('📸 前處理驗證碼...', '#88aaff');
      const base64 = await preprocessCaptcha(imgEl);
      if (!base64) throw new Error('圖片前處理失敗');

      hud('🔍 OCR 識別中...', '#88aaff');
      const text = await callOCRSpace(base64, ocrKey);
      if (!text) throw new Error('未識別出文字');

      console.log('[TixCraft搶票] OCR 結果:', text);
      hud(`✅ 識別：${text}`, '#4cff91', '填入並送出...');

      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));

      await wait(gaussRandom(180, 50));
      const agree = document.querySelector('#TicketForm_agree');
      if (agree && !agree.checked) agree.click();

      await wait(gaussRandom(280, 70));
      submitTicket();

    } catch (err) {
      console.error('[TixCraft搶票] OCR失敗:', err);
      retries++;
      captchaSolving = false;

      if (retries < 3) {
        hud(`識別失敗，重試 (${retries}/3)...`, '#ffbd2e');
        doClick(imgEl);
        await wait(gaussRandom(1200, 300));
        captchaSolving = false;
        await attempt();
      } else {
        hud('OCR 失敗，請手動輸入', '#ff4757', '輸入後按 Enter 送出');
        captchaSolving = false;
        inputEl.focus();
        setupManualCaptchaListeners(inputEl);
      }
    }
  }

  await attempt();
}

// ── OCR.space API ─────────────────────────────────────
async function callOCRSpace(base64, apiKey) {
  const form = new FormData();
  form.append('apikey',           apiKey);
  form.append('base64Image',      `data:image/png;base64,${base64}`);
  form.append('language',         'eng');
  form.append('OCREngine',        '2');
  form.append('isOverlayRequired','false');
  form.append('detectOrientation','false');
  form.append('scale',            'true');

  const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`OCR API ${res.status}`);

  const data = await res.json();
  if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] || 'OCR error');

  const raw = data.ParsedResults?.[0]?.ParsedText || '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// ── 手動模式 ──────────────────────────────────────────
function setupManualCaptchaListeners(inputEl) {
  inputEl.addEventListener('input', () => {
    if (inputEl.value.trim().length < 2) return;
    const agree = document.querySelector('#TicketForm_agree');
    if (agree && !agree.checked) agree.click();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const agree = document.querySelector('#TicketForm_agree');
    if (agree && !agree.checked) agree.click();
    setTimeout(submitTicket, 200);
  });
}

function submitTicket() {
  const btn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
    .find(b => isVisible(b) && !b.disabled &&
      (b.textContent.includes('確認張數') || (b.value && b.value.includes('確認張數'))));

  if (btn) {
    hud('✅ 送出訂單！', '#4cff91');
    console.log('[TixCraft搶票] 點擊確認張數');
    stop();
    doClick(btn);
  } else {
    const form = document.querySelector('form');
    if (form) { stop(); form.submit(); }
  }
}

})();
