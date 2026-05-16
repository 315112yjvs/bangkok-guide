// content.js — AllTicket 搶票核心 v1.0
// 流程: 事件頁(BUY NOW) → Zone選擇 → 座位選擇 → Booking → 確認

let tickerTimeout = null;
let isRunning     = false;
let settings      = null;
let phase         = 'IDLE';   // IDLE | BUY | ZONE | SEAT | BOOK | CONFIRM | DONE
let tickCount     = 0;
let overlayEl     = null;
let seatsTried    = new Set();
let seatsSelected = 0;

// ── Overlay ──────────────────────────────────────────────
function createOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = `
    position:fixed;top:12px;right:12px;z-index:999999;
    background:rgba(10,6,20,.95);color:#e0e0f0;
    border:1.5px solid #e74c3c;border-radius:10px;
    padding:10px 14px;font:600 11px/1.6 monospace;
    min-width:240px;max-width:340px;
    box-shadow:0 4px 24px rgba(0,0,0,.7);
    pointer-events:none;
  `;
  overlayEl.innerHTML = `
    <div style="color:#e05050;font-size:12px;margin-bottom:3px">🎫 AllTicket 搶票助手</div>
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

// 頁面載入時自動恢復（SPA 不會重載，此處為保險）
chrome.storage.local.get(['isRunning', 'zoneKeywords', 'seatCount', 'interval', 'autoRefresh'], d => {
  if (d.isRunning) {
    start({
      zoneKeywords: d.zoneKeywords || [],
      seatCount:    d.seatCount    || 1,
      interval:     d.interval     || 400,
      autoRefresh:  d.autoRefresh  || false,
    });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.isRunning?.newValue === true  && !isRunning)
    chrome.storage.local.get(['zoneKeywords','seatCount','interval','autoRefresh'], d =>
      start({ zoneKeywords: d.zoneKeywords||[], seatCount: d.seatCount||1, interval: d.interval||400, autoRefresh: d.autoRefresh||false }));
  if (changes.isRunning?.newValue === false && isRunning)
    stop();
});

// ── 主迴圈 ────────────────────────────────────────────────
function tick() {
  if (!isRunning) return;
  tickCount++;
  setO2(`偵測 ${tickCount} 次 | 步驟: ${phase}`);

  // 各階段 handler
  if (phase === 'BUY')     handleBuy();
  else if (phase === 'ZONE')    handleZone();
  else if (phase === 'SEAT')    handleSeat();
  else if (phase === 'BOOK')    handleBook();
  else if (phase === 'CONFIRM') handleConfirm();
}

// ════════════════════════════════════════════════════════
// STEP 1 — 點擊 BUY NOW
// ════════════════════════════════════════════════════════
function handleBuy() {
  // 先處理可能出現的「是否繼續」彈窗（CHECK SEAT AVAILABLE 確認框）
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn) {
    setO('自動確認查詢座位...', '#ffcc44');
    humanClick(yesBtn);
    return;
  }

  const buyBtn = document.getElementById('butBuy') ||
                 document.querySelector('button.btn-atk-primary');

  if (!buyBtn) {
    // 可能尚未登入 → 提示
    const loginBtn = document.querySelector('button[id*="login"], .btn-login, #btnLogin');
    if (loginBtn) {
      setO('請先登入 AllTicket 帳號！', '#ff4444');
      return;
    }
    setO('等待頁面載入...', '#88aaff');
    // autoRefresh 支援
    if (settings?.autoRefresh) {
      setTimeout(() => { if (isRunning && phase === 'BUY') location.reload(); }, 3000);
    }
    return;
  }

  if (buyBtn.style.display === 'none' || buyBtn.disabled) {
    setO('BUY NOW 尚未開放，等待...', '#ffcc44');
    if (settings?.autoRefresh) {
      setTimeout(() => { if (isRunning && phase === 'BUY') location.reload(); }, 3000);
    }
    return;
  }

  setO('點擊 BUY NOW！', '#4cff91');
  log('點擊 BUY NOW', 'success');
  phase = 'ZONE';
  humanClick(buyBtn);
}

// ════════════════════════════════════════════════════════
// STEP 2 — 選擇 Zone
// ════════════════════════════════════════════════════════
function handleZone() {
  // 若「查詢座位」確認彈窗出現先關掉
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn) {
    setO('確認查詢座位...', '#88aaff');
    humanClick(yesBtn);
    return;
  }

  // Zone 選項出現在 span.badge.badge-light 且有 cursor:pointer
  const allZoneSpans = [...document.querySelectorAll('span.badge.badge-light')]
    .filter(s => s.style.cursor === 'pointer');

  if (!allZoneSpans.length) {
    setO('等待 Zone 選項...', '#88aaff');
    return;
  }

  const kws = (settings?.zoneKeywords || []).map(k => k.toUpperCase().trim());

  let chosen = null;
  if (kws.length) {
    // 依關鍵字篩選
    chosen = allZoneSpans.find(s =>
      kws.some(kw => s.textContent.trim().toUpperCase() === kw ||
                     s.textContent.trim().toUpperCase().includes(kw))
    );
    if (!chosen) {
      setO(`Zone [${kws.join('/')}] 找不到，等待...`, '#ffcc44');
      return;
    }
  } else {
    // 沒指定關鍵字：找有剩餘座位的 Zone（row 中 available > 0）
    chosen = findBestZoneSpan(allZoneSpans);
  }

  if (!chosen) {
    setO('所有 Zone 已滿，等待重整...', '#ffcc44');
    return;
  }

  setO(`點擊 Zone: ${chosen.textContent.trim()}`, '#4cff91');
  log(`選擇 Zone: ${chosen.textContent.trim()}`, 'success');
  phase = 'SEAT';
  seatsTried.clear();
  seatsSelected = 0;
  chosen.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

// 找有空位的最佳 Zone（根據 SEAT AVAILABLE 表格中的數字）
function findBestZoneSpan(spans) {
  // 嘗試從 SEAT AVAILABLE 表格讀取剩餘數
  const rows = [...document.querySelectorAll('.seat-ava')];
  if (!rows.length) return spans[0];

  // 建立 zone→available 映射
  const avail = {};
  rows.forEach(row => {
    const zoneEl = row.querySelector('span.badge.badge-light');
    const numEl  = row.nextElementSibling?.querySelector('span') ||
                   row.parentElement?.querySelector('.col-5:last-child span, .col-6 span');
    if (zoneEl) {
      const name = zoneEl.textContent.trim().toUpperCase();
      const num  = parseInt(row.parentElement?.querySelector('[class*="col"]:last-child span')?.textContent || '0');
      avail[name] = num;
    }
  });

  // 挑 available 最多的 Zone span
  let best = null, bestNum = -1;
  spans.forEach(s => {
    const name = s.textContent.trim().toUpperCase();
    const n    = avail[name] ?? 999;
    if (n > 0 && n > bestNum) { bestNum = n; best = s; }
  });
  return best || spans[0];
}

// ════════════════════════════════════════════════════════
// STEP 3 — 選擇座位
// ════════════════════════════════════════════════════════
function handleSeat() {
  // 確認彈窗
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn) { humanClick(yesBtn); return; }

  const seatCount = settings?.seatCount || 1;
  const selected  = document.querySelectorAll('svg.seat.selected');

  if (selected.length >= seatCount) {
    setO(`已選 ${selected.length} 個座位，前往 Booking...`, '#4cff91');
    phase = 'BOOK';
    return;
  }

  // 找所有可用座位（svg.seat.available）
  const allAvail = [...document.querySelectorAll('svg.seat.available')]
    .filter(s => !seatsTried.has(s));

  if (!allAvail.length) {
    // 若已選到部分座位，直接繼續
    if (selected.length > 0) {
      setO(`無更多空位，已選 ${selected.length} 張，前往 Booking...`, '#4cff91');
      phase = 'BOOK';
    } else {
      setO('此 Zone 無座位，返回...', '#ff8844');
      log('Zone 無座位，返回重選', 'warn');
      phase = 'ZONE';
    }
    return;
  }

  const seat = allAvail[0];
  seatsTried.add(seat);
  setO(`點擊座位 (${selected.length + 1}/${seatCount})...`, '#88aaff');
  seat.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  // 短暫等待確認是否成功
  setTimeout(() => {
    const nowSelected = document.querySelectorAll('svg.seat.selected').length;
    if (nowSelected > selected.length) {
      seatsSelected = nowSelected;
      log(`✓ 座位選定 (${nowSelected}/${seatCount})`, 'success');
      setO(`✓ 座位 ${nowSelected}/${seatCount} 選定`, '#4cff91');
      chrome.storage.local.set({ seatsSelected: nowSelected });
      chrome.runtime.sendMessage({ type: 'SEATS', count: nowSelected }).catch(() => {});
    } else {
      setO(`✗ 座位失敗，換下一個...`, '#ffcc44');
    }
  }, 300);
}

// ════════════════════════════════════════════════════════
// STEP 4 — 點擊 Booking
// ════════════════════════════════════════════════════════
function handleBook() {
  const bookBtn = document.querySelector('button.btn-book');
  if (!bookBtn) {
    setO('等待 Booking 按鈕...', '#88aaff');
    return;
  }
  if (bookBtn.disabled) {
    setO('Booking 按鈕尚未啟用...', '#ffcc44');
    return;
  }

  setO('點擊 Booking！', '#4cff91');
  log('點擊 Booking 按鈕', 'success');
  phase = 'CONFIRM';
  humanClick(bookBtn);
}

// ════════════════════════════════════════════════════════
// STEP 5 — 最終確認
// ════════════════════════════════════════════════════════
function handleConfirm() {
  // ยืนยันตัวเลือกของฉัน = 確認我的選擇
  const confirmBtn = document.querySelector('button.btn-accept') ||
    [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes('ยืนยัน') || b.textContent.includes('Confirm'));

  if (!confirmBtn) {
    setO('等待確認按鈕...', '#88aaff');
    return;
  }

  setO('✓ 點擊確認！完成！', '#4cff91');
  log('點擊最終確認！搶票完成！', 'success');
  phase = 'DONE';
  isRunning = false;
  clearTimeout(tickerTimeout);
  chrome.storage.local.set({ isRunning: false });
  chrome.runtime.sendMessage({ type: 'STEP', step: 'DONE' }).catch(() => {});
  humanClick(confirmBtn);
  setTimeout(() => rmO(), 8000);
}

// ── 模擬真人點擊 ──────────────────────────────────────────
function humanClick(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
  const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 2;
  const y = rect.top  + rect.height / 2 + (Math.random() - 0.5) * 2;
  const opts = {
    bubbles: true, cancelable: true,
    clientX: x, clientY: y,
    screenX: x + window.screenX, screenY: y + window.screenY,
    view: window,
  };
  ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'].forEach(type => {
    el.dispatchEvent(new MouseEvent(type, opts));
  });
}

// ── Log ───────────────────────────────────────────────────
function log(text, level = 'info') {
  chrome.runtime.sendMessage({ type: 'LOG', text, level }).catch(() => {});
}
