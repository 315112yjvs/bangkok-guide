// content.js — AllTicket 搶票核心 v1.3
// 流程: BUY → CHECK → ZONE → SEAT（選滿） → BOOK（勾選+Booking）→ DONE

let tickerTimeout = null;
let isRunning     = false;
let settings      = null;
let phase         = 'IDLE';
let tickCount     = 0;
let overlayEl     = null;
let seatsTried    = new Set();
let seatsSelected = 0;
let checkClicked  = false;
let currentZone   = '';   // 當前選取的 Zone，用於決定座位方向偏好

// ── Overlay ──────────────────────────────────────────────
function createOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = `
    position:fixed;top:12px;right:12px;z-index:999999;
    background:rgba(8,22,45,.96);color:#e0e0f0;
    border:1.5px solid #f5a623;border-radius:10px;
    padding:10px 14px;font:600 11px/1.6 monospace;
    min-width:240px;max-width:340px;
    box-shadow:0 4px 24px rgba(0,0,0,.7);
    pointer-events:none;
  `;
  overlayEl.innerHTML = `
    <div style="color:#f5a623;font-size:12px;margin-bottom:3px">⚡ AllTicket 搶票助手</div>
    <div id="__at_s__" style="color:#aaa">初始化...</div>
    <div id="__at_c__" style="color:#555;font-size:10px;margin-top:2px"></div>
  `;
  document.body.appendChild(overlayEl);
}
const setO  = (t, c='#aaa') => {
  if (!overlayEl) createOverlay();
  const e = document.getElementById('__at_s__');
  if (e) { e.textContent = t; e.style.color = c; }
};
const setO2 = t => {
  if (!overlayEl) return;
  const e = document.getElementById('__at_c__');
  if (e) e.textContent = t;
};
const rmO = () => { overlayEl?.remove(); overlayEl = null; };

// ── 啟動 / 停止 ───────────────────────────────────────────
function start(cfg) {
  if (isRunning) return;
  settings      = cfg;
  isRunning     = true;
  tickCount     = 0;
  seatsSelected = 0;
  checkClicked  = false;
  seatsTried    = new Set();
  phase         = 'BUY';
  createOverlay();
  setO('啟動，尋找 BUY NOW...', '#88aaff');
  log('啟動搶票', 'info');
  scheduleTick();
}

function stop() {
  isRunning = false;
  clearTimeout(tickerTimeout);
  tickerTimeout = null;
  phase = 'IDLE';
  rmO();
}

function scheduleTick() {
  if (!isRunning) return;
  const base   = settings?.interval || 400;
  const jitter = (Math.random() - 0.5) * 150;
  tickerTimeout = setTimeout(() => {
    tick();
    scheduleTick();
  }, Math.max(200, base + jitter));
}

// ── 訊息接收 ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _, res) => {
  if (msg.action === 'START') { start(msg.settings); res({ ok: true }); }
  if (msg.action === 'STOP')  { stop();              res({ ok: true }); }
  if (msg.action === 'STATUS') res({ phase, tickCount, seatsSelected });
});

chrome.storage.local.get(['isRunning','zoneKeywords','seatCount','interval','autoRefresh'], d => {
  if (d.isRunning) start({
    zoneKeywords: d.zoneKeywords || [],
    seatCount:    d.seatCount    || 1,
    interval:     d.interval     || 400,
    autoRefresh:  d.autoRefresh  || false,
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.isRunning?.newValue === true  && !isRunning)
    chrome.storage.local.get(['zoneKeywords','seatCount','interval','autoRefresh'], d =>
      start({ zoneKeywords: d.zoneKeywords||[], seatCount: d.seatCount||1, interval: d.interval||400, autoRefresh: d.autoRefresh||false }));
  if (changes.isRunning?.newValue === false && isRunning) stop();
});

// ── 主迴圈 ────────────────────────────────────────────────
function tick() {
  if (!isRunning) return;
  tickCount++;
  setO2(`偵測 ${tickCount} 次 | 步驟: ${phase}`);

  if      (phase === 'BUY')  handleBuy();
  else if (phase === 'CHECK') handleCheck();
  else if (phase === 'ZONE')  handleZone();
  else if (phase === 'SEAT')  handleSeat();
  else if (phase === 'BOOK')  handleBook();
}

// ════════════════════════════════════════════════════════
// STEP 1 — 點擊 BUY NOW
// ════════════════════════════════════════════════════════
function handleBuy() {
  const buyBtn = document.getElementById('butBuy') ||
                 document.querySelector('button.btn-atk-primary');

  if (!buyBtn) {
    setO('等待頁面載入...', '#88aaff');
    if (settings?.autoRefresh && tickCount % 15 === 0) location.reload();
    return;
  }
  if (buyBtn.style.display === 'none' || buyBtn.disabled) {
    setO('BUY NOW 尚未開放...', '#ffcc44');
    if (settings?.autoRefresh && tickCount % 15 === 0) location.reload();
    return;
  }
  // Zone 面板已出現 → 直接進 CHECK
  if (document.querySelector('button.btn-outline-info, .seat-ava')) {
    phase = 'CHECK';
    return;
  }

  setO('點擊 BUY NOW！', '#4cff91');
  log('點擊 BUY NOW', 'success');
  phase = 'CHECK';
  checkClicked = false;
  humanClick(buyBtn);
}

// ════════════════════════════════════════════════════════
// STEP 2 — 點擊 CHECK SEAT AVAILABLE
// ════════════════════════════════════════════════════════
function handleCheck() {
  // Zone 表格已出現 → 進 ZONE
  if (document.querySelectorAll('.seat-ava').length > 0) {
    phase = 'ZONE';
    return;
  }
  // 確認彈窗
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) {
    humanClick(yesBtn);
    return;
  }
  const checkBtn = document.querySelector('button.btn-outline-info') ||
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('CHECK SEAT AVAILABLE'));
  if (!checkBtn) { setO('等待 Zone 面板...', '#88aaff'); return; }
  if (!checkClicked) {
    checkClicked = true;
    setO('查詢各 Zone 座位數...', '#88aaff');
    log('點擊 CHECK SEAT AVAILABLE', 'info');
    humanClick(checkBtn);
  } else {
    setO('等待座位資料...', '#88aaff');
  }
}

// ════════════════════════════════════════════════════════
// STEP 3 — 選 Zone（票價高→低，跳過售罄）
// ════════════════════════════════════════════════════════
function handleZone() {
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) { humanClick(yesBtn); return; }

  const zoneRows = document.querySelectorAll('.seat-ava');
  if (!zoneRows.length) { phase = 'CHECK'; checkClicked = false; return; }

  // 可購買：無 .not-ava 且有 cursor:pointer
  const availZones = [...zoneRows]
    .map(row => row.querySelector('span.badge.badge-light'))
    .filter(span => span && !span.classList.contains('not-ava') && span.style.cursor === 'pointer');

  const kws = (settings?.zoneKeywords || []).map(k => k.toUpperCase().trim());
  let chosen = null;

  if (kws.length) {
    chosen = availZones.find(s =>
      kws.some(kw => {
        const name = s.textContent.trim().toUpperCase();
        return name === kw || name.includes(kw);
      })
    );
    if (!chosen) {
      setO(`Zone [${kws.join('/')}] 無空位或不存在，等待...`, '#ffcc44');
      return;
    }
  } else {
    chosen = availZones[0]; // 票價最高的第一個
    if (!chosen) { setO('所有 Zone 已售罄！', '#ff4444'); return; }
  }

  const zoneName = chosen.textContent.trim();
  currentZone = zoneName;
  setO(`點擊 Zone: ${zoneName}（票價最高可用）`, '#4cff91');
  log(`選擇 Zone: ${zoneName}`, 'success');
  chrome.storage.local.set({ currentStep: 'ZONE', currentZone: zoneName });
  chrome.runtime.sendMessage({ type: 'STEP', step: 'ZONE', zone: zoneName }).catch(() => {});
  phase = 'SEAT';
  seatsTried.clear();
  seatsSelected = 0;
  chosen.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// ════════════════════════════════════════════════════════
// STEP 4 — 選座位（必須確認選中後才離開此步驟）
// ════════════════════════════════════════════════════════
let seatFailCount  = 0;
let seatPhase      = 'PICKING'; // 'PICKING' | 'WAITING'

function handleSeat() {
  const seatCount = settings?.seatCount || 1;

  // 偵測已選座位數（svg.seat.selected = 藍色打勾）
  const selectedSeats = document.querySelectorAll('svg.seat.selected');

  // ── 座位已選滿，進入 BOOK 步驟 ──
  if (selectedSeats.length >= seatCount) {
    setO(`✓ 已選 ${selectedSeats.length} 張座位，前往 Booking...`, '#4cff91');
    log(`座位選取完成 (${selectedSeats.length}/${seatCount})`, 'success');
    phase = 'BOOK';
    seatFailCount = 0;
    seatPhase = 'PICKING';
    return;
  }

  // ── 處理彈窗 ──
  const okBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().toUpperCase() === 'OK' && isVisible(b));
  if (okBtn) {
    setO('點擊彈窗 OK...', '#88aaff');
    humanClick(okBtn);
    return;
  }
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) { humanClick(yesBtn); return; }

  // ── 尋找可用座位 ──
  if (!document.querySelector('svg.seat')) {
    setO('等待座位圖載入...', '#88aaff');
    return;
  }

  const allAvail = [...document.querySelectorAll('svg.seat.available')]
    .filter(s => !seatsTried.has(s));

  if (!allAvail.length) {
    if (selectedSeats.length > 0) {
      // 部分選到，繼續往下
      setO(`無更多空位，已選 ${selectedSeats.length} 張，繼續...`, '#4cff91');
      phase = 'BOOK';
      seatPhase = 'PICKING';
    } else {
      seatFailCount++;
      setO(`搜尋座位... (${seatFailCount})`, '#88aaff');
      if (seatFailCount >= 5) {
        setO('此 Zone 無座位，返回重選...', '#ff8844');
        log('Zone 無座位，返回重選', 'warn');
        phase = 'CHECK';
        checkClicked = false;
        seatFailCount = 0;
        seatPhase = 'PICKING';
      }
    }
    return;
  }

  // ── 依視角排序後點擊最佳座位 ──
  seatFailCount = 0;
  const sorted = sortSeats(allAvail, currentZone);
  const seat = sorted[0];
  seatsTried.add(seat);
  const curSelected = selectedSeats.length;
  setO(`點擊座位 (${curSelected + 1}/${seatCount})...`, '#88aaff');
  seat.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  // 等 400ms 後確認是否選中
  seatPhase = 'WAITING';
  setTimeout(() => {
    const nowSelected = document.querySelectorAll('svg.seat.selected').length;
    if (nowSelected > curSelected) {
      seatsSelected = nowSelected;
      log(`✓ 座位 ${nowSelected}/${seatCount} 已選`, 'success');
      setO(`✓ 座位 ${nowSelected}/${seatCount} 已選`, '#4cff91');
      chrome.storage.local.set({ seatsSelected: nowSelected });
      chrome.runtime.sendMessage({ type: 'SEATS', count: nowSelected }).catch(() => {});
    }
    seatPhase = 'PICKING';
  }, 400);
}

// ════════════════════════════════════════════════════════
// STEP 5 — 勾選同意框 + 點擊 Booking
// 前提：必須已有 svg.seat.selected（座位確認選中）
// ════════════════════════════════════════════════════════
let bookAttempts = 0;

function handleBook() {
  // 安全檢查：確認有選到座位才繼續
  const selectedSeats = document.querySelectorAll('svg.seat.selected');
  if (selectedSeats.length === 0) {
    setO('未偵測到選中座位，返回選座...', '#ff8844');
    log('未選到座位，退回 SEAT 步驟', 'warn');
    phase = 'SEAT';
    seatsTried.clear();
    bookAttempts = 0;
    return;
  }

  // 處理任何 OK 彈窗（Please select seat / 驗證彈窗）
  const okBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().toUpperCase() === 'OK' && isVisible(b));
  if (okBtn) {
    const bodyText = document.body.innerText || '';
    if (bodyText.includes('Please select seat') || bodyText.includes('select seat')) {
      // 這不應該發生（我們已有選中座位），可能是殘留彈窗
      setO('點擊 OK 關閉...', '#ffcc44');
      humanClick(okBtn);
      return;
    }
    // 驗證彈窗（กรุณาคลิก ยินยอม）→ 點 OK
    setO('點擊驗證 OK...', '#88aaff');
    log('點擊驗證彈窗 OK', 'info');
    humanClick(okBtn);
    return;
  }

  // 勾選同意框（#GMM10）
  const consentCb = document.getElementById('GMM10') ||
    document.querySelector('input.form-check-input[type="checkbox"]');
  if (consentCb && !consentCb.checked) {
    setO('勾選同意條款...', '#88aaff');
    log('勾選 #GMM10 同意授權', 'info');
    consentCb.click();
    consentCb.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // 點擊 Booking
  const bookBtn = document.querySelector('button.btn-book');
  if (!bookBtn || !isVisible(bookBtn)) {
    setO('等待 Booking 按鈕...', '#88aaff');
    bookAttempts++;
    if (bookAttempts > 20) {
      // 超過等待次數，可能頁面狀態異常，重試勾選
      bookAttempts = 0;
      if (consentCb) { consentCb.click(); }
    }
    return;
  }
  if (bookBtn.disabled) {
    setO('Booking 按鈕未啟用，等待勾選生效...', '#ffcc44');
    // 重新勾選一次
    if (consentCb && !consentCb.checked) consentCb.click();
    return;
  }

  setO(`✓ 點擊 Booking！座位: ${selectedSeats.length} 張`, '#4cff91');
  log(`點擊 Booking！${selectedSeats.length} 張座位`, 'success');
  phase = 'DONE';
  bookAttempts = 0;
  isRunning = false;
  clearTimeout(tickerTimeout);
  chrome.storage.local.set({ isRunning: false, currentStep: 'DONE' });
  chrome.runtime.sendMessage({ type: 'STEP', step: 'DONE' }).catch(() => {});
  humanClick(bookBtn);
  setTimeout(() => rmO(), 8000);
}

// ── 座位排序（前排優先 + 最佳視角方向）────────────────────
//
//  左側 Zone（A1, B1, A, B, C）→ 靠右邊座位（靠舞台中心）
//  右側 Zone（A2, B2, G, H, I）→ 靠左邊座位（靠舞台中心）
//  中央 Zone（D, E, F）         → 靠中間座位
//
function sortSeats(seats, zone) {
  const z = (zone || '').toUpperCase().trim();

  // 右側 Zone：偏好低 X（靠左/中心）
  const RIGHT_ZONES = new Set(['A2','B2','G','H','I']);
  // 中央 Zone：偏好中間 X
  const CENTER_ZONES = new Set(['D','E','F']);
  // 其餘（A1, B1, A, B, C）：偏好高 X（靠右/中心）

  // 取得每個座位的螢幕座標
  const withPos = seats.map(s => {
    const r = s.getBoundingClientRect();
    return { el: s, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }).filter(s => s.x > 0 || s.y > 0); // 過濾還沒渲染的元素

  if (!withPos.length) return seats;

  // 計算整排水平中心（用於中央 Zone 對中計算）
  const allX = withPos.map(s => s.x);
  const midX = (Math.min(...allX) + Math.max(...allX)) / 2;

  withPos.sort((a, b) => {
    // ① 主要：前排優先（Y 座標小 = 靠近舞台 = 優先）
    //    同一排容差 ±8px（不同排之間通常 > 30px）
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 8) return yDiff;

    // ② 次要：同排內依視角偏好排序
    if (CENTER_ZONES.has(z)) {
      // 中央區：越靠中間越好
      return Math.abs(a.x - midX) - Math.abs(b.x - midX);
    } else if (RIGHT_ZONES.has(z)) {
      // 右側區：X 越小越好（靠舞台中心）
      return a.x - b.x;
    } else {
      // 左側區（A1, B1, A, B, C）：X 越大越好（靠舞台中心）
      return b.x - a.x;
    }
  });

  return withPos.map(s => s.el);
}

// ── 輔助 ──────────────────────────────────────────────────
function isVisible(el) {
  if (!el) return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none';
}

function humanClick(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
  const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 2;
  const y = rect.top  + rect.height / 2 + (Math.random() - 0.5) * 2;
  const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
  ['mouseover','mouseenter','mousedown','mouseup','click'].forEach(type =>
    el.dispatchEvent(new MouseEvent(type, opts)));
}

function log(text, level = 'info') {
  chrome.runtime.sendMessage({ type: 'LOG', text, level }).catch(() => {});
}
