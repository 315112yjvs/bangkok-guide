// popup.js — AllTicket 搶票助手
const $ = id => document.getElementById(id);

const STEP_LABEL = {
  IDLE:  '待機',
  BUY:   '等待開賣',
  CHECK: '查詢座位數',
  ZONE:  '選 Zone',
  SEAT:  '選座位中',
  BOOK:  '勾選 + 訂票',
  DONE:  '完成！',
};

async function init() {
  const d = await chrome.storage.local.get([
    'zoneKeywords', 'seatCount', 'autoRefresh', 'interval',
    'isRunning', 'seatsSelected', 'currentStep'
  ]);
  if (d.zoneKeywords?.length) $('zoneKeywords').value = d.zoneKeywords.join(', ');
  if (d.seatCount)   $('seatCount').value    = d.seatCount;
  if (d.autoRefresh) $('autoRefresh').checked = d.autoRefresh;
  if (d.interval)    $('intervalInput').value = d.interval;
  updateUI(d.isRunning || false, d.seatsSelected || 0, d.currentStep || '');
  updatePageHint();
}

async function save() {
  const raw = $('zoneKeywords').value.trim();
  const kws = raw ? raw.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [];
  await chrome.storage.local.set({
    zoneKeywords: kws,
    seatCount:    parseInt($('seatCount').value)   || 1,
    autoRefresh:  $('autoRefresh').checked,
    interval:     parseInt($('intervalInput').value) || 400,
  });
}

['zoneKeywords','seatCount','autoRefresh','intervalInput'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input',  () => save());
  el.addEventListener('change', () => save());
});

async function updatePageHint() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  const isAllTicket = url.includes('allticket.com');
  const tag = $('pageTag');
  tag.textContent = isAllTicket ? 'AllTicket 活動頁 ✓' : '請前往 allticket.com';
  tag.className   = isAllTicket ? 'page-tag ok' : 'page-tag err';
}

$('startBtn').addEventListener('click', async () => {
  await save();
  const d = await chrome.storage.local.get(['zoneKeywords','seatCount','autoRefresh','interval']);
  await chrome.storage.local.set({ isRunning: true, seatsSelected: 0, currentStep: 'BUY' });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, {
    action: 'START',
    settings: {
      zoneKeywords: d.zoneKeywords || [],
      seatCount:    d.seatCount    || 1,
      autoRefresh:  d.autoRefresh  || false,
      interval:     d.interval     || 400,
    }
  }).catch(() => {});

  updateUI(true, 0, 'BUY');
  addLog('搶票啟動！', 'success');
});

$('stopBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ isRunning: false, currentStep: '' });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'STOP' }).catch(() => {});
  updateUI(false);
  addLog('已停止', 'warn');
});

function updateUI(running, seats = 0, step = '') {
  $('statusDot').classList.toggle('active', running);
  $('statusText').textContent      = running ? '搶票中...' : '未啟動';
  $('startWrap').style.display     = running ? 'none'  : 'block';
  $('stopWrap').style.display      = running ? 'block' : 'none';
  $('seat-badge').textContent = `${seats} 張`;
  $('stepBadge').textContent  = STEP_LABEL[step] || step || '-';
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'LOG')   addLog(msg.text, msg.level);
  if (msg.type === 'SEATS') {
    $('seat-badge').textContent = `${msg.count} 張`;
    chrome.storage.local.set({ seatsSelected: msg.count });
  }
  if (msg.type === 'STEP') {
    chrome.storage.local.get(['seatsSelected'], d =>
      updateUI(msg.step !== 'DONE', d.seatsSelected || 0, msg.step));
    if (msg.step === 'DONE') addLog('搶票完成！請前往結帳', 'success');
  }
});

setInterval(async () => {
  const d = await chrome.storage.local.get(['isRunning', 'seatsSelected', 'currentStep']);
  updateUI(d.isRunning || false, d.seatsSelected || 0, d.currentStep || '');
  updatePageHint();
}, 1500);

function addLog(text, level = 'info') {
  const box = $('logBox');
  const t   = new Date().toLocaleTimeString('th', { hour12: false });
  const d   = document.createElement('div');
  d.className  = `log-entry ${level}`;
  d.textContent = `[${t}] ${text}`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 60) box.removeChild(box.firstChild);
}

init();
