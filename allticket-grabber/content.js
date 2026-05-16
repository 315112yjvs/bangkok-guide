// content.js — AllTicket 搶票核心 v1.1
// 流程: BUY NOW → CHECK SEAT → 選 Zone（票價高→低）→ 選座 → Booking → 確認

let tickerTimeout = null;
let isRunning     = false;
let settings      = null;
// 流程: BUY → CHECK → ZONE → SEAT → ACCEPT → VERIFY → BOOK → DONE
let phase         = 'IDLE';
let tickCount     = 0;
let overlayEl     = null;
let seatsTried    = new Set();
let seatsSelected = 0;
let checkClicked  = false;
let acceptClicked = false;

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
  acceptClicked = false;
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

  if      (phase === 'BUY')    handleBuy();
  else if (phase === 'CHECK')  handleCheck();
  else if (phase === 'ZONE')   handleZone();
  else if (phase === 'SEAT')   handleSeat();
  else if (phase === 'ACCEPT') handleAccept();
  else if (phase === 'VERIFY') handleVerify();
  else if (phase === 'BOOK')   handleBook();
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
    setO('BUY NOW 尚未開放，等待...', '#ffcc44');
    if (settings?.autoRefresh && tickCount % 15 === 0) location.reload();
    return;
  }

  // Zone 面板已出現（BUY NOW 已被點過，可能是頁面恢復）
  if (document.querySelector('.seat-ava, button.btn-outline-info')) {
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
  // 若 Zone 表格已有資料，直接進 ZONE 選擇
  const zoneRows = document.querySelectorAll('.seat-ava');
  if (zoneRows.length > 0) {
    phase = 'ZONE';
    return;
  }

  // 處理「是否確認查詢座位」確認彈窗（只在可見時點）
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) {
    setO('確認查詢座位數...', '#88aaff');
    humanClick(yesBtn);
    return;
  }

  // 點擊 CHECK SEAT AVAILABLE
  const checkBtn = document.querySelector('button.btn-outline-info') ||
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('CHECK SEAT AVAILABLE'));

  if (!checkBtn) {
    setO('等待 Zone 面板...', '#88aaff');
    return;
  }

  if (!checkClicked) {
    checkClicked = true;
    setO('點擊 CHECK SEAT AVAILABLE...', '#88aaff');
    log('查詢各 Zone 剩餘座位', 'info');
    humanClick(checkBtn);
  } else {
    setO('等待座位資料載入...', '#88aaff');
  }
}

// ════════════════════════════════════════════════════════
// STEP 3 — 選 Zone（依票價高→低，跳過售罄）
// ════════════════════════════════════════════════════════
function handleZone() {
  // 處理確認彈窗（若仍可見）
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) {
    humanClick(yesBtn);
    return;
  }

  // 讀取 Zone 表格（DOM 順序 = 票價高到低）
  const zoneRows = document.querySelectorAll('.seat-ava');
  if (!zoneRows.length) {
    // 表格消失了，返回重查
    phase = 'CHECK';
    checkClicked = false;
    return;
  }

  // 可購買的 Zone：有 cursor:pointer 且無 .not-ava class
  const availZones = [...zoneRows]
    .map(row => row.querySelector('span.badge.badge-light'))
    .filter(span => span && !span.classList.contains('not-ava') && span.style.cursor === 'pointer');

  const kws = (settings?.zoneKeywords || []).map(k => k.toUpperCase().trim());
  let chosen = null;

  if (kws.length) {
    // 依關鍵字篩選（仍需有空位）
    chosen = availZones.find(s =>
      kws.some(kw => {
        const name = s.textContent.trim().toUpperCase();
        return name === kw || name.includes(kw);
      })
    );
    if (!chosen) {
      // 建立顯示各 Zone 剩餘數的字串
      const summary = [...zoneRows].map(row => {
        const z = row.querySelector('span.badge.badge-light')?.textContent?.trim() || '?';
        const n = row.parentElement?.querySelector('.col-7 span')?.textContent?.trim() || '?';
        return `${z}:${n}`;
      }).join(' ');
      setO(`Zone [${kws.join('/')}] 無座位，等待... (${summary})`, '#ffcc44');
      return;
    }
  } else {
    // 無關鍵字：自動選票價最高且有座位的 Zone（DOM 第一個 = 最高票價）
    chosen = availZones[0];
    if (!chosen) {
      setO('所有 Zone 已售罄！', '#ff4444');
      return;
    }
  }

  const zoneName = chosen.textContent.trim();
  setO(`✓ 點擊 Zone: ${zoneName}（票價最高可用）`, '#4cff91');
  log(`選擇 Zone: ${zoneName}`, 'success');
  chrome.runtime.sendMessage({ type: 'STEP', step: 'ZONE', zone: zoneName }).catch(() => {});
  chrome.storage.local.set({ currentStep: 'ZONE', currentZone: zoneName });
  phase = 'SEAT';
  seatsTried.clear();
  seatsSelected = 0;
  chosen.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// ════════════════════════════════════════════════════════
// STEP 4 — 選座位
// ════════════════════════════════════════════════════════
let seatFailCount = 0;

function handleSeat() {
  // 若頁面已跳到票券資訊（罕見情況），直接 BOOK
  if (onTicketInfoPage()) {
    setO('偵測到票券資訊頁，直接跳至訂票...', '#88aaff');
    phase = 'BOOK';
    return;
  }

  // Yes/No 彈窗
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) { humanClick(yesBtn); return; }

  const seatCount = settings?.seatCount || 1;
  const selected  = document.querySelectorAll('svg.seat.selected');

  if (selected.length >= seatCount) {
    setO(`已選 ${selected.length} 張，點擊確認選擇...`, '#4cff91');
    phase = 'ACCEPT';
    acceptClicked = false;
    seatFailCount = 0;
    return;
  }

  const allAvail = [...document.querySelectorAll('svg.seat.available')]
    .filter(s => !seatsTried.has(s));

  if (!allAvail.length) {
    if (selected.length > 0) {
      setO(`無更多空位，已選 ${selected.length} 張，前往確認...`, '#4cff91');
      phase = 'ACCEPT';
      acceptClicked = false;
      seatFailCount = 0;
    } else {
      seatFailCount++;
      if (seatFailCount >= 3) {
        setO('此 Zone 無座位，返回重選...', '#ff8844');
        log('Zone 無座位，返回重選', 'warn');
        phase = 'CHECK';
        checkClicked = false;
        seatFailCount = 0;
      } else {
        setO('搜尋可用座位...', '#88aaff');
      }
    }
    return;
  }

  seatFailCount = 0;
  const seat = allAvail[0];
  seatsTried.add(seat);
  const curSelected = selected.length;
  setO(`點擊座位 (${curSelected + 1}/${seatCount})...`, '#88aaff');
  seat.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  setTimeout(() => {
    const nowSelected = document.querySelectorAll('svg.seat.selected').length;
    if (nowSelected > curSelected) {
      seatsSelected = nowSelected;
      log(`✓ 座位選定 (${nowSelected}/${seatCount})`, 'success');
      setO(`✓ 座位 ${nowSelected}/${seatCount} 已選`, '#4cff91');
      chrome.storage.local.set({ seatsSelected: nowSelected });
      chrome.runtime.sendMessage({ type: 'SEATS', count: nowSelected }).catch(() => {});
    }
  }, 300);
}

// ════════════════════════════════════════════════════════
// STEP 5 — 點擊 ยืนยันตัวเลือกของฉัน（確認我的選擇）
// ════════════════════════════════════════════════════════
function handleAccept() {
  // 若已到票券資訊頁（有勾選框），直接跳 BOOK
  if (onTicketInfoPage()) {
    setO('已在票券資訊頁，準備勾選...', '#88aaff');
    phase = 'BOOK';
    return;
  }

  // 處理 OK 彈窗（可能先於 btn-accept 出現）
  const okBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().toUpperCase() === 'OK' && isVisible(b));
  if (okBtn) {
    setO('點擊驗證 OK...', '#88aaff');
    humanClick(okBtn);
    return;
  }

  const acceptBtn = document.querySelector('button.btn-accept') ||
    [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes('ยืนยัน') && isVisible(b) && !b.classList.contains('popup-styled'));

  if (!acceptBtn || !isVisible(acceptBtn)) {
    setO('等待確認選擇按鈕...', '#88aaff');
    return;
  }

  if (!acceptClicked) {
    acceptClicked = true;
    setO('點擊「確認我的選擇」...', '#4cff91');
    log('點擊 ยืนยันตัวเลือกของฉัน', 'success');
    phase = 'VERIFY';
    humanClick(acceptBtn);
  }
}

// ════════════════════════════════════════════════════════
// STEP 6 — 處理驗證彈窗（กรุณาคลิก ยินยอม → OK）
// ════════════════════════════════════════════════════════
function handleVerify() {
  // 若已到票券資訊頁，直接跳 BOOK
  if (onTicketInfoPage()) {
    setO('票券資訊頁，準備勾選同意...', '#88aaff');
    phase = 'BOOK';
    return;
  }

  // OK 彈窗
  const okBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().toUpperCase() === 'OK' && isVisible(b));
  if (okBtn) {
    setO('點擊驗證同意 OK...', '#88aaff');
    log('同意驗證資訊', 'info');
    humanClick(okBtn);
    return;
  }

  setO('等待驗證彈窗或票券資訊頁...', '#88aaff');
}

// 判斷是否已在票券資訊頁
function onTicketInfoPage() {
  const cb = document.getElementById('GMM10') ||
    document.querySelector('input.form-check-input[type="checkbox"]');
  if (cb && isVisible(cb)) return true;
  const bookBtn = document.querySelector('button.btn-book');
  if (bookBtn && isVisible(bookBtn)) return true;
  return false;
}

// ════════════════════════════════════════════════════════
// STEP 7 — 勾選同意框 + 點擊 Booking
// ════════════════════════════════════════════════════════
function handleBook() {
  // 勾選同意框（#GMM10）
  const consentCb = document.getElementById('GMM10') ||
    document.querySelector('input.form-check-input[type="checkbox"]');

  if (consentCb && isVisible(consentCb) && !consentCb.checked) {
    setO('勾選同意條款...', '#88aaff');
    consentCb.click();
    consentCb.dispatchEvent(new Event('change', { bubbles: true }));
    log('勾選同意授權資訊', 'info');
    return;
  }

  const bookBtn = document.querySelector('button.btn-book');
  if (!bookBtn || !isVisible(bookBtn)) { setO('等待 Booking 按鈕...', '#88aaff'); return; }
  if (bookBtn.disabled) { setO('Booking 未啟用，等待勾選...', '#ffcc44'); return; }

  setO('✓ 點擊 Booking！完成搶票！', '#4cff91');
  log('點擊 Booking！前往付款頁面', 'success');
  phase = 'DONE';
  isRunning = false;
  clearTimeout(tickerTimeout);
  chrome.storage.local.set({ isRunning: false, currentStep: 'DONE' });
  chrome.runtime.sendMessage({ type: 'STEP', step: 'DONE' }).catch(() => {});
  humanClick(bookBtn);
  setTimeout(() => rmO(), 8000);
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
