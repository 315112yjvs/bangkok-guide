// content.js — ThaiTicketMajor 搶票核心 v3
// Flow: Concert → Verify → Zones → Fixed(多座位/方向/重試) → Done

let tickerInterval = null;
let isRunning = false;
let settings = null;
let stepDone = {};
let overlayEl = null;
let refreshPending = false;

// ── 頁面偵測 ──────────────────────────────────────────────
function getPage() {
  const p = location.pathname;
  if (p.includes('verify_condition')) return 'VERIFY';
  if (p.includes('verify.php'))       return 'PASSPORT';
  if (p.includes('zones.php'))        return 'ZONES';
  if (p.includes('fixed.php'))        return 'FIXED';
  if (location.hostname === 'www.thaiticketmajor.com' ||
      location.hostname === 'thaiticketmajor.com') return 'CONCERT';
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
  settings       = cfg;
  isRunning      = true;
  stepDone       = { ...initialDone };
  passportFilled = false;
  refreshPending = false;
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
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.isRunning?.newValue === true && !isRunning)
    chrome.storage.local.get(STORAGE_KEYS, startFromStorage);
  if (changes.isRunning?.newValue === false && isRunning)
    stop();
});

// ── startFromStorage：從 storage 讀取設定並啟動 ─────────
const STORAGE_KEYS = [
  'isRunning','targetDate','targetTicket','zoneKeywords','targetZone',
  'seatCount','seatDirection','priorityRows','autoRefresh','interval',
  'currentStep','triedZones','passportId',
];

function startFromStorage(data) {
  _triedZones = (data.triedZones || []).map(z => z.toUpperCase());
  let zoneKeywords = data.zoneKeywords || [];
  if (!zoneKeywords.length && data.targetZone)
    zoneKeywords = data.targetZone.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  const initialDone = resolveInitialDone(data.currentStep || '');
  start({
    targetDate:    data.targetDate    || '',
    targetTicket:  data.targetTicket  || '',
    zoneKeywords,
    seatCount:     data.seatCount     || 1,
    seatDirection: data.seatDirection || 'MIDDLE',
    priorityRows:  data.priorityRows  ?? 5,
    passportId:    data.passportId    || '',
    autoRefresh:   data.autoRefresh   || false,
    interval:      data.interval      || 800,
  }, initialDone);
}

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
chrome.storage.local.get(STORAGE_KEYS, data => {
  if (data.isRunning) startFromStorage(data);
});

// ── 主迴圈 ────────────────────────────────────────────────
let tickCount = 0;
let captchaLogged = false;

function tick() {
  if (!isRunning) return;
  tickCount++;
  setO2(`偵測次數：${tickCount}`);
  const page = getPage();
  if      (page==='CONCERT')  { captchaLogged=false; handleConcert();  }
  else if (page==='VERIFY')   { captchaLogged=false; handleVerify();   }
  else if (page==='PASSPORT') { captchaLogged=false; handlePassport(); }
  else if (page==='ZONES')    { captchaLogged=false; handleZones();    }
  else if (page==='FIXED')    { captchaLogged=false; handleFixed();    }
  else                         handleCaptcha(); // 驗證/未知頁面
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
    if (settings.autoRefresh && !refreshPending) {
      refreshPending = true;
      log('尚未開賣，3 秒後重整', 'warn');
      setTimeout(() => { refreshPending = false; location.reload(); }, 3000);
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
  } else {
    // 無關鍵字時自動排除 Live Streaming / RERUN（只搶實體票）
    const EXCLUDE = ['streaming', 'live stream', 'rerun', 're-run', 'ttm live'];
    const physicalOnly = filtered.filter(c =>
      !EXCLUDE.some(x => c.txt.toLowerCase().includes(x))
    );
    // 若還有實體票則只選實體票，否則保留全部（避免過濾太嚴）
    if (physicalOnly.length) filtered = physicalOnly;
  }
  if (!filtered.length) { setO('沒有符合場次，等待...', '#ffcc44'); return; }

  // 高價優先（實體票通常比串流貴，可作為額外保險）
  filtered.sort((a,b)=>b.price-a.price);

  const {btn, timeText, price} = filtered[0];

  // 從 onclick 取出 signin 目標 URL（直接導頁，不觸發可能彈 modal 的 $app.popup.signin）
  const signinUrl = (btn.getAttribute('onclick') || '').match(/signin\(['"](.+?)['"]\)/)?.[1];

  stepDone.CONCERT = true;
  setO(`場次 [${timeText}] ${price}฿ → 前往...`, '#4cff91');
  log(`選擇場次：${timeText}，${price} บาท`, 'success');
  setStep('VERIFY');

  setTimeout(() => {
    if (signinUrl) {
      location.href = signinUrl;
    } else {
      humanClick(btn); // 備援：找不到 URL 時才用 click
    }
  }, 200);
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
    humanClick(cb);
    return;
  }
  stepDone.VERIFY = true;
  setTimeout(() => { humanClick(btn); log('已點擊「ซื้อบัตร」', 'success'); setStep('ZONES'); }, 500);
}

// ════════════════════════════════════════════════════════
// STEP 2b — verify.php（身分證 / 護照號碼驗證）
// ════════════════════════════════════════════════════════
let passportFilled = false;

function handlePassport() {
  if (stepDone.PASSPORT) return;

  if (!settings.passportId) {
    setO('請在插件填入身分證/護照號碼', '#ffcc44');
    return;
  }

  const input = document.querySelector('input[type="text"]') ||
                document.querySelector('input[type="tel"]') ||
                document.querySelector('input[name="citizen_id"]') ||
                document.querySelector('input[name="passport"]') ||
                document.querySelector('input[name="id"]');

  const btn = Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent.includes('ตกลง') || b.type === 'submit'
  ) || document.querySelector('button[type="submit"]') ||
       document.querySelector('input[type="submit"]');

  if (!input) { setO('等待身分驗證頁面...', '#88aaff'); return; }
  if (!btn)   { setO('找不到確認按鈕...', '#ffcc44');   return; }

  if (!passportFilled) {
    passportFilled = true;
    input.focus();
    input.value = settings.passportId;
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    setO('✓ 已填入證件號，點擊確認...', '#4cff91');
    log(`填入證件號碼並送出`, 'success');
    setTimeout(() => {
      stepDone.PASSPORT = true;
      humanClick(btn);
    }, 500);
  }
}

// ════════════════════════════════════════════════════════
// STEP 3 — zones.php
// ════════════════════════════════════════════════════════
let _zonesDetectedLogged = false;
let _zonesUrlSaved = false;

// 計算 <area> 的幾何中心（從 coords 屬性解析）
function getZoneCoords(area) {
  const nums = (area.getAttribute('coords') || '').split(',').map(Number).filter(n => !isNaN(n));
  if (nums.length < 2) return { cx: null, cy: null };
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return {
    cx: xs.reduce((a, b) => a + b, 0) / xs.length,
    cy: ys.reduce((a, b) => a + b, 0) / ys.length,
  };
}

function handleZones() {
  if (stepDone.ZONES) return;

  const frm  = document.forms['frm'] || document.querySelector('form[name="frm"]');
  const kEl  = frm?.elements['k']    || document.querySelector('[name="k"]');
  const rdEl = frm?.elements['rdId'] || document.querySelector('[name="rdId"]') ||
               document.querySelector('select[name="rdId"]') ||
               document.querySelector('select'); // 場次 dropdown fallback
  if (!rdEl) { setO('等待 Zone 表單...', '#88aaff'); return; }

  // k：優先從表單取，次選 URL query 參數（新版頁面用 ?query=xxx）
  let k    = kEl?.value || '';
  let rdId = rdEl.value || '';

  if (!k) {
    const p = new URLSearchParams(location.search);
    k = p.get('k') || p.get('query') || '';
  }

  // rdId 對應 select dropdown 且尚未選擇場次 → 自動選擇
  if (!rdId && rdEl.tagName === 'SELECT') {
    const opts = Array.from(rdEl.options).filter(o => o.value && o.value !== '0');
    if (!opts.length) { setO('等待場次選項載入...', '#88aaff'); return; }

    let chosen = opts[0]; // 預設第一個
    if (settings.targetDate) {
      const kw = settings.targetDate.toLowerCase();
      const hit = opts.find(o => o.text.toLowerCase().includes(kw));
      if (hit) chosen = hit;
    }
    setO(`選擇場次：${chosen.text}...`, '#88aaff');
    log(`自動選擇場次：${chosen.text}`, 'info');
    rdEl.value = chosen.value;
    rdEl.dispatchEvent(new Event('change', { bubbles: true }));
    rdId = chosen.value;
    return; // 等下一個 tick，讓頁面反應
  }

  if (!k || !rdId) { setO('表單值為空...', '#ffcc44'); return; }

  const areas = Array.from(document.querySelectorAll('map area'));
  if (!areas.length) { setO('等待 Zone 地圖...', '#88aaff'); return; }

  // 一次解析，產生 { name, area } 物件，避免後續重複遍歷
  const zoneMap = [];
  areas.forEach(a => {
    const href    = a.getAttribute('href')    || '';
    const onclick = a.getAttribute('onclick') || '';
    const title   = a.getAttribute('title')   || '';
    const alt     = a.getAttribute('alt')     || '';
    const raw     = href + onclick;

    // 1. selectzone('ZONE') pattern
    const mJS = raw.match(/selectzone\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (mJS) { zoneMap.push({ name: mJS[1], area: a }); return; }

    // 2. ?zone=ZONE query 參數（支援 href="#fixed.php?zone=A2" 格式）
    const mZone = raw.match(/[?&]zone=([^&'")\s]+)/i);
    if (mZone) { zoneMap.push({ name: mZone[1], area: a }); return; }

    // 3. href="#ZONE" fragment（若解析結果是 .php 路徑，繼續往下找）
    const mHash = href.match(/#([^#?&]+)/);
    if (mHash && mHash[1] !== '' && mHash[1] !== '0' && !mHash[1].includes('.')) {
      zoneMap.push({ name: mHash[1], area: a }); return;
    }

    // 4. title 或 alt
    const label = (title || alt).trim();
    if (label) { zoneMap.push({ name: label, area: a }); return; }

    // 5. 備援：用座標字串當唯一 ID（確保每個 zone 都能被追蹤）
    const coords = a.getAttribute('coords') || '';
    if (coords) zoneMap.push({ name: `coords:${coords}`, area: a });
  });

  if (!zoneMap.length) {
    setO('Zone 地圖載入中，等待...', '#88aaff');
    return;
  }

  // 為 coords: 備援名稱產生友善顯示名
  zoneMap.forEach((z, i) => {
    z.display = z.name.startsWith('coords:') ? `Zone ${i + 1}` : z.name;
  });

  const zoneNames = zoneMap.map(z => z.display);
  setO2(`偵測 ${zoneMap.length} 區：${zoneNames.join(', ')}`);
  if (!_zonesDetectedLogged) {
    _zonesDetectedLogged = true;
    log(`頁面 Zone 清單：${zoneNames.join(', ')}`, 'info');
  }

  // 儲存 zones page URL 供回退使用（每次進入 zones.php 只做一次）
  if (!_zonesUrlSaved) {
    _zonesUrlSaved = true;
    chrome.storage.local.get('zonesPageUrl', stored => {
      if (!stored.zonesPageUrl || !stored.zonesPageUrl.includes('zones.php'))
        chrome.storage.local.set({ zonesPageUrl: location.href });
    });
  }

  const kws = (settings.zoneKeywords||[]).map(k=>k.toUpperCase());

  // 決定候選範圍：有關鍵字只考慮匹配的 zone，沒有則全部
  let pool;
  if (kws.length) {
    pool = zoneMap.filter(z =>
      kws.some(kw => z.name.toUpperCase() === kw ||
                     z.name.toUpperCase().includes(kw) ||
                     kw.includes(z.name.toUpperCase()))
    );
    if (!pool.length) {
      setO(`Zone [${kws.join('/')}] 頁面上找不到，等待...`, '#ffcc44');
      return;
    }
  } else {
    // 無關鍵字：依地圖座標自動排序
    // 優先順序：靠舞台前排（y 小）> 靠水平中心（中間 Zone）
    const mapImg = document.querySelector('img[usemap]');
    const imgW   = mapImg?.naturalWidth || mapImg?.offsetWidth || 0;
    const midX   = imgW > 0 ? imgW / 2 : null;
    pool = [...zoneMap].sort((a, b) => {
      const ca = getZoneCoords(a.area);
      const cb = getZoneCoords(b.area);
      // y 差異 > 20px 視為不同排，前排（y 小）優先
      if (ca.cy !== null && cb.cy !== null && Math.abs(ca.cy - cb.cy) > 20)
        return ca.cy - cb.cy;
      // 同排：靠水平中心優先
      if (midX !== null && ca.cx !== null && cb.cx !== null)
        return Math.abs(ca.cx - midX) - Math.abs(cb.cx - midX);
      return 0;
    });
  }

  // 直接從 storage 讀取已試過的 zone（不靠記憶體變數，避免跨頁重整後遺失）
  chrome.storage.local.get('triedZones', d => {
    const triedUpper = (d.triedZones || []).map(z => z.toUpperCase());

    const untriedPool = pool.filter(z => !triedUpper.includes(z.name.toUpperCase()));
    let activePool;
    if (untriedPool.length) {
      activePool = untriedPool;
    } else {
      // 所有 zone 都試過 → 清空重頭輪詢
      activePool = pool;
      chrome.storage.local.set({ triedZones: [] });
      log('所有 Zone 都嘗試過，重頭輪詢', 'warn');
      setO('所有 Zone 都試過，重頭輪詢...', '#ffcc44');
    }

    const chosen = activePool[0]; // { name, area }

    log(`選 Zone: ${chosen.display}（已試：${triedUpper.join(',') || '無'}）`, 'info');

    stepDone.ZONES = true;
    chrome.storage.local.set({
      zonesPageUrl: location.href,
      currentZone:  chosen.name,   // 儲存原始 name 供 triedZones 追蹤
      zoneReloadCount: 0,
    });
    setO(`✓ Zone: ${chosen.display} → 點擊進入...`, '#4cff91');
    log(`Zone ${chosen.display}`, 'success');
    setStep('FIXED');
    setTimeout(() => {
      if (chosen.area) {
        chosen.area.click();
      } else {
        const dest = `${location.origin}/booking/3m/fixed.php?k=${k}&zone=${chosen.name}&round=${rdId}`;
        location.href = dest;
      }
    }, 300);
  });
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

// 統一的 reload / 換 Zone 邏輯：無論哪種原因，3 次 reload 後換 Zone
function reloadOrSwitchZone(reason) {
  chrome.storage.local.get('zoneReloadCount', d => {
    const reloadCount = (d.zoneReloadCount || 0) + 1;
    if (reloadCount >= 3) {
      chrome.storage.local.set({ zoneReloadCount: 0 });
      log(`${reason}，已重整 3 次，切換下一個 Zone`, 'warn');
      setO('重整 3 次無進展，切換下一 Zone...', '#ff8844');
      goBackToZones();
    } else {
      chrome.storage.local.set({ zoneReloadCount: reloadCount });
      log(`${reason}，重整 ${reloadCount}/3`, 'warn');
      setO(`${reason}，重整 ${reloadCount}/3...`, '#ffcc44');
      setTimeout(() => location.reload(), 800);
    }
  });
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
    else if (!isCenter && isFront)  group = 1; // 前排側邊
    else if (isCenter && !isFront)  group = 2; // 後排中間
    else                            group = 3; // 後排側邊

    // 方向偏好：在側邊組（group 1/3）中決定左/右哪側優先（0=偏好，1=次選）
    let dirScore = 0;
    if (!isCenter) {
      if      (direction === 'LEFT')  dirScore = isRight ? 1 : 0;
      else if (direction === 'RIGHT') dirScore = isRight ? 0 : 1;
    }

    return [group, dirScore, relDist, row];
  };

  return [...seats].sort((a, b) => {
    const [ga, dsa, da, ra] = score(a);
    const [gb, dsb, db, rb] = score(b);
    if (ga !== gb)   return ga - gb;     // 先依分組
    if (dsa !== dsb) return dsa - dsb;   // 再依方向偏好（側邊組有效）
    if (da !== db)   return da - db;     // 再依距中心遠近
    return ra - rb;                      // 最後依排數（前排優先）
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
  stepDone = { CONCERT:true, VERIFY:true };
  resetFixed();
  _zonesDetectedLogged = false;
  _zonesUrlSaved = false;
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
    chrome.storage.local.get(['triedZones','currentZone'], d=>{
      _triedZones = (d.triedZones||[]).map(z=>z.toUpperCase());
      const zoneName = d.currentZone || new URLSearchParams(location.search).get('zone') || '?';
      setO(`進入 Zone: ${zoneName}，掃描座位中...`, '#88aaff');
      log(`進入 Zone: ${zoneName}`, 'info');
    });
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
      if (fixedRetry >= 2) {
        fixedRetry = 0;
        reloadOrSwitchZone('無可用座位');
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
        log(`座位 ${seatId} 搶佔失敗，嘗試下一個... (${seatClickFails}/5)`, 'warn');
        setO(`✗ ${seatId} 失敗，換下一個... (${seatClickFails}/5)`, '#ffcc44');

        if (seatClickFails >= 5) {
          seatClickFails = 0;
          reloadOrSwitchZone('點擊失敗 5 次');
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
