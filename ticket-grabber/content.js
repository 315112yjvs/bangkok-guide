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
  if (/queue|waiting[-_]?room/i.test(location.href)) return 'QUEUE';
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
// 卡關偵測：每次狀態文字「真的改變」就記錄時間，停留過久即視為卡關
let _lastStatusText = '';
let _statusChangedAt = Date.now();
let _stallWarned = false;
const setO  = (t,c='#aaa')=>{
  if(!overlayEl)createOverlay();
  const e=document.getElementById('__s__'); if(e){e.textContent=t;e.style.color=c;}
  if (t !== _lastStatusText) { _lastStatusText = t; _statusChangedAt = Date.now(); _stallWarned = false; }
};
const setO2 = t=>{ if(!overlayEl)return; const e=document.getElementById('__c__'); if(e)e.textContent=t; };
const rmO   = ()=>{ overlayEl?.remove(); overlayEl=null; };

// ── 提示音（Web Audio）＋ 桌面通知 ─────────────────────────
// 桌面通知交給 background service worker 處理（content script 無權直接呼叫）。
function notify(title, message, sticky = false) {
  chrome.runtime.sendMessage({ type: 'NOTIFY', title, message, sticky }).catch(() => {});
}
let _audioCtx = null;
function beep(freq = 880, dur = 200, when = 0) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const t0   = _audioCtx.currentTime + when;
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.18, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000);
    osc.connect(gain).connect(_audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur / 1000);
  } catch (e) {}
}
const alarm        = () => { beep(880,180,0); beep(1175,180,0.22); beep(880,180,0.44); }; // 警示三連音
const successChime = () => { beep(660,150,0); beep(880,150,0.16); beep(1320,320,0.32); }; // 成功上行音

// ── 啟動 / 停止 ───────────────────────────────────────────
function start(cfg, initialDone = {}) {
  if (isRunning) return;
  settings       = cfg;
  isRunning      = true;
  stepDone       = { ...initialDone };
  passportFilled = false;
  passportPhase  = 'type';
  verifyClickTries = 0;
  refreshPending = false;
  captchaLogged  = false;
  queueNotified  = false;
  _lastCaptchaBeep = 0;
  _statusChangedAt = Date.now();
  _stallWarned     = false;
  resetFixed();
  createOverlay();
  const page = getPage();
  setO(`啟動 [${page}]`, '#88aaff');
  log(`啟動，頁面：${page}`, 'info');
  setStep(page);

  scheduleTick();
}

// 用 setTimeout 遞迴取代 setInterval，加入 ±100ms 隨機抖動模擬真人節奏
function scheduleTick() {
  if (!isRunning) return;
  const base   = settings.interval || 500;
  const jitter = (Math.random() - 0.5) * 200;
  tickerInterval = setTimeout(() => {
    tick();
    scheduleTick();
  }, Math.max(200, base + jitter));
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
  'seatCount','priorityRows','autoRefresh','interval',
  'currentStep','triedZones','passportId','passportCountry',
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
    priorityRows:  data.priorityRows  ?? 5,
    passportId:      data.passportId      || '',
    passportCountry: data.passportCountry || '',
    autoRefresh:     data.autoRefresh     || false,
    interval:      data.interval      || 500,
  }, initialDone);
}

// ── initialDone 推算 ──────────────────────────────────────
// 在已知頁面（CONCERT/VERIFY/ZONES/FIXED）：只標記「此頁之前」的步驟為完成，
// 確保當前頁永遠重跑（避免 zone 點擊失敗後重整仍卡住）。
// 在未知頁面（CAPTCHA/PASSPORT）：用儲存的 currentStep 推算。
function resolveInitialDone(storedStep) {
  const stepOrder = ['CONCERT','VERIFY','ZONES','FIXED'];
  const page      = getPage();
  const pageIdx   = stepOrder.indexOf(page);
  const storedIdx = stepOrder.indexOf(storedStep);
  const effectiveIdx = pageIdx !== -1 ? pageIdx : Math.max(0, storedIdx);
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
let queueNotified = false;
let _lastCaptchaBeep = 0;
const STALL_MS = 20000; // 行動頁同一狀態停留超過此秒數即視為卡關

function tick() {
  if (!isRunning) return;
  tickCount++;
  setO2(`偵測次數：${tickCount}`);
  const page = getPage();
  if (page !== 'QUEUE') queueNotified = false;
  if      (page==='CONCERT')  { captchaLogged=false; handleConcert();  }
  else if (page==='VERIFY')   { captchaLogged=false; handleVerify();   }
  else if (page==='PASSPORT') { captchaLogged=false; handlePassport(); }
  else if (page==='ZONES')    { captchaLogged=false; handleZones();    }
  else if (page==='FIXED')    { captchaLogged=false; handleFixed();    }
  else if (page==='QUEUE')    { captchaLogged=false; handleQueue();    }
  else                         handleCaptcha(); // 驗證/未知頁面

  checkStall(page);
}

// ── 卡關偵測 ──────────────────────────────────────────────
// 只在「應該要往前推進」的行動頁啟用（排除選場等開賣、驗證碼、排隊這些正常久候情境）。
// 同一狀態文字停留超過 STALL_MS 仍沒進展，多半是版型變動抓不到元素，發聲音＋通知提醒。
const STALL_PAGES = ['VERIFY','PASSPORT','ZONES','FIXED'];
function checkStall(page) {
  if (!STALL_PAGES.includes(page)) return;
  if (_stallWarned) return;
  if (Date.now() - _statusChangedAt < STALL_MS) return;
  _stallWarned = true;
  const secs = Math.round(STALL_MS / 1000);
  log(`⚠️ 已在「${page}」頁停留 ${secs} 秒無進展，可能版型變動或卡關，請查看分頁`, 'warn');
  // 直接改顏色標紅，不經過 setO（避免重置卡關計時造成重複警示）
  const e = document.getElementById('__s__'); if (e) e.style.color = '#ff5555';
  notify('⚠️ 搶票卡關', `在 ${page} 頁停留 ${secs} 秒無進展，請查看分頁`, true);
  alarm();
}

// ── 驗證/CAPTCHA 頁面 ─────────────────────────────────────
function handleCaptcha() {
  setO('偵測到驗證關卡，請手動完成...', '#ffcc44');
  if (!captchaLogged) {
    captchaLogged = true;
    log('偵測到人工驗證頁面，請完成驗證後系統將自動繼續', 'warn');
    chrome.storage.local.set({ currentStep: 'CAPTCHA' });
    chrome.runtime.sendMessage({ type: 'STEP', step: 'CAPTCHA' }).catch(() => {});
    notify('🔔 需要人工驗證', '請回到分頁完成驗證，完成後會自動繼續搶票', true);
  }
  // 每 ~3 秒重複響鈴，避免你離開螢幕時錯過驗證視窗
  const now = Date.now();
  if (now - _lastCaptchaBeep > 3000) { _lastCaptchaBeep = now; alarm(); }
  // 繼續等待，不做任何點擊；當頁面跳轉至 zones.php，
  // 新的 content script 會透過 storage 自動恢復並繼續搶票
}

// ── 排隊／等候室頁面 ──────────────────────────────────────
// 這類頁面通常輪到你時會自動跳轉，所以保持等待即可；
// 只在進入時通知一次，並嘗試點一次明顯的「繼續／進入」按鈕（若有）。
let _queueProceedClicked = false;
function handleQueue() {
  setO('偵測到排隊／等候室，保持等待中...', '#ffcc44');
  if (!queueNotified) {
    queueNotified = true;
    _queueProceedClicked = false;
    log('進入排隊／等候室頁面，輪到你時將自動繼續', 'warn');
    chrome.storage.local.set({ currentStep: 'QUEUE' });
    chrome.runtime.sendMessage({ type: 'STEP', step: 'QUEUE' }).catch(() => {});
    notify('🎫 排隊中', '已進入等候室，輪到你時會自動繼續搶票');
  }
  // 嘗試點一次明顯的繼續按鈕（多數等候室會自動跳轉，這是保險）
  if (!_queueProceedClicked) {
    const proceed = [...document.querySelectorAll('button, a, input[type="submit"]')]
      .find(el => /continue|proceed|enter\b|ดำเนินการต่อ|ต่อไป|เข้าสู่/i.test(
        (el.textContent || '') + ' ' + (el.value || '')));
    if (proceed) { _queueProceedClicked = true; humanClick(proceed); }
  }
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
      // 1.5～3 秒隨機間隔，避免固定頻率重整被 rate-limit / Cloudflare 盯上
      const wait = 1500 + Math.random() * 1500;
      log(`尚未開賣，${(wait / 1000).toFixed(1)} 秒後重整`, 'warn');
      setTimeout(() => { refreshPending = false; location.reload(); }, wait);
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
  }, 100);
}

function parsePrice(text) {
  const t = text.replace(/,/g,'');
  const m1 = t.match(/(\d+)\s*บาท/);
  if (m1) return parseInt(m1[1]);
  const m2 = t.match(/ราคาบัตร\s*(\d+)/);
  if (m2) return parseInt(m2[1]);
  return 0;
}

// ════════════════════════════════════════════════════════
// STEP 2 — verify_condition.php
// ════════════════════════════════════════════════════════
let verifyClickTries = 0;
function handleVerify() {
  if (stepDone.VERIFY) return;
  const cb  = document.querySelector('#rdagree');
  const btn = document.querySelector('button.btn-solid-round5-blue');
  if (!cb||!btn) { setO('等待條款頁...', '#88aaff'); return; }
  if (!cb.checked) {
    verifyClickTries++;
    humanClick(cb);
    // 備援：連點兩次都沒勾上（網站可能驗 isTrusted）→ 直接設值再補發事件
    if (verifyClickTries >= 2 && !cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event('input',  { bubbles: true }));
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }
  stepDone.VERIFY = true;
  setTimeout(() => { humanClick(btn); log('已點擊「ซื้อบัตร」', 'success'); setStep('ZONES'); }, 250);
}

// ════════════════════════════════════════════════════════
// STEP 2b — verify.php（身分證 / 護照號碼驗證）
// 三階段：type → country（護照才有）→ fill
// ════════════════════════════════════════════════════════
let passportFilled = false;
let passportPhase  = 'type'; // 'type' | 'country' | 'fill'

function handlePassport() {
  if (stepDone.PASSPORT) return;
  if (!settings.passportId) { setO('請在插件填入身分證/護照號碼', '#ffcc44'); return; }

  const isThaiId = /^\d{13}$/.test(settings.passportId.replace(/\s/g, ''));

  // ── Phase type：點選類型按鈕 ────────────────────────────
  if (passportPhase === 'type') {
    const thKeyword = isThaiId ? 'บัตรประชาชน' : 'พาสปอร์ต';
    const enKeyword = isThaiId ? 'Thai ID Card' : 'Passport Number';
    const typeBtn = [...document.querySelectorAll('button')]
      .find(el => (el.textContent.includes('ยืนยัน') && el.textContent.includes(thKeyword)) ||
                  (el.textContent.includes('Verify') && el.textContent.includes(enKeyword)));

    if (!typeBtn) {
      passportPhase = 'fill'; return; // 舊格式，無類型按鈕
    }
    if (!typeBtn.classList.contains('active')) {
      setO(`選擇${isThaiId ? '身分證' : '護照'}類型...`, '#88aaff');
      humanClick(typeBtn);
      return;
    }
    // 按鈕已 active → 進下一階段
    passportPhase = isThaiId ? 'fill' : 'country';
    return;
  }

  // ── Phase country：選擇護照國家 ─────────────────────────
  if (passportPhase === 'country') {
    const dropdown = document.querySelector('#passport_country_dropdown');
    const cInput   = document.querySelector('#passport_country_input');

    // 若下拉已有選項，點第一個（觸發 jQuery chooseCountryOption）
    const firstOpt = dropdown?.querySelector('.verify-country-option');
    if (firstOpt && firstOpt.offsetParent !== null) {
      setO('點選國家...', '#88aaff');
      humanClick(firstOpt);
      passportPhase = 'fill';
      return;
    }

    // 輸入關鍵字觸發下拉（頁面 JS 監聽 input/keyup 事件）
    if (cInput && settings.passportCountry) {
      if (!cInput.value) {
        cInput.value = settings.passportCountry;
        cInput.dispatchEvent(new Event('input',      { bubbles: true }));
        cInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: '' }));
        setO(`搜尋國家：${settings.passportCountry}...`, '#88aaff');
      }
    } else {
      setO('請在插件填入護照國家（如：Taiwan）', '#ffcc44');
    }
    return;
  }

  // ── Phase fill：填入號碼並送出 ─────────────────────────
  // 確保號碼輸入框容器可見（chooseCountryOption 會 show，這裡再保險一次）
  const inputWrap = document.querySelector('#verify-input-wrap');
  if (inputWrap) inputWrap.style.display = 'block';

  const numberInput = document.querySelector('#txt_verifycode') ||
                      document.querySelector('input[type="tel"]') ||
                      [...document.querySelectorAll('input[type="text"]')]
                        .find(i => !(i.placeholder || '').includes('ประเทศ') &&
                                   !(i.placeholder || '').toLowerCase().includes('country'));

  const submitBtn = document.querySelector('#btnconfirm') ||
                    [...document.querySelectorAll('button')]
                      .find(b => (b.textContent.includes('ตกลง') || b.textContent.trim() === 'OK') && b.type === 'submit') ||
                    [...document.querySelectorAll('button')]
                      .find(b => b.textContent.trim() === 'OK');

  if (!numberInput) { setO('等待輸入框出現...', '#88aaff'); return; }
  if (!submitBtn)   { setO('找不到確認按鈕...', '#ffcc44');  return; }

  if (!passportFilled) {
    passportFilled = true;
    numberInput.focus();
    numberInput.value = settings.passportId;
    numberInput.dispatchEvent(new Event('input',  { bubbles: true }));
    numberInput.dispatchEvent(new Event('change', { bubbles: true }));
    setO('✓ 已填入證件號，點擊確認...', '#4cff91');
    log('填入證件號碼並送出', 'success');
    setTimeout(() => {
      stepDone.PASSPORT = true;
      humanClick(submitBtn);
    }, 300);
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

    // 跳過無法導航的佔位 area（href="#" 且無 onclick，如 Projection Room 標記）
    if (href === '#' && !onclick) return;

    // 1. selectzone('ZONE') pattern
    const mJS = raw.match(/selectzone\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (mJS) { zoneMap.push({ name: mJS[1], area: a }); return; }

    // 2. ?zone=ZONE query 參數（支援 href="#fixed.php?zone=A2" 格式）
    const mZone = raw.match(/[?&]zone=([^&'")\s]+)/i);
    if (mZone) { zoneMap.push({ name: mZone[1], area: a }); return; }

    // 3. href 的所有 # fragment 中找第一個不含 . 的段落
    //    支援 "#A1"、"#fixed.php#A1" 兩種格式
    const hashParts = href.split('#').slice(1);
    const zoneFrag  = hashParts.find(p => p && p !== '0' && !p.includes('.') && !p.includes('?'));
    if (zoneFrag) { zoneMap.push({ name: zoneFrag, area: a }); return; }

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

  const kws = (settings.zoneKeywords||[]).map(k=>k.trim().toUpperCase()).filter(Boolean);

  // 區域比對：精確優先，其次前綴。
  // 前綴僅在關鍵字後面接「數字 / 空白 / - / _」時才算，
  // 例如填 'A' 命中 A1/A2，但不會誤中 GA、VIP-A、AA。
  // 回傳該 zone 命中的優先資訊（idx 越小＝你填的越前面；exact 0=精確 1=前綴），不符合回 null。
  const kwRank = (zoneName) => {
    const z = zoneName.toUpperCase();
    for (let i = 0; i < kws.length; i++) {
      const k = kws[i];
      if (z === k) return { idx: i, exact: 0 };
      if (z.startsWith(k) && /[0-9\s\-_]/.test(z.charAt(k.length)))
        return { idx: i, exact: 1 };
    }
    return null;
  };

  // 決定候選範圍：有關鍵字只考慮匹配的 zone，沒有則全部
  let pool;
  if (kws.length) {
    // 嚴格照「關鍵字順序 → 精確優先 → 地圖原始順序」排序，
    // 確保永遠先試你最想要的區，不再跟著地圖 DOM 順序亂跳。
    pool = zoneMap
      .map((z, domIdx) => ({ z, rank: kwRank(z.name), domIdx }))
      .filter(o => o.rank !== null)
      .sort((a, b) =>
        a.rank.idx   - b.rank.idx   ||
        a.rank.exact - b.rank.exact ||
        a.domIdx     - b.domIdx)
      .map(o => o.z);
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
      log('所有 Zone 都嘗試過，重頭輪詢', 'warn');
      setO('所有 Zone 都試過，重頭輪詢...', '#ffcc44');
    }

    const chosen = activePool[0]; // { name, area }

    log(`選 Zone: ${chosen.display}（已試：${triedUpper.join(',') || '無'}）`, 'info');

    // 根據 zone 在地圖上的 X 位置判斷左/中/右，供 fixed.php 自動選最佳座位方向
    let zonePosition = 'CENTER';
    if (chosen.area) {
      const mapImg = document.querySelector('img[usemap]');
      const imgW   = mapImg?.naturalWidth || mapImg?.offsetWidth || 0;
      const { cx } = getZoneCoords(chosen.area);
      if (imgW > 0 && cx !== null) {
        const rel = cx / imgW;
        if (rel < 0.4)      zonePosition = 'LEFT';
        else if (rel > 0.6) zonePosition = 'RIGHT';
        else                zonePosition = 'CENTER';
      }
    }

    // 點擊當下就記入 triedZones：即使網站把我們彈回 zones.php
    // （區域全滿的常見行為），下一輪也會自動換下一個 Zone，不會卡在同一區
    const baseTried = untriedPool.length ? (d.triedZones || []) : [];
    const newTried  = [...baseTried, chosen.name];

    stepDone.ZONES = true;
    chrome.storage.local.set({
      zonesPageUrl: location.href,
      currentZone:  chosen.name,   // 儲存原始 name 供 triedZones 追蹤
      triedZones:   newTried,
      zoneReloadCount: 0,
      zonePosition,
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
      // 保險：點擊後仍停在 zones.php（被 alert 擋下或點擊沒生效）
      // → 解鎖重跑 handleZones；本區已在 triedZones，會自動改選下一區
      setTimeout(() => {
        if (isRunning && getPage() === 'ZONES' && stepDone.ZONES) {
          log(`Zone ${chosen.display} 點擊後未跳轉，改試下一區`, 'warn');
          stepDone.ZONES = false;
        }
      }, 5000);
    }, 150);
  });
} // closes handleZones

// ════════════════════════════════════════════════════════
// STEP 4 — fixed.php
// 功能：多座位、方向選擇、alert 攔截、Zone 回退
// ════════════════════════════════════════════════════════
let fixedPhase          = 'INIT';
let fixedRetry          = 0;   // 連續偵測不到座位的次數（≥2 換 zone）
let seatClickFails      = 0;   // 點擊失敗累計（≥10 重整頁面）
let noTableTicks        = 0;   // 座位表遲遲不出現的次數（≥5 視同無座位）
let seatsSelected       = 0;
let triedSeatIds        = new Set();
let plannedGroup        = []; // 多張票的相鄰連座計畫（座位 id 陣列）
let _triedZones         = [];
let _currentZonePos     = 'CENTER'; // LEFT | CENTER | RIGHT（由 zones.php 計算並存入 storage）

function resetFixed() {
  fixedPhase     = 'INIT';
  fixedRetry     = 0;
  seatClickFails = 0;
  noTableTicks   = 0;
  seatsSelected  = 0;
  triedSeatIds   = new Set();
  plannedGroup   = [];
  _currentZonePos = 'CENTER';
}

// 由 zone 在地圖上的位置推導最佳座位方向：
// 左區 → 靠右（面向舞台中心）；右區 → 靠左；中區 → 中間
function bestSeatDir(zonePos) {
  if (zonePos === 'LEFT')   return 'RIGHT';
  if (zonePos === 'RIGHT')  return 'LEFT';
  return 'MIDDLE';
}

// 統一的 reload / 換 Zone 邏輯：無論哪種原因，2 次 reload 後換 Zone
function reloadOrSwitchZone(reason) {
  chrome.storage.local.get('zoneReloadCount', d => {
    const reloadCount = (d.zoneReloadCount || 0) + 1;
    if (reloadCount >= 2) {
      chrome.storage.local.set({ zoneReloadCount: 0 });
      log(`${reason}，已重整 2 次，切換下一個 Zone`, 'warn');
      setO('重整 2 次無進展，切換下一 Zone...', '#ff8844');
      goBackToZones();
    } else {
      chrome.storage.local.set({ zoneReloadCount: reloadCount });
      log(`${reason}，重整 ${reloadCount}/2`, 'warn');
      setO(`${reason}，重整 ${reloadCount}/2...`, '#ffcc44');
      setTimeout(() => location.reload(), 400);
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
  const pRows  = Number.isFinite(priorityRows) ? priorityRows : 5; // 擋掉 NaN/null，避免前排判斷失效

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

// 多張票時找「同排連續座號」的相鄰空位組（座號連續視為相鄰）。
// 回傳最佳的 need 連座（前 priorityRows 排優先 → 靠該排中心優先），找不到回 null。
function findAdjacentRun(seats, need, priorityRows) {
  const table = document.getElementById('tableseats');
  if (!table) return null;
  const getNum = el => {
    const m = (el.id || '').match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  };
  const availIds = new Set(seats.map(el => el.id));
  const pRows    = Number.isFinite(priorityRows) ? priorityRows : 5;
  const runs     = [];

  table.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
    const rowSeats = [...tr.querySelectorAll('[id^="checkseat"]')];
    if (!rowSeats.length) return;
    // 該排真正中心用「所有座位含售出」計算，run 的置中程度以此為準
    const nums   = rowSeats.map(getNum).filter(Boolean);
    const center = nums.length ? (Math.min(...nums) + Math.max(...nums)) / 2 : 0;

    const avail = rowSeats.filter(el => availIds.has(el.id))
                          .sort((a, b) => getNum(a) - getNum(b));
    let run = [];
    const flush = () => {
      if (run.length >= need) {
        // 從這段連續空位中取「最靠排中心」的 need 連座
        let best = null;
        for (let i = 0; i + need <= run.length; i++) {
          const slice = run.slice(i, i + need);
          const mid   = (getNum(slice[0]) + getNum(slice[need - 1])) / 2;
          const dist  = Math.abs(mid - center);
          if (!best || dist < best.dist) best = { slice, dist };
        }
        runs.push({ seats: best.slice, dist: best.dist, row: rowIdx });
      }
      run = [];
    };
    avail.forEach(el => {
      if (run.length && getNum(el) !== getNum(run[run.length - 1]) + 1) flush();
      run.push(el);
    });
    flush();
  });

  if (!runs.length) return null;
  runs.sort((a, b) => {
    const fa = a.row < pRows ? 0 : 1;
    const fb = b.row < pRows ? 0 : 1;
    if (fa !== fb) return fa - fb;          // 前排區優先
    if (a.dist !== b.dist) return a.dist - b.dist; // 靠中心優先
    return a.row - b.row;                   // 最後比排數
  });
  return runs[0].seats;
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
  setTimeout(()=>{ location.href=zonesUrl; }, 300);
}

function handleFixed() {
  if (stepDone.FIXED) return;

  // ── INIT ──
  if (fixedPhase==='INIT') {
    chrome.storage.local.get(['triedZones','currentZone','zonePosition'], d=>{
      _triedZones     = (d.triedZones||[]).map(z=>z.toUpperCase());
      _currentZonePos = d.zonePosition || 'CENTER';
      const zoneName  = d.currentZone || new URLSearchParams(location.search).get('zone') || '?';
      const dir       = bestSeatDir(_currentZonePos);
      setO(`進入 Zone: ${zoneName}（${_currentZonePos}），最佳方向：${dir}`, '#88aaff');
      log(`進入 Zone: ${zoneName}，位置：${_currentZonePos}，座位方向：${dir}`, 'info');
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
    if (!table) {
      // 座位表遲遲不出現多半是 Zone 全滿頁，不能無限等 → 視同無座位處理
      noTableTicks++;
      if (noTableTicks >= 5) {
        noTableTicks = 0;
        reloadOrSwitchZone('座位表未出現');
      } else {
        setO(`等待座位圖...(${noTableTicks}/5)`, '#88aaff');
      }
      return;
    }
    noTableTicks = 0;

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
        const alreadySelected = document.querySelectorAll('input[id^="hid-checkseat"]').length;
        if (alreadySelected > 0) {
          fixedPhase = 'CONFIRM';
          log(`無更多可用座位，已選 ${alreadySelected} 張，直接結帳`, 'warn');
          setO(`已選 ${alreadySelected} 張，前往結帳...`, '#4cff91');
        } else {
          reloadOrSwitchZone('無可用座位');
        }
      }
      return;
    }
    fixedRetry = 0; // 有偵測到座位則重置連續計數

    // 多張票：優先鎖定同排相鄰連座，找不到才退回散座邏輯。
    // 計畫中的座位若被搶走（不在 available）就剔除並重新規劃。
    plannedGroup = plannedGroup.filter(id => available.some(el => el.id === id));
    const need = seatCount - selected.length;
    if (need >= 2 && plannedGroup.length < need) {
      const group  = findAdjacentRun(available, need, settings.priorityRows);
      plannedGroup = group ? group.map(el => el.id) : [];
      if (plannedGroup.length)
        log(`鎖定同排 ${need} 連座：${plannedGroup.join(', ')}`, 'info');
    }
    if (plannedGroup.length) {
      const planned = available.filter(el => plannedGroup.includes(el.id));
      if (planned.length) available = planned;
    }

    // 依排數優先 + 方向排序（自動依 zone 位置決定最佳方向）
    available = sortSeats(available, bestSeatDir(_currentZonePos), settings.priorityRows??5);

    const seat   = available[0];
    const seatId = seat.id || seat.dataset?.seat || '?';
    triedSeatIds.add(seat.id);

    humanClick(seat);   // 模擬真人滑鼠點擊
    closeModal();       // 關閉可能出現的自訂 modal

    setO(`點擊座位 ${seatId}（${selected.length+1}/${seatCount}）...`, '#88aaff');

    fixedPhase='WAIT_RESULT';
    // 輪詢確認結果：每 150ms 檢查一次、最多 1.5 秒。
    // 開賣時伺服器回應慢，固定短等待會把「其實已搶到」誤判成失敗
    let resultChecks = 0;
    const checkSeatResult = ()=>{
      if (!isRunning) return;
      const seatEl = document.getElementById(seat.id);
      // 成功判斷：座位 class 變為 seatchecked（綠色勾勾）
      // 或對應的 hidden input 已建立
      const success = seatEl?.classList.contains('seatchecked') ||
                      !!document.getElementById(`hid-${seat.id}`);

      if (!success && ++resultChecks < 10) {
        setTimeout(checkSeatResult, 150);
        return;
      }

      if (!success) {
        seatClickFails++;
        log(`座位 ${seatId} 搶佔失敗，嘗試下一個... (${seatClickFails}/10)`, 'warn');
        setO(`✗ ${seatId} 失敗，換下一個... (${seatClickFails}/10)`, '#ffcc44');

        if (seatClickFails >= 10) {
          seatClickFails = 0;
          const alreadySelected = document.querySelectorAll('input[id^="hid-checkseat"]').length;
          if (alreadySelected > 0) {
            fixedPhase = 'CONFIRM';
            log(`連續失敗，已選 ${alreadySelected} 張，直接結帳`, 'warn');
            setO(`已選 ${alreadySelected} 張，前往結帳...`, '#4cff91');
          } else {
            reloadOrSwitchZone('點擊失敗 10 次');
          }
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
    };
    setTimeout(checkSeatResult, 150);
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
    notify('🎉 搶到票了！', `已選定 ${selected.length} 個座位，請盡快完成結帳付款`, true);
    successChime();
    humanClick(confirmBtn);
    clearTimeout(tickerInterval); tickerInterval=null;
    chrome.storage.local.set({isRunning:false});
    chrome.runtime.sendMessage({type:'STEP',step:'DONE'}).catch(()=>{});
    setTimeout(()=>rmO(), 6000);
    confirmWatchdog(confirmBtn); // 8 秒後若仍停在座位頁，判斷確認是否失敗
  }
}

// 確認按鈕的看門狗：正常流程點下確認會跳轉去結帳（content script 隨之結束，
// 這個 timer 自然消失）。8 秒後還停在 fixed.php 就代表有狀況：
//   座位 hidden input 還在 → 點擊可能沒生效，補點一次（最多重試 2 次）
//   座位被清空            → 確認時被別人搶走，透過 storage 自動重啟搶位
function confirmWatchdog(confirmBtn, attempt = 0) {
  setTimeout(() => {
    if (getPage() !== 'FIXED') return; // 已跳轉，正常收工
    chrome.storage.local.get('currentStep', d => {
      if (d.currentStep !== 'DONE') return; // 使用者已手動停止或流程已重啟
      const still = document.querySelectorAll('input[id^="hid-checkseat"]').length;
      if (still > 0) {
        if (attempt < 2) {
          log(`確認後 8 秒仍在座位頁，補點確認按鈕（${attempt + 1}/2）`, 'warn');
          closeModal();
          humanClick(confirmBtn);
          confirmWatchdog(confirmBtn, attempt + 1);
        } else {
          notify('⚠️ 確認可能未成功', '已點擊確認但頁面未跳轉，請手動檢查分頁', true);
          alarm();
        }
        return;
      }
      // 座位被清空 → 確認失敗；設回 isRunning 讓 onChanged 監聽器重啟整個流程
      log('確認失敗：座位在送出時被搶走，自動重新搶位', 'warn');
      notify('⚠️ 確認失敗', '座位在確認時被搶走，已自動重新搶位', true);
      alarm();
      chrome.storage.local.set({ isRunning: true, currentStep: 'FIXED' });
    });
  }, 8000);
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
