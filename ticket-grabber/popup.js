// popup.js
const $ = id => document.getElementById(id);

// ── 頁面偵測（根據 URL 判斷步驟）────────────────────────────
function detectStep(url) {
  if (!url) return 'CONCERT';
  if (url.includes('fixed.php'))           return 'FIXED';
  if (url.includes('zones.php'))           return 'ZONES';
  if (url.includes('verify_condition'))    return 'VERIFY';
  if (url.includes('verify.php'))          return 'PASSPORT';
  if (url.includes('thaiticketmajor.com')) return 'CONCERT';
  return 'CONCERT';
}

function stepLabel(step) {
  return { CONCERT:'選場次', VERIFY:'條款', PASSPORT:'填證件', CAPTCHA:'等待驗證', ZONES:'Zone', FIXED:'選座', DONE:'完成！', '':'-' }[step] || step || '-';
}

// ── 初始化 ────────────────────────────────────────────────
async function init() {
  const data = await chrome.storage.local.get([
    'targetDate','targetTicket','targetZone',
    'seatCount','seatDirection','priorityRows',
    'autoRefresh','interval','passportId','passportCountry',
    'isRunning','clickCount','currentStep'
  ]);
  if (data.targetDate)     $('targetDate').value     = data.targetDate;
  if (data.targetTicket)   $('targetTicket').value   = data.targetTicket;
  if (data.targetZone)     $('targetZone').value      = data.targetZone;
  if (data.seatCount)      $('seatCount').value       = data.seatCount;
  if (data.priorityRows != null) $('priorityRows').value = data.priorityRows;
  if (data.autoRefresh)    $('autoRefresh').checked   = data.autoRefresh;
  if (data.interval)       $('intervalInput').value   = data.interval;
  if (data.passportId)      $('passportId').value       = data.passportId;
  if (data.passportCountry) $('passportCountry').value  = data.passportCountry;

  updateUI(data.isRunning || false, data.clickCount || 0, data.currentStep || '');
  updatePageHint();
}

// ── 自動儲存（任何欄位變動即存）─────────────────────────────
async function save() {
  const rawZone = $('targetZone').value.trim();
  const zoneKeywords = rawZone
    ? rawZone.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
    : [];
  await chrome.storage.local.set({
    targetDate:    $('targetDate').value.trim(),
    targetTicket:  $('targetTicket').value.trim(),
    targetZone:    $('targetZone').value.trim(),
    zoneKeywords,
    seatCount:     parseInt($('seatCount').value)  || 1,
    priorityRows:  parseInt($('priorityRows').value) ?? 5,
    autoRefresh:   $('autoRefresh').checked,
    interval:      parseInt($('intervalInput').value) || 500,
    passportId:      $('passportId').value.trim(),
    passportCountry: $('passportCountry').value.trim(),
  });
}

// 所有輸入欄位變更時自動儲存
['targetDate','targetTicket','targetZone','seatCount',
 'priorityRows','intervalInput','autoRefresh','passportId','passportCountry'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input',  () => save());
  el.addEventListener('change', () => save());
});

// ── 偵測目前頁面並更新提示 ────────────────────────────────
async function updatePageHint() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const step = detectStep(tab?.url || '');
  const labels = { CONCERT:'演唱會頁', VERIFY:'條款頁', PASSPORT:'證件驗證', ZONES:'Zone 選擇', FIXED:'座位選擇', DONE:'完成頁' };
  $('pageTag').textContent = labels[step] || '未知頁面';
}

// ── 取得目前欄位設定 ──────────────────────────────────────
function getSettings() {
  const rawZone = $('targetZone').value.trim();
  return {
    targetDate:    $('targetDate').value.trim(),
    targetTicket:  $('targetTicket').value.trim(),
    zoneKeywords:  rawZone ? rawZone.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [],
    seatCount:     parseInt($('seatCount').value)  || 1,
    priorityRows:  parseInt($('priorityRows').value) ?? 5,
    autoRefresh:   $('autoRefresh').checked,
    interval:      parseInt($('intervalInput').value) || 500,
    passportId:      $('passportId').value.trim(),
    passportCountry: $('passportCountry').value.trim(),
  };
}

// ── 啟動 ──────────────────────────────────────────────────
$('startBtn').addEventListener('click', async () => {
  await save();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const startStep = detectStep(tab?.url || '');

  // 根據目前頁面決定哪些步驟已完成
  const stepOrder = ['CONCERT', 'VERIFY', 'ZONES', 'FIXED'];
  const startIdx  = stepOrder.indexOf(startStep);
  const initialDone = {};
  stepOrder.forEach((s, i) => { if (i < startIdx) initialDone[s] = true; });

  await chrome.storage.local.set({
    isRunning: true, clickCount: 0,
    currentStep: startStep,
    triedZones: [], zonesPageUrl: ''
  });

  const cfg = getSettings();
  chrome.tabs.sendMessage(tab.id, { action: 'START', settings: cfg, initialDone }).catch(() => {});
  updateUI(true, 0, startStep);
  addLog(`從「${stepLabel(startStep)}」啟動搶票！`, 'success');
});

// ── 停止 ──────────────────────────────────────────────────
$('stopBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ isRunning: false, currentStep: '' });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'STOP' }).catch(() => {});
  updateUI(false);
  addLog('已停止', 'warn');
});

// ── UI 更新 ───────────────────────────────────────────────
function updateUI(running, clicks = 0, step = '') {
  $('statusDot').classList.toggle('active', running);
  $('statusText').textContent = running ? '偵測中...' : '未啟動';
  $('startWrap').style.display = running ? 'none'  : 'block';
  $('stopWrap').style.display  = running ? 'block' : 'none';
  $('clickCount').textContent  = `點擊 ${clicks} 次`;
  $('stepBadge').textContent   = stepLabel(step);
}

// ── 訊息監聽 ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'LOG')         addLog(msg.text, msg.level);
  if (msg.type === 'CLICK_COUNT') $('clickCount').textContent = `點擊 ${msg.count} 次`;
  if (msg.type === 'STEP')
    chrome.storage.local.get(['clickCount'], d =>
      updateUI(true, d.clickCount || 0, msg.step));
});

// ── 定時同步狀態 ──────────────────────────────────────────
setInterval(async () => {
  const d = await chrome.storage.local.get(['isRunning', 'clickCount', 'currentStep']);
  updateUI(d.isRunning || false, d.clickCount || 0, d.currentStep || '');
  updatePageHint();
}, 1500);

// ── Log ───────────────────────────────────────────────────
function addLog(text, level = 'info') {
  const box = $('logBox');
  const t   = new Date().toLocaleTimeString('th', { hour12: false });
  const d   = document.createElement('div');
  d.className  = `log-entry ${level}`;
  d.textContent = `[${t}] ${text}`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 80) box.removeChild(box.firstChild);
}

init();
