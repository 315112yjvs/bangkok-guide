'use strict';

const $ = id => document.getElementById(id);

// ── 頁面 badge ─────────────────────────────────────────
const PAGE_LABELS = {
  '/activity/detail/': { label: 'DETAIL', step: 's-detail' },
  '/activity/game/':   { label: 'GAME',   step: 's-detail' },
  '/ticket/area/':     { label: 'AREA',   step: 's-area'   },
  '/ticket/ticket/':   { label: 'TICKET', step: 's-ticket' },
};

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url  = tabs[0]?.url || '';
  const path = new URL(url).pathname;
  let label  = '—';
  let stepId = null;

  for (const [key, val] of Object.entries(PAGE_LABELS)) {
    if (path.includes(key)) { label = val.label; stepId = val.step; break; }
  }

  $('pageBadge').textContent = label;
  if (stepId) $(`${stepId}`)?.classList.add('active');
});

// ── 讀取設定 ────────────────────────────────────────────
chrome.storage.local.get(['tix_cfg', 'tix_running'], (d) => {
  const cfg = d.tix_cfg || {};
  $('session').value    = cfg.session    || '';
  $('areas').value      = (cfg.areas || []).join(',');
  $('qty').value        = String(cfg.qty || 1);
  $('interval').value   = String(cfg.interval || 300);
  $('ticketType').value = cfg.ticketType || '';
  $('saleTime').value   = cfg.saleTime   || '';
  $('verifyCode').value = cfg.verifyCode || '';

  if (d.tix_running) { setRunning(true); startCountdown(cfg.saleTime || ''); }
});

// ── 倒數計時（popup 開著時顯示）──────────────────────────
let countdownTimer = null;

function startCountdown(saleTime) {
  stopCountdown();
  if (!saleTime) return;
  function update() {
    const now  = new Date();
    const [h, m] = saleTime.split(':').map(Number);
    const sale = new Date(now);
    sale.setHours(h, m, 0, 0);
    if (sale <= now) sale.setDate(sale.getDate() + 1);
    const diff = Math.max(0, Math.round((sale - now) / 1000));
    if (diff > 20) {
      setStatus(`等待開賣 T-${diff}s`, 'warn', '⏳');
    } else if (diff > 0) {
      setStatus(`即將開賣 T-${diff}s`, 'ok', '🔥');
    } else {
      setStatus('搶票中...', 'ok', '🚀');
      stopCountdown();
    }
  }
  update();
  countdownTimer = setInterval(update, 1000);
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

// ── 自動存檔（欄位變動即存）──────────────────────────────
function readCfg() {
  return {
    session:    $('session').value.trim(),
    areas:      $('areas').value.split(',').map(s => s.trim()).filter(Boolean),
    qty:        parseInt($('qty').value)      || 1,
    interval:   parseInt($('interval').value) || 300,
    ticketType: $('ticketType').value.trim(),
    saleTime:   $('saleTime').value.trim(),
    verifyCode: $('verifyCode').value.trim(),
  };
}

['session', 'areas', 'qty', 'interval', 'ticketType', 'saleTime', 'verifyCode'].forEach(id => {
  $(`${id}`).addEventListener('input',  () => chrome.storage.local.set({ tix_cfg: readCfg() }));
  $(`${id}`).addEventListener('change', () => chrome.storage.local.set({ tix_cfg: readCfg() }));
});

// ── 開始 ────────────────────────────────────────────────
$('btnStart').addEventListener('click', () => {
  const cfg = readCfg();

  chrome.storage.local.set({ tix_cfg: cfg, tix_running: true  }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'START', cfg });
    });
    setRunning(true);
    if (cfg.saleTime) {
      startCountdown(cfg.saleTime);
    } else {
      setStatus('搶票中...', 'ok', '🚀');
    }
  });
});

// ── 停止 ────────────────────────────────────────────────
$('btnStop').addEventListener('click', () => {
  stopCountdown();
  chrome.storage.local.set({ tix_running: false }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP' });
    });
    setRunning(false);
    setStatus('已停止', '', '○');
  });
});

// ── UI helpers ───────────────────────────────────────────
function setRunning(on) {
  $('btnStart').classList.toggle('hide', on);
  $('btnStop').classList.toggle('show', on);
  $('pulse').classList.toggle('on', on);
}

function setStatus(msg, type, icon) {
  $('statusText').textContent  = msg;
  $('statusBar').className     = 'status-bar' + (type ? ' ' + type : '');
  if (icon) $('statusBar').querySelector('.status-icon').textContent = icon;
}
