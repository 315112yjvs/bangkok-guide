// content.js — ThaiTicketMajor 搶票核心 v3
// Flow: Concert → Verify → Zones → Fixed(多座位/方向/重試) → Done

let tickerInterval = null;
let isRunning = false;
let settings = null;
let stepDone = {};
let overlayEl = null;

// ── 頁面偵測 ──────────────────────────────────────────────
function getPage() {
  const p = location.pathname;
  if (p.includes('verify_condition')) return 'VERIFY';
  if (p.includes('zones.php'))        return 'ZONES';
  if (p.includes('fixed.php'))        return 'FIXED';
  if (location.hostname === 'www.thaiticketmajor.com') return 'CONCERT';
  return 'OTHER';
}

// ── Floating overlay ──────────────────────────────────────
function createOverlay() {
  if (overlayEl) return;
  const zIdx = Math.floor(88888 + Math.random() * 11111); // 隨機 z-index，避免最大值特徵
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = `
    position:fixed;top:12px;right:12px;z-index:${zIdx};
    background:rgba(12,8,20,.96);color:#e0e0f0;
    border:1.5px solid #c0392b;border-radius:10px;
    padding:10px 14px;font:600 11px/1.6 monospace;
    min-width:240px;max-width:350px;
    box-shadow:0 4px 24px rgba(0,0,0,.7);
    pointer-events:none;
  `;
  overlayEl.innerHTML = `
    <div style="color:#e05050;font-size:12px;margin-bottom:3px">🎫 搶票助手</div>
    <div id="__s__" style="color:#aaa">初始化...</div>
    <div id="__c__" style="color:#555;font-size:10px;margin-top:2px"></div>
  `;
  document.body.appendChild(overlayEl);
}
const setO  = (t,c='#aaa')=>{ if(!overlayEl)createOverlay(); const e=document.getElementById('__s__'); if(e){e.textContent=t;e.style.color=c;} };
const setO2 = t=>{ if(!overlayEl)return; const e=document.getElementById('__c__'); if(e)e.textContent=t; };
const rmO   = ()=>{ overlayEl?.remove(); overlayEl=null; };

// ── 啟動 / 停止 ───────────────────────────────────────────
function start(cfg, initialDone = {}) {
  if (isRunning) return;
  settings  = cfg;
  isRunning = true;
  stepDone  = { ...initialDone };
  resetFixed();
  createOverlay();
  const page = getPage();
  setO(`啟動 [${page}]`, '#88aaff');
  log(`啟動，頁面：${page}`, 'info');
  setStep(page);

  scheduleTick();
}

// 用 setTimeout 遞迴取代 setInterval，加入 ±200ms 隨機抖動模擬真人節奏
function scheduleTick() {
  if (!isRunning) return;
  const base   = settings.interval || 800;
  const jitter = (Math.random() - 0.5) * 400;
  tickerInterval = setTimeout(() => {
    tick();
    scheduleTick();
  }, Math.max(300, base + jitter));
}

function stop() {
  isRunning = false;
  clearTimeout(tickerInterval);
  tickerInterval = null;
  rmO();
}

// ── 接收 popup 訊息 ───────────────────────────────────────
chrome.runtime.onMessage.addListener((msg,_,res)=>{
  if (msg.action==='START') { start(msg.settings, msg.initialDone||{}); res({ok:true}); }
  if (msg.action==='STOP')  { stop();                                   res({ok:true}); }
});

// ── Storage 變化監聽：sendMessage 失敗時的備援啟動 ────────
// 當 popup 將 isRunning 設為 true 但訊息沒送達時，
// storage 變化仍會觸發這裡，確保 content script 能自動啟動
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // isRunning 被設為 true，但 content script 尚未在跑
  if (changes.isRunning?.newValue === true && !isRunning) {
    chrome.storage.local.get(
      ['targetDate','targetTicket','zoneKeywords','targetZone',
       'seatCount','seatDirection','priorityRows','autoRefresh','interval',
       'currentStep','triedZones'],
      data => {
        _triedZones = (data.triedZones || []).map(z => z.toUpperCase());

        let zoneKeywords = data.zoneKeywords || [];
        if (!zoneKeywords.length && data.targetZone)
          zoneKeywords = data.targetZone.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean);

        const initialDone = resolveInitialDone(data.currentStep || '');
        start({
          targetDate:    data.targetDate    || '',
          targetTicket:  data.targetTicket  || '',
          zoneKeywords,
          seatCount:     data.seatCount     || 1,
          seatDirection: data.seatDirection || 'MIDDLE',
          priorityRows:  data.priorityRows  ?? 5,
    
          autoRefresh:   data.autoRefresh   || false,
          interval:      data.interval      || 800,
        }, initialDone);
      }
    );
  }

  // isRunning 被設為 false → 停止
  if (changes.isRunning?.newValue === false && isRunning) {
    stop();
  }
});

// ── initialDone 推算（綜合 URL + 儲存的 currentStep，取最遠進度）──
function resolveInitialDone(storedStep) {
  const stepOrder = ['CONCERT','VERIFY','ZONES','FIXED'];
  const page      = getPage();
  const pageIdx   = stepOrder.indexOf(page);    // -1 if CAPTCHA/OTHER
  const storedIdx = stepOrder.indexOf(storedStep); // -1 if unknown
  // 取兩者中進度較遠的，確保在驗證/CAPTCHA 頁面也能正確還原
  const effectiveIdx = Math.max(pageIdx, storedIdx);
  const initialDone  = {};
  stepOrder.forEach((s, i) => { if (i < effectiveIdx) initialDone[s] = true; });
  return initialDone;
}

// ── 頁面載入自動恢復 ──────────────────────────────────────
chrome.storage.local.get(
  ['isRunning','targetDate','targetTicket','zoneKeywords','targetZone',
   'seatCount','seatDirection','priorityRows','autoRefresh','interval',
   'currentStep','triedZones'],
  data => {
    if (!data.isRunning) return;
    // 恢復已試過的 Zone 清單（跨頁面重整必須從 storage 讀回）
    _triedZones = (data.triedZones || []).map(z => z.toUpperCase());

    let zoneKeywords = data.zoneKeywords||[];
    if (!zoneKeywords.length && data.targetZone)
      zoneKeywords = data.targetZone.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean);

    const initialDone = resolveInitialDone(data.currentStep || '');
    start({
      targetDate:    data.targetDate    || '',
      targetTicket:  data.targetTicket  || '',
      zoneKeywords,
      seatCount:     data.seatCount     || 1,
      seatDirection: data.seatDirection || 'MIDDLE',
      priorityRows:  data.priorityRows  ?? 5,

      autoRefresh:   data.autoRefresh   || false,
      interval:      data.interval      || 800,
    }, initialDone);
  }
);

// ── 主迴圈 ────────────────────────────────────────────────
let tickCount = 0;
let captchaLogged = false;

function tick() {
  if (!isRunning) return;
  tickCount++;
  setO2(`偵測次數：${tickCount}`);
  const page = getPage();
  if      (page==='CONCERT') { captchaLogged=false; handleConcert(); }
  else if (page==='VERIFY')  { captchaLogged=false; handleVerify();  }
  else if (page==='ZONES')   { captchaLogged=false; handleZones();   }
  else if (page==='FIXED')   { captchaLogged=false; handleFixed();   }
  else                        handleCaptcha(); // 驗證/未知頁面
}

// ── 驗證/CAPTCHA 頁面 ─────────────────────────────────────
function handleCaptcha() {
  setO('偵測到驗證關卡，請手動完成...', '#ffcc44');
  if (!captchaLogged) {
    captchaLogged = true;
    log('偵測到人工驗證頁面，請完成驗證後系統將自動繼續', 'warn');
    chrome.storage.local.set({ currentStep: 'CAPTCHA' });
    chrome.runtime.sendMessage({ type: 'STEP', step: 'CAPTCHA' }).catch(() => {});
  }
  // 繼續等待，不做任何點擊；當頁面跳轉至 zones.php，
  // 新的 content script 會透過 storage 自動恢復並繼續搶票
}

// ════════════════════════════════════════════════════════
// STEP 1 — Concert page
// ════════════════════════════════════════════════════════
function handleConcert() {
  if (stepDone.CONCERT) return;

  if (!document.querySelector('.ticket-status.inline.available')) {
    setO('等待開賣...', '#ffcc44');
    if (settings.autoRefresh) {
      log('尚未開賣，3 秒後重整', 'warn');
      setTimeout(()=>location.reload(), 3000);
    }
    return;
  }

  const items = document.querySelectorAll('#section-event-round .event-detail-item');
  if (!items.length) { setO('找不到場次...', '#ffcc44'); return; }

  const candidates = [];
  items.forEach(item => {
    const txt   = item.querySelector('.box-txt')?.textContent || '';
    const price = parsePrice(txt);
    item.querySelectorAll('a[data-button]').forEach(btn => {
      const dateEl  = btn.closest('.row')?.querySelector('.col-label .date');
      const timeEl  = btn.querySelector('.item-show');
      const dateText = dateEl?.textContent?.trim() || '';
      const timeText = timeEl?.textContent?.trim() || btn.textContent.trim();
      candidates.push({ btn, txt, price, dateText, timeText });
    });
  });

  if (!candidates.length) { setO('找不到購票按鈕...', '#ffcc44'); return; }

  let filtered = candidates;
  if (settings.targetDate) {
    const kw = settings.targetDate.toLowerCase();
    filtered = filtered.filter(c =>
      c.dateText.toLowerCase().includes(kw) ||
      c.timeText.toLowerCase().includes(kw) ||
      c.txt.toLowerCase().includes(kw)
    );
  }
  if (settings.targetTicket) {
    const kw = settings.targetTicket.toLowerCase();
    filtered = filtered.filter(c => c.txt.toLowerCase().includes(kw));
  }
  if (!filtered.length) { setO('沒有符合場次，等待...', '#ffcc44'); return; }

  // 無票種關鍵字 → 高價優先
  if (!settings.targetTicket) filtered.sort((a,b)=>b.price-a.price);

  const {btn, timeText, price} = filtered[0];
  const m = (btn.getAttribute('onclick')||'').match(/signin\(['"](https?:\/\/[^'"]+)['"]\)/);

  stepDone.CONCERT = true;
  setO(`場次 [${timeText}] ${price}฿ → 前往...`, '#4cff91');
  log(`選擇場次：${timeText}，${price} บาท`, 'success');
  setStep('VERIFY');

  setTimeout(() => { humanClick(btn); }, 200);
}

function parsePrice(text) {
  const m = text.replace(/,/g,'').match(/(\d+)\s*บาท/);
  return m ? parseInt(m[1]) : 0;
}

// ════════════════════════════════════════════════════════
// STEP 2 — verify_condition.php
// ════════════════════════════════════════════════════════
function handleVerify() {
  if (stepDone.VERIFY) return;
  const cb  = document.querySelector('#rdagree');
  const btn = document.querySelector('button.btn-solid-round5-blue');
  if (!cb||!btn) { setO('等待條款頁...', '#88aaff'); return; }
  if (!cb.checked) {
    humanClick(cb); // 模擬真人點擊勾選，等下一個 tick 確認
    return;
  }
  if (cb.checked && !stepDone.VERIFY) {
    stepDone.VERIFY = true;
    setTimeout(()=>{ humanClick(btn); log('已點擊「ซื้อบัตร」', 'success'); setStep('ZONES'); }, 500);
  }
}

// ════════════════════════════════════════════════════════
// STEP 3 — zones.php
// ════════════════════════════════════════════════════════
let _zonesDetectedLogged = false;

function handleZones() {
  if (stepDone.ZONES) return;

  const frm  = document.forms['frm'] || document.querySelector('form[name="frm"]');
  const kEl  = frm?.elements['k']    || document.querySelector('[name="k"]');
  const rdEl = frm?.elements['rdId'] || document.querySelector('[name="rdId"]');
  if (!kEl||!rdEl) { setO('等待 Zone 表單...', '#88aaff'); return; }

  const k=kEl.value, rdId=rdEl.value;
  if (!k||!rdId) { setO('表單值為空...', '#ffcc44'); return; }

  const areas = Array.from(document.querySelectorAll('map area'));
  if (!areas.length) { setO('等待 Zone 地圖...', '#88aaff'); return; }

  // 嘗試多種格式抓取 zone 名稱：
  // 1. href="#ZONE"  2. href/onclick 含 selectzone('ZONE')  3. title/alt 屬性
  const availZones = [];
  areas.forEach(a => {
    const href    = a.getAttribute('href')    || '';
    const onclick = a.getAttribute('onclick') || '';
    const title   = a.getAttribute('title')   || '';
    const alt     = a.getAttribute('alt')     || '';

    // selectzone('ZONE') pattern
    const mJS = (href + onclick).match(/selectzone\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (mJS) { availZones.push(mJS[1]); return; }

    // href="#ZONE" fragment
    const mHash = href.match(/#([^#?&]+)/);
    if (mHash && mHash[1] !== '' && mHash[1] !== '0') { availZones.push(mHash[1]); return; }

    // title 或 alt 有內容就用
    const label = (title || alt).trim();
    if (label) availZones.push(label);
  });

  if (!availZones.length) {
    setO('Zone 地圖載入中，等待...', '#88aaff');
    return;
  }
  // 顯示偵測到的 zone 名稱（方便核對關鍵字是否填對）
  setO2(`偵測 ${availZones.length} 區：${availZones.join(', ')}`);
  if (!_zonesDetectedLogged) {
    _zonesDetectedLogged = true;
    log(`頁面 Zone 清單：${availZones.join(', ')}`, 'info');
  }

  // 儲存 zones page URL 供回退使用
  chrome.storage.local.get('zonesPageUrl', stored => {
    if (!stored.zonesPageUrl || !stored.zonesPageUrl.includes('zones.php')) {
      chrome.storage.local.set({ zonesPageUrl: location.href });
    }
  });

  const kws = (settings.zoneKeywords||[]).map(k=>k.toUpperCase());

  // 決定候選範圍：有關鍵字只考慮匹配的 zone，沒有則全部
  let pool;
  if (kws.length) {
    pool = availZones.filter(z =>
      kws.some(kw => z.toUpperCase()===kw ||
                     z.toUpperCase().includes(kw) ||
                     kw.includes(z.toUpperCase()))
    );
    if (!pool.length) {
      setO(`Zone [${kws.join('/')}] 頁面上找不到，等待...`, '#ffcc44');
      return;
    }
  } else {
    pool = availZones;
  }

  // 用 zoneIdx 計數器無限輪詢：A→B→A→B→...
  chrome.storage.local.get('zoneIdx', d => {
    const idx    = (d.zoneIdx || 0) % pool.length;
    const chosen = pool[idx];

    // 找到對應 zone 的 <area> 元素，直接點擊觸發原生 selectzone()
    // 這樣伺服器才能看到正常的 zone 選擇流程（不是直接跳 URL）
    const chosenArea = areas.find(a => {
      const href    = a.getAttribute('href')    || '';
      const onclick = a.getAttribute('onclick') || '';
      const mJS = (href + onclick).match(/selectzone\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
      if (mJS) return mJS[1].toUpperCase() === chosen.toUpperCase();
      const mHash = href.match(/#([^#?&]+)/);
      if (mHash && mHash[1] !== '' && mHash[1] !== '0')
        return mHash[1].toUpperCase() === chosen.toUpperCase();
      return false;
    });

    stepDone.ZONES = true;
    chrome.storage.local.set({
      zonesPageUrl: location.href,
      currentZone:  chosen,
      zoneReloadCount: 0,
      zoneIdx: idx + 1,
    });
    setO(`✓ Zone: ${chosen} → 點擊進入...`, '#4cff91');
    log(`Zone ${chosen}`, 'success');
    setStep('FIXED');
    setTimeout(() => {
      if (chosenArea) {
        chosenArea.click(); // 觸發原生 selectzone()，走正常流程
      } else {
        // 找不到 area 元素才 fallback 直接跳 URL
        const dest = `${location.origin}/booking/3m/fixed.php?k=${k}&zone=${chosen}&round=${rdId}`;
        location.href = dest;
      }
    }, 300);
  }); // closes chrome.storage.local.get('zoneIdx', ...)
} // closes handleZones

// ════════════════════════════════════════════════════════
// STEP 4 — fixed.php
// 功能：多座位、方向選擇、alert 攔截、Zone 回退
// ════════════════════════════════════════════════════════
let fixedPhase     = 'INIT';
let fixedRetry     = 0;   // 連續偵測不到座位的次數（≥2 換 zone）
let seatClickFails = 0;   // 點擊失敗累計（≥20 重整頁面）
let seatsSelected  = 0;
let triedSeatIds   = new Set();
let _triedZones    = [];

function resetFixed() {
  fixedPhase     = 'INIT';
  fixedRetry     = 0;
  seatClickFails = 0;
  seatsSelected  = 0;
  triedSeatIds   = new Set();
}

// 模擬真人滑鼠點擊（帶座標，比 .click() 更難偵測）
function humanClick(el) {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 3;
  const y = rect.top  + rect.height / 2 + (Math.random() - 0.5) * 3;
  const opts = {
    bubbles: true, cancelable: true,
    clientX: x, clientY: y,
    screenX: x + window.screenX, screenY: y + window.screenY,
    view: window,
  };
  ['mouseover','mouseenter','mousedown','mouseup','click'].forEach(type => {
    el.dispatchEvent(new MouseEvent(type, opts));
  });
}

// 關閉 modal（點擊實際關閉按鈕，避免派發 isTrusted:false 的鍵盤事件）
function closeModal() {
  const closeSelectors = [
    '.fancybox-close',
    '.fancybox-button--close',
    '[data-fancybox-close]',
    '.modal.show .close',
    '.modal.show .btn-close',
    '.popup-normal .close',
    '.popup-normal .btn-close',
    'button[aria-label="Close"]',
  ];
  for (const sel of closeSelectors) {
    const el = document.querySelector(sel);
    if (el) { el.click(); return; }
  }
  try { $.fancybox?.close?.(); } catch(e){}
}

// 座位優先順序：前中 > 後中 > 前右靠中 > 前左靠中 > 其他
// direction 控制「右靠中」與「左靠中」的優先順序（LEFT 時左優先）
function sortSeats(seats, direction, priorityRows) {
  const getNum = el => {
    const m = (el.id||'').match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  };

  const table  = document.getElementById('tableseats');
  const rowOf  = new Map(); // seatId → rowIndex
  const ctrOf  = new Map(); // rowIndex → 該排真正中心（用所有座位含售出計算）
  const hwOf   = new Map(); // rowIndex → 半排寬（用於算相對距離）

  if (table) {
    table.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
      const allNums = [];
      tr.querySelectorAll('[id^="checkseat"]').forEach(el => {
        rowOf.set(el.id, rowIdx);
        const n = getNum(el);
        if (n) allNums.push(n);
      });
      if (allNums.length) {
        const mn = Math.min(...allNums), mx = Math.max(...allNums);
        ctrOf.set(rowIdx, (mn + mx) / 2);
        hwOf.set(rowIdx, (mx - mn) / 2 || 1); // 避免除以 0
      }
    });
  }

  const getRow = el => rowOf.get(el.id) ?? 9999;
  const pRows  = typeof priorityRows === 'number' ? priorityRows : 5;

  // 計算每個座位的優先分組 (0=最佳) 與精確距離
  const score = el => {
    const num    = getNum(el);
    const row    = getRow(el);
    const center = ctrOf.get(row) ?? 0;
    const hw     = hwOf.get(row)  ?? 1;
    const dist   = Math.abs(num - center);
    const relDist = dist / hw;          // 0=中央, 1=邊緣
    const isFront = row < pRows;
    const isRight = num >= center;

    // 「中間座位」定義：相對距離 < 35%（排內最中央約 70% 範圍）
    const isCenter = relDist < 0.35;

    let group;
    if      (isCenter && isFront)   group = 0; // 前排中間（最優先）
    else if (isCenter && !isFront)  group = 1; // 後排中間
    else if (isFront && isRight)    group = 2; // 前排右靠中
    else if (isFront && !isRight)   group = 3; // 前排左靠中
    else                            group = 4; // 其他（後排側邊）

    // LEFT 方向：左右互換優先順序
    if (direction === 'LEFT') {
      if (group === 2) group = 3;
      else if (group === 3) group = 2;
    }

    return [group, relDist, row];
  };

  return [...seats].sort((a, b) => {
    const [ga, da, ra] = score(a);
    const [gb, db, rb] = score(b);
    if (ga !== gb) return ga - gb;   // 先依分組
    if (da !== db) return da - db;   // 再依距中心遠近
    return ra - rb;                  // 最後依排數（前排優先）
  });
}

// 所有 Zone 試完 → 返回 zones page
async function goBackToZones() {
  const data = await chrome.storage.local.get(['zonesPageUrl','triedZones','currentZone']);
  const cur = (data.currentZone || new URLSearchParams(location.search).get('zone') || '').toUpperCase();
  const tried = [...(data.triedZones||[])];
  if (cur && !tried.includes(cur)) tried.push(cur);
  _triedZones = tried;
  await chrome.storage.local.set({ triedZones:tried, currentStep:'ZONES' });
  stepDone = { CONCERT:true, VERIFY:true }; // 保留前兩步完成狀態
  resetFixed();
  const zonesUrl = data.zonesPageUrl || (location.origin+'/booking/3m/zones.php');
  setO(`Zone 全滿，返回重選...`, '#ffcc44');
  log(`Zone ${cur} 全滿，返回 zones 頁`, 'warn');
  setStep('ZONES');
  setTimeout(()=>{ location.href=zonesUrl; }, 500);
}

function handleFixed() {
  if (stepDone.FIXED) return;

  // ── INIT ──
  if (fixedPhase==='INIT') {
    chrome.storage.local.get('triedZones', d=>{ _triedZones=(d.triedZones||[]).map(z=>z.toUpperCase()); });
    fixedPhase='SELECT';
    return;
  }

  // ── SELECT ──
  if (fixedPhase==='SELECT') {
    const seatCount = settings.seatCount||1;
    const selected  = document.querySelectorAll('input[id^="hid-checkseat"]');

    // 已選夠
    if (selected.length >= seatCount) {
      fixedPhase='CONFIRM'; return;
    }

    const table = document.getElementById('tableseats');
    if (!table) { setO('等待座位圖...', '#88aaff'); return; }

    // 可用座位（未試過 + 確認可點擊）
    let available = Array.from(table.querySelectorAll('.seatuncheck'))
      .filter(el => {
        // 排除已知不可用 class
        if (el.classList.contains('seatchecked'))   return false;
        if (el.classList.contains('seatnotavail'))  return false;
        if (el.classList.contains('seatsocialdis')) return false;
        if (el.classList.contains('seathold'))      return false;
        if (el.classList.contains('seatdisable'))   return false;
        if (triedSeatIds.has(el.id))                return false;

        // 排除 CSS 禁止點擊的座位（紅色禁止符號通常伴隨這些樣式）
        const style = getComputedStyle(el);
        if (style.pointerEvents === 'none')   return false;
        if (style.cursor === 'not-allowed')   return false;
        if (style.cursor === 'default' && style.opacity === '0.3') return false;

        // 可用座位應有數字文字（座位號）；售出座位通常是背景圖，文字為空或是禁止符號
        const txt = el.textContent.trim();
        if (txt.length > 0 && !/\d/.test(txt)) return false;

        return true;
      });

    if (!available.length) {
      fixedRetry++;
      if (fixedRetry >= 3) {
        // 連續 3 次偵測不到座位 → 重整頁面繼續等候（不換 Zone）
        log(`Zone 連續 ${fixedRetry} 次無可用座位，重整頁面繼續監控`, 'warn');
        setO('無可用座位，重整繼續監控...', '#ffcc44');
        fixedRetry = 0;
        setTimeout(() => location.reload(), 800);
      } else {
        setO(`Zone 內暫無可用座位，重試 ${fixedRetry}/3...`, '#ffcc44');
      }
      return;
    }
    fixedRetry = 0; // 有偵測到座位則重置連續計數

    // 依排數優先 + 方向排序
    available = sortSeats(available, settings.seatDirection||'MIDDLE', settings.priorityRows??5);

    const seat   = available[0];
    const seatId = seat.id || seat.dataset?.seat || '?';
    triedSeatIds.add(seat.id);

    humanClick(seat);   // 模擬真人滑鼠點擊
    closeModal();       // 關閉可能出現的自訂 modal

    setO(`點擊座位 ${seatId}（${selected.length+1}/${seatCount}）...`, '#88aaff');

    fixedPhase='WAIT_RESULT';
    setTimeout(()=>{
      const seatEl = document.getElementById(seat.id);
      // 成功判斷：座位 class 變為 seatchecked（綠色勾勾）
      // 或對應的 hidden input 已建立
      const success = seatEl?.classList.contains('seatchecked') ||
                      !!document.getElementById(`hid-${seat.id}`);

      if (!success) {
        seatClickFails++;
        log(`座位 ${seatId} 搶佔失敗，嘗試下一個... (${seatClickFails}/20)`, 'warn');
        setO(`✗ ${seatId} 失敗，換下一個... (${seatClickFails}/20)`, '#ffcc44');

        // 同一 Zone 點擊失敗達 20 次 → 重整頁面繼續監控（不換 Zone）
        if (seatClickFails >= 20) {
          seatClickFails = 0;
          log(`點擊失敗達 20 次，重整頁面繼續監控`, 'warn');
          setO('失敗 20 次，重整繼續監控...', '#ffcc44');
          setTimeout(() => location.reload(), 400);
          return;
        }
      } else {
        seatsSelected++;
        clickCount++;
        chrome.storage.local.set({clickCount});
        chrome.runtime.sendMessage({type:'CLICK_COUNT',count:clickCount}).catch(()=>{});
        log(`✓ 座位 ${seatId} 選定（${seatsSelected}/${seatCount}）`, 'success');
        setO(`✓ ${seatId} 選定 (${seatsSelected}/${seatCount})`, '#4cff91');
      }
      fixedPhase='SELECT';
    }, 300); // 縮短至 300ms（不需等待提示框出現）
    return;
  }

  if (fixedPhase==='WAIT_RESULT') return;

  // ── CONFIRM ──
  if (fixedPhase==='CONFIRM') {
    const selected = document.querySelectorAll('input[id^="hid-checkseat"]');
    if (!selected.length) { log('座位未選到，重試...','warn'); fixedPhase='SELECT'; return; }

    const confirmBtn =
      document.getElementById('booknow') ||
      document.getElementById('bookmnow') ||
      document.querySelector('a.btn-red.btn-main-action');
    if (!confirmBtn) { setO('找不到確認按鈕...','#ffcc44'); return; }

    fixedPhase='DONE';
    stepDone.FIXED=true;
    setO('✓ 點擊「ยืนยันที่นั่ง」！', '#4cff91');
    log(`已選 ${selected.length} 個座位，點擊確認！`, 'success');
    setStep('DONE');
    humanClick(confirmBtn);
    clearTimeout(tickerInterval); tickerInterval=null;
    chrome.storage.local.set({isRunning:false});
    chrome.runtime.sendMessage({type:'STEP',step:'DONE'}).catch(()=>{});
    setTimeout(()=>rmO(), 6000);
  }
}

// ── 工具 ──────────────────────────────────────────────────
let clickCount = 0;
function setStep(step) {
  chrome.storage.local.set({currentStep:step});
  chrome.runtime.sendMessage({type:'STEP',step}).catch(()=>{});
}
function log(text, level='info') {
  chrome.runtime.sendMessage({type:'LOG',text,level}).catch(()=>{});
}
