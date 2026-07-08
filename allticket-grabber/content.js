// content.js — AllTicket 搶票核心 v2.0（通用版）
// 流程: BUY（含多場次列表）→ CHECK → ZONE → SEAT（連座優先）→ BOOK（勾選+Booking）→ DONE
// 優化: 場次關鍵字 / 連座搜尋 / 防重複點擊 / 隱藏 Tab 節能 / 開賣倒計時

// 場館視角配置（可依活動座位圖調整）— 目前: Thunder Dome / ROOM NO. FREEN 2026-08-08
// 右側區 → 取該排最左座位（靠中央）；左側區 → 取最右；
// 中央區與「不在清單內的 Zone」（其他場館）→ 取該排正中，通用最佳視角
const RIGHT_ZONES = new Set(['A3','B2','B4','B7','C3','F','G','H','I']);
const LEFT_ZONES  = new Set(['A1','B1','B3','B5','C1','D']);

let tickerTimeout = null;
let isRunning     = false;
let settings      = null;
let phase         = 'IDLE';
let tickCount     = 0;
let overlayEl     = null;
let seatsTried    = new Set();
let seatsSelected = 0;
let checkClicked  = false;
let currentZone   = '';
let seatQueue     = []; // 連座隊列：找到一組連座後依序點擊
let zoneStall     = 0;  // ZONE 等待計數：逾時重新查詢座位數
let triedZones    = new Set(); // 點過的 Zone 名，輪替避免卡同一區
let loginAlerted  = false;

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
  seatQueue     = [];
  seatFailCount = 0;
  seatPhase     = 'PICKING';
  checkStall    = 0;
  bookAttempts  = 0;
  zoneStall     = 0;
  triedZones    = new Set();
  loginAlerted  = false;
  setPhase('BUY');
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
  seatQueue = [];
  rmO();
}

// 統一切換步驟：同步寫入 storage，讓 popup 徽章即時反映
function setPhase(p) {
  phase = p;
  chrome.storage.local.set({ currentStep: p });
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

const SETTING_KEYS = ['showKeywords','zoneKeywords','seatCount','interval','autoRefresh','saleTime'];
const toCfg = d => ({
  showKeywords: d.showKeywords || [],
  zoneKeywords: d.zoneKeywords || [],
  seatCount:    d.seatCount    || 1,
  interval:     d.interval     || 400,
  autoRefresh:  d.autoRefresh  || false,
  saleTime:     d.saleTime     || '',
});

chrome.storage.local.get(['isRunning', ...SETTING_KEYS], d => {
  if (d.isRunning) start(toCfg(d));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.isRunning?.newValue === true  && !isRunning)
    chrome.storage.local.get(SETTING_KEYS, d => start(toCfg(d)));
  if (changes.isRunning?.newValue === false && isRunning) stop();
});

// ── 手動接管偵測 ──────────────────────────────────────────
// 使用者親自點 Zone（isTrusted 真人點擊；插件的模擬點擊是 false 不會觸發）
// → 插件跟進該區，直接接手選位
document.addEventListener('click', e => {
  if (!isRunning || !e.isTrusted) return;
  const badge = e.target?.closest?.('span.badge.badge-light');
  if (!badge || badge.classList.contains('not-ava')) return;
  currentZone = badge.textContent.trim();
  triedZones.add(currentZone.toUpperCase());
  seatsTried.clear();
  seatQueue     = [];
  seatFailCount = 0;
  seatPhase     = 'PICKING';
  setPhase('SEAT');
  log(`手動選 Zone: ${currentZone}，插件接手選位`, 'info');
  setO(`手動選 Zone: ${currentZone}，接手選位...`, '#4cff91');
}, true);

// ── 主迴圈 ────────────────────────────────────────────────
function tick() {
  if (!isRunning) return;
  // 分頁隱藏時暫停（BUY 階段例外，仍需偵測開賣）
  if (document.hidden && phase !== 'BUY') return;
  tickCount++;
  setO2(`偵測 ${tickCount} 次 | 步驟: ${phase}`);

  if      (phase === 'BUY')   handleBuy();
  else if (phase === 'CHECK') handleCheck();
  else if (phase === 'ZONE')  handleZone();
  else if (phase === 'SEAT')  handleSeat();
  else if (phase === 'BOOK')  handleBook();
}

// ════════════════════════════════════════════════════════
// STEP 1 — 點擊 BUY NOW
// ════════════════════════════════════════════════════════
// 距開賣剩餘秒數；未設定或已過開賣超過 1 小時回傳 null
function saleSecondsLeft() {
  const st = settings?.saleTime;
  if (!st) return null;
  const [h, m] = st.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = (target - Date.now()) / 1000;
  return diff < -3600 ? null : diff;
}

function saleCountdownText() {
  const t = saleSecondsLeft();
  if (t === null || t <= 0) return '';
  const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
  return `（開賣倒數 ${mm}:${String(ss).padStart(2, '0')}）`;
}

// 自適應重整：開賣前很久慢刷省流量，最後 90 秒加速，開賣後快刷
function maybeRefresh() {
  if (!settings?.autoRefresh) return;
  if (tickCount < 8) return; // 給頁面渲染時間，避免還沒載完就刷掉
  const t = saleSecondsLeft();
  let every;
  if (t === null)     every = 15; // 未設開賣時間：~6s
  else if (t > 90)    every = 50; // 開賣前 >90s：~20s
  else if (t > 0)     every = 8;  // 最後 90s：~3s
  else                every = 8;  // 已到開賣時間：~3s 快刷直到 BUY 出現
  if (tickCount % every === 0) location.reload();
}

// 分頁標題閃爍：搶到票 / 需要人工處理時提醒（20 秒後自動停）
let titleFlashTimer = null;
function flashTitle(msg) {
  if (titleFlashTimer) return;
  const orig = document.title;
  let on = false;
  titleFlashTimer = setInterval(() => {
    document.title = on ? orig : msg;
    on = !on;
  }, 800);
  setTimeout(() => {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
    document.title = orig;
  }, 20000);
}

function goCheck(el, label) {
  setO(`點擊 ${label}！`, '#4cff91');
  log(`點擊 ${label}`, 'success');
  setPhase('CHECK');
  checkClicked = false;
  checkStall   = 0;
  humanClick(el);
}

// 找 CHECK SEAT AVAILABLE 按鈕：先比對文字（最準），再退回 class
function findCheckBtn() {
  return [...document.querySelectorAll('button')].find(b => /CHECK\s*SEAT/i.test(b.textContent)) ||
         document.querySelector('button.btn-outline-info');
}

function handleBuy() {
  // 登入頁/排隊頁：只等待，絕不自動重整（會打斷輸入或掉排隊位置）
  if (/login|signin|register/i.test(location.href)) {
    setO('請先登入 AllTicket 帳號！（此頁不自動重整）', '#ff8844');
    if (!loginAlerted) { loginAlerted = true; flashTitle('⚠️ 需要登入！'); log('偵測到登入頁，請手動登入', 'warn'); }
    return;
  }
  if (/queue|waiting/i.test(location.href)) {
    setO('排隊中，等待進入購票頁...（不自動重整）', '#ffcc44');
    return;
  }

  // Zone 面板已出現 → 直接進 CHECK（點過 BUY 導頁後重啟也走這裡）
  if (document.querySelector('.seat-ava') || findCheckBtn()) {
    setPhase('CHECK');
    return;
  }

  // ── 多場次列表（巡演/多天場）：每場一列，右側 img 狀態圖 ──
  // rfPerform / evopen = 可購買，evclose = 未開賣，evsoldout = 售罄
  const rows = [...document.querySelectorAll('img[id^="RF_"]')].map(img => ({
    img,
    open: img.classList.contains('rfPerform') || (img.src || '').includes('evopen'),
    sold: (img.src || '').includes('soldout'),
    text: ((img.closest('table') || img.closest('tr') || img.parentElement)?.innerText || '').toUpperCase(),
  }));

  if (rows.length) {
    const kws = (settings?.showKeywords || []).map(k => k.toUpperCase().trim()).filter(Boolean);
    let target = null;

    if (kws.length) {
      // 依關鍵字順序找場次（比對整列文字：城市名/日期都可）
      // 收集所有符合的場次，取第一個「可買」的；前面的售罄自動退到下一個關鍵字
      const matched = [];
      for (const kw of kws) {
        const r = rows.find(r => r.text.includes(kw));
        if (r && !matched.includes(r)) matched.push(r);
      }
      if (!matched.length) {
        setO(`找不到場次 [${kws.join('/')}]，等待...`, '#ffcc44');
        maybeRefresh();
        return;
      }
      target = matched.find(r => r.open);
      if (!target) {
        if (matched.every(r => r.sold)) { setO('目標場次全部售罄！', '#ff4444'); return; }
        setO(`目標場次尚未開賣，等待...${saleCountdownText()}`, '#ffcc44');
        maybeRefresh();
        return;
      }
    } else {
      // 未指定場次：只點非 Live Streaming 的場次；就算只剩直播票可買也不點（要買直播請填關鍵字 STREAMING）
      target = rows.find(r => r.open && !r.text.includes('STREAMING'));
      if (!target) {
        const nonStream = rows.filter(r => !r.text.includes('STREAMING'));
        if (nonStream.length && nonStream.every(r => r.sold)) setO('演唱會票已售罄！', '#ff4444');
        else { setO(`尚未開賣，等待...${saleCountdownText()}`, '#ffcc44'); maybeRefresh(); }
        return;
      }
    }
    goCheck(target.img, `場次 BUY（${target.text.split('\n')[0].slice(0, 30)}）`);
    return;
  }

  // ── 單一 BUY 按鈕頁（fallback）──
  const buyBtn = document.getElementById('butBuy') ||
                 document.querySelector('button.btn-atk-primary');

  if (!buyBtn) {
    setO('等待頁面載入...', '#88aaff');
    maybeRefresh();
    return;
  }
  if (!isVisible(buyBtn) || buyBtn.disabled) {
    // 若頁面有倒計時元素，顯示剩餘時間
    const countdown = document.querySelector('.countdown, [class*="countdown"], [id*="countdown"]');
    if (countdown?.textContent?.trim()) {
      setO(`等待開賣... ${countdown.textContent.trim().slice(0, 30)}`, '#ffcc44');
    } else {
      setO('BUY NOW 尚未開放...', '#ffcc44');
    }
    maybeRefresh();
    return;
  }

  goCheck(buyBtn, 'BUY NOW');
}

// ════════════════════════════════════════════════════════
// STEP 2 — 點擊 CHECK SEAT AVAILABLE
// ════════════════════════════════════════════════════════
let checkStall = 0;

function handleCheck() {
  if (document.querySelectorAll('.seat-ava').length > 0) {
    setPhase('ZONE');
    checkStall = 0;
    return;
  }
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) { humanClick(yesBtn); return; }

  const checkBtn = findCheckBtn();
  if (!checkBtn) {
    // BUY 點擊可能沒生效（頁面沒切換），連續 10 次找不到面板就退回 BUY 重試
    checkStall++;
    if (checkStall >= 10) {
      checkStall = 0;
      log('CHECK 面板未出現，退回 BUY 重試', 'warn');
      setPhase('BUY');
      return;
    }
    setO('等待 Zone 面板...', '#88aaff');
    return;
  }
  if (!checkClicked) {
    checkClicked = true;
    checkStall   = 0;
    setO('查詢各 Zone 座位數...', '#88aaff');
    log('點擊 CHECK SEAT AVAILABLE', 'info');
    humanClick(checkBtn);
  } else {
    // 點過但座位資料一直沒出來 → 15 次後重點一次（自癒）
    checkStall++;
    if (checkStall >= 15) {
      checkClicked = false;
      checkStall   = 0;
      log('座位資料逾時，重點 CHECK', 'warn');
      return;
    }
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
  if (!zoneRows.length) { setPhase('CHECK'); checkClicked = false; return; }

  const availZones = [...zoneRows]
    .map(row => row.querySelector('span.badge.badge-light'))
    .filter(span => span && !span.classList.contains('not-ava') && span.style.cursor === 'pointer');

  const kws = (settings?.zoneKeywords || []).map(k => k.toUpperCase().trim());

  // 候選 Zone（依關鍵字優先序；完全相符優先於部分包含）
  let candidates;
  if (kws.length) {
    candidates = [];
    for (const kw of kws) {
      candidates.push(...availZones.filter(s => s.textContent.trim().toUpperCase() === kw));
      candidates.push(...availZones.filter(s => {
        const n = s.textContent.trim().toUpperCase();
        return n !== kw && n.includes(kw);
      }));
    }
    candidates = [...new Set(candidates)];
  } else {
    candidates = availZones;
  }

  if (!candidates.length) {
    // 沒有符合的 Zone 有位：座位數是快照，定期重點 CHECK 重新查詢（釋票會回來）
    zoneStall++;
    const msg = kws.length ? `Zone [${kws.join('/')}] 無空位，等待釋票...` : '所有 Zone 已售罄，等待釋票...';
    setO(`${msg} (${zoneStall})`, kws.length ? '#ffcc44' : '#ff4444');
    if (zoneStall >= 8) {
      zoneStall = 0;
      log('重新查詢各 Zone 座位數', 'info');
      setPhase('CHECK');
      checkClicked = false;
    }
    return;
  }
  zoneStall = 0;

  // 避免卡同一 Zone：優先選沒點過的；全點過一輪就清空重來
  let chosen = candidates.find(s => !triedZones.has(s.textContent.trim().toUpperCase()));
  if (!chosen) {
    triedZones.clear();
    chosen = candidates[0];
  }

  const zoneName = chosen.textContent.trim();
  triedZones.add(zoneName.toUpperCase());
  currentZone = zoneName;
  setO(`點擊 Zone: ${zoneName}`, '#4cff91');
  log(`選擇 Zone: ${zoneName}`, 'success');
  chrome.storage.local.set({ currentZone: zoneName });
  chrome.runtime.sendMessage({ type: 'STEP', step: 'ZONE', zone: zoneName }).catch(() => {});
  setPhase('SEAT');
  seatsTried.clear();
  seatQueue = [];
  seatsSelected = 0;
  seatFailCount = 0;
  seatPhase = 'PICKING';
  humanClick(chosen);
}

// ════════════════════════════════════════════════════════
// STEP 4 — 選座位（連座優先，等待確認後才繼續）
// ════════════════════════════════════════════════════════
let seatFailCount = 0;
let seatPhase     = 'PICKING'; // 'PICKING' | 'WAITING'

function handleSeat() {
  const seatCount     = settings?.seatCount || 1;
  const selectedSeats = document.querySelectorAll('svg.seat.selected');

  // ── 超選保護：點擊延遲確認造成多選會超過限購張數，點擊取消多餘的 ──
  if (selectedSeats.length > seatCount) {
    setO(`多選了 ${selectedSeats.length - seatCount} 張，取消中...`, '#ff8844');
    log(`超選 ${selectedSeats.length}/${seatCount}，取消多餘座位`, 'warn');
    humanClick(selectedSeats[selectedSeats.length - 1]);
    return;
  }

  // ── 已選滿，進 BOOK ──
  if (selectedSeats.length >= seatCount) {
    setO(`✓ 已選 ${selectedSeats.length} 張座位，前往 Booking...`, '#4cff91');
    log(`座位選取完成 (${selectedSeats.length}/${seatCount})`, 'success');
    setPhase('BOOK');
    seatFailCount = 0;
    seatPhase = 'PICKING';
    seatQueue = [];
    return;
  }

  // ── 等待上次點擊確認，不重複觸發 ──
  if (seatPhase === 'WAITING') return;

  // ── 彈窗處理 ──
  const okBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().toUpperCase() === 'OK' && isVisible(b));
  if (okBtn) { setO('點擊彈窗 OK...', '#88aaff'); humanClick(okBtn); return; }
  const yesBtn = document.querySelector('button.btn-primary.popup-styled');
  if (yesBtn && isVisible(yesBtn)) { humanClick(yesBtn); return; }

  if (!document.querySelector('svg.seat')) {
    setO('等待座位圖載入...', '#88aaff');
    return;
  }

  const allAvail = [...document.querySelectorAll('svg.seat.available')]
    .filter(s => !seatsTried.has(s));

  if (!allAvail.length) {
    if (selectedSeats.length > 0) {
      setO(`無更多空位，已選 ${selectedSeats.length} 張，繼續...`, '#4cff91');
      setPhase('BOOK');
      seatPhase = 'PICKING';
      seatQueue = [];
    } else {
      seatFailCount++;
      setO(`搜尋座位... (${seatFailCount})`, '#88aaff');
      if (seatFailCount >= 5) {
        setO('此 Zone 無座位，返回重選...', '#ff8844');
        log('Zone 無座位，返回重選', 'warn');
        setPhase('CHECK');
        checkClicked = false;
        seatFailCount = 0;
        seatPhase = 'PICKING';
        seatQueue = [];
      }
    }
    return;
  }

  seatFailCount = 0;

  // ── 選座策略：連座優先 ──
  let seat = null;
  const remainingNeeded = seatCount - selectedSeats.length;

  // 取連座隊列中下一個（確認仍在 DOM 且可用，頁面重繪後的舊元素點了無效）
  while (seatQueue.length > 0) {
    const next = seatQueue.shift();
    if (next && document.contains(next) && !seatsTried.has(next) && next.classList.contains('available')) {
      seat = next;
      seatsTried.add(seat);
      break;
    }
    // 隊列中的座位已被搶走，清空重找
    seatQueue = [];
  }

  // 嘗試找新的連座組
  if (!seat && remainingNeeded > 1 && allAvail.length >= remainingNeeded) {
    const group = findConsecutiveGroup(allAvail, remainingNeeded, currentZone);
    if (group) {
      seat = group[0];
      seatsTried.add(seat);
      seatQueue = group.slice(1);
      log(`找到 ${group.length} 連座，依序點擊`, 'info');
    }
  }

  // 回落：最佳單座
  if (!seat) {
    const sorted = sortSeats(allAvail, currentZone);
    seat = sorted[0];
    seatsTried.add(seat);
  }

  const curSelected = selectedSeats.length;
  setO(`點擊座位 (${curSelected + 1}/${seatCount})...`, '#88aaff');
  humanClick(seat);

  // 等待 400ms 確認是否命中，期間暫停後續點擊
  seatPhase = 'WAITING';
  setTimeout(() => {
    const nowSelected = document.querySelectorAll('svg.seat.selected').length;
    if (nowSelected > curSelected) {
      seatsSelected = nowSelected;
      log(`✓ 座位 ${nowSelected}/${seatCount} 已選`, 'success');
      setO(`✓ 座位 ${nowSelected}/${seatCount} 已選`, '#4cff91');
      chrome.storage.local.set({ seatsSelected: nowSelected });
      chrome.runtime.sendMessage({ type: 'SEATS', count: nowSelected }).catch(() => {});
    } else if (seatQueue.length > 0) {
      // 連座第一個點失敗，整組放棄重找
      log('連座點擊失敗，重新搜尋', 'warn');
      seatQueue = [];
    }
    seatPhase = 'PICKING';
  }, 400);
}

// ════════════════════════════════════════════════════════
// 連座搜尋：在同一排找 N 個相鄰可用座位
// 回傳 el[] 或 null
// ════════════════════════════════════════════════════════
function findConsecutiveGroup(seats, count, zone) {
  // 依 Y 座標分行（±12px 容差）
  const rows = [];
  for (const seat of seats) {
    const r  = seat.getBoundingClientRect();
    const cy = r.top  + r.height / 2;
    const cx = r.left + r.width  / 2;
    if (cy <= 0 && cx <= 0) continue;
    let placed = false;
    for (const row of rows) {
      if (Math.abs(row.y - cy) <= 12) {
        row.items.push({ el: seat, x: cx });
        placed = true;
        break;
      }
    }
    if (!placed) rows.push({ y: cy, items: [{ el: seat, x: cx }] });
  }

  rows.sort((a, b) => a.y - b.y); // 前排優先

  const z = (zone || '').toUpperCase().trim();
  const allX = seats
    .map(s => { const r = s.getBoundingClientRect(); return r.left + r.width / 2; })
    .filter(x => x > 0);
  const midX = allX.length ? (Math.min(...allX) + Math.max(...allX)) / 2 : 0;

  for (const row of rows) {
    if (row.items.length < count) continue;
    row.items.sort((a, b) => a.x - b.x);

    // 計算相鄰最小間距（≈1 座位寬），用於判斷是否連座
    const gaps = [];
    for (let i = 1; i < row.items.length; i++)
      gaps.push(row.items[i].x - row.items[i - 1].x);
    if (!gaps.length) continue;
    const minGap    = Math.min(...gaps);
    const maxConsec = minGap * 1.6; // 超過此距離表示中間有已售座位

    // 滑動視窗收集連座組
    const groups = [];
    for (let i = 0; i <= row.items.length - count; i++) {
      let ok = true;
      for (let j = i; j < i + count - 1; j++) {
        if (row.items[j + 1].x - row.items[j].x > maxConsec) { ok = false; break; }
      }
      if (ok) groups.push(row.items.slice(i, i + count));
    }
    if (!groups.length) continue;

    // 依視角選最佳連座組
    let best;
    if (RIGHT_ZONES.has(z)) {
      best = groups.sort((a, b) => a[0].x - b[0].x)[0]; // 最靠左（靠舞台中心）
    } else if (LEFT_ZONES.has(z)) {
      best = groups.sort((a, b) => b[b.length - 1].x - a[a.length - 1].x)[0]; // 最靠右
    } else {
      // 中央區與未知場館 → 最接近該排正中
      best = groups.sort((a, b) => {
        const ac = (a[0].x + a[a.length - 1].x) / 2;
        const bc = (b[0].x + b[b.length - 1].x) / 2;
        return Math.abs(ac - midX) - Math.abs(bc - midX);
      })[0];
    }
    return best.map(s => s.el);
  }
  return null;
}

// ════════════════════════════════════════════════════════
// STEP 5 — 勾選同意框 + 點擊 Booking
// 前提：必須有 svg.seat.selected
// ════════════════════════════════════════════════════════
let bookAttempts = 0;

function handleBook() {
  const selectedSeats = document.querySelectorAll('svg.seat.selected');
  // 超過限購張數不能按 Booking，退回 SEAT 取消多餘的
  if (selectedSeats.length > (settings?.seatCount || 1)) {
    setPhase('SEAT');
    return;
  }
  if (selectedSeats.length === 0) {
    setO('未偵測到選中座位，返回選座...', '#ff8844');
    log('未選到座位，退回 SEAT 步驟', 'warn');
    setPhase('SEAT');
    seatsTried.clear();
    seatQueue = [];
    bookAttempts = 0;
    return;
  }

  const okBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim().toUpperCase() === 'OK' && isVisible(b));
  if (okBtn) {
    const bodyText = document.body.innerText || '';
    if (bodyText.includes('Please select seat') || bodyText.includes('select seat')) {
      setO('點擊 OK 關閉...', '#ffcc44');
      humanClick(okBtn);
      return;
    }
    setO('點擊驗證 OK...', '#88aaff');
    log('點擊驗證彈窗 OK', 'info');
    humanClick(okBtn);
    return;
  }

  const consentCb = document.getElementById('GMM10') ||
    document.querySelector('input.form-check-input[type="checkbox"]');
  if (consentCb && !consentCb.checked) {
    setO('勾選同意條款...', '#88aaff');
    log('勾選 #GMM10 同意授權', 'info');
    consentCb.click();
    consentCb.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const bookBtn = document.querySelector('button.btn-book');
  if (!bookBtn || !isVisible(bookBtn)) {
    setO('等待 Booking 按鈕...', '#88aaff');
    bookAttempts++;
    // 只在「未勾選」時才補點，避免把已勾選的同意框反勾掉
    if (bookAttempts > 20) {
      bookAttempts = 0;
      if (consentCb && !consentCb.checked) consentCb.click();
    }
    return;
  }
  if (bookBtn.disabled) {
    setO('Booking 按鈕未啟用，等待勾選生效...', '#ffcc44');
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
  flashTitle('🎫 搶到了！快去結帳');
  setTimeout(() => rmO(), 8000);
}

// ── 座位排序（前排 + 最佳視角）──────────────────────────
function sortSeats(seats, zone) {
  const z = (zone || '').toUpperCase().trim();

  const withPos = seats.map(s => {
    const r = s.getBoundingClientRect();
    return { el: s, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }).filter(s => s.x > 0 || s.y > 0);

  if (!withPos.length) return seats;

  const allX = withPos.map(s => s.x);
  const midX = (Math.min(...allX) + Math.max(...allX)) / 2;

  withPos.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 8) return yDiff;
    if (RIGHT_ZONES.has(z)) return a.x - b.x;
    if (LEFT_ZONES.has(z))  return b.x - a.x;
    return Math.abs(a.x - midX) - Math.abs(b.x - midX); // 中央區與未知場館取正中
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
