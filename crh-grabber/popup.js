/* City Recital Hall 搶票助手 — popup 設定介面 */

const CFG_KEY = 'crhConfig';
const STATE_KEY = 'crhState';

const DEFAULTS = {
  enabled: false,
  targetUrls: [],
  autoDiscover: true,
  discoverKeyword: 'GMMTV',
  onsaleTime: '2026-08-06T10:00:00+10:00',
  tierPriority: ['S', 'A', 'B', 'General'],
  allowLowerTier: true,
  priceTypeKeyword: '',
  quantity: 2,
  minQuantity: 1,
  preferBestAvailable: true,
  autoAddToCart: true,
  autoGoCheckout: true,
  retryIntervalMs: 900,
  retryJitterMs: 400,
  maxRetryMinutes: 25,
  sound: true,
};

const $ = (id) => document.getElementById(id);
const CHECKS = ['autoDiscover', 'allowLowerTier', 'preferBestAvailable',
                'autoAddToCart', 'autoGoCheckout', 'sound'];
const TEXTS  = ['discoverKeyword', 'onsaleTime', 'priceTypeKeyword'];
const NUMS   = ['quantity', 'minQuantity', 'retryIntervalMs'];

function load() {
  chrome.storage.local.get([CFG_KEY, STATE_KEY], (r) => {
    const c = { ...DEFAULTS, ...(r[CFG_KEY] || {}) };
    $('targetUrls').value = (c.targetUrls || []).join('\n');
    $('tierPriority').value = (c.tierPriority || []).join(', ');
    CHECKS.forEach((k) => { $(k).checked = !!c[k]; });
    TEXTS.forEach((k)  => { $(k).value = c[k] ?? ''; });
    NUMS.forEach((k)   => { $(k).value = c[k] ?? ''; });

    const s = r[STATE_KEY] || {};
    if (s.running) $('title').classList.add('on');
    $('status').textContent = s.grabbed
      ? '已搶到票 — 請完成結帳'
      : s.running ? `執行中（第 ${s.attempts || 0} 次嘗試）` : '待命中';
  });
}

function save(then) {
  chrome.storage.local.get(CFG_KEY, (r) => {
    const c = { ...DEFAULTS, ...(r[CFG_KEY] || {}) };
    c.targetUrls = $('targetUrls').value.split('\n').map((s) => s.trim()).filter(Boolean);
    c.tierPriority = $('tierPriority').value.split(',').map((s) => s.trim()).filter(Boolean);
    CHECKS.forEach((k) => { c[k] = $(k).checked; });
    TEXTS.forEach((k)  => { c[k] = $(k).value.trim(); });
    NUMS.forEach((k)   => { c[k] = Number($(k).value) || DEFAULTS[k]; });

    chrome.storage.local.set({ [CFG_KEY]: c }, () => {
      sendToTab({ type: 'cfg-updated' });
      $('status').textContent = '設定已儲存';
      then && then(c);
    });
  });
}

function sendToTab(msg, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, msg, (res) => {
      void chrome.runtime.lastError; // 分頁不在售票站時會沒有接收端，正常
      cb && cb(res);
    });
  });
}

$('save').onclick = () => save();

$('start').onclick = () => save((c) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url || '' : '';
    const onSite = /tickets\.cityrecitalhall\.com|queue-it\.net/.test(url);
    if (onSite) {
      sendToTab({ type: 'start' }, () => { $('title').classList.add('on'); $('status').textContent = '已啟動'; });
    } else {
      // 不在售票站就先開起來，content script 載入後會自己接手
      const target = c.targetUrls[0] || 'https://tickets.cityrecitalhall.com/events/';
      chrome.storage.local.set({ [STATE_KEY]: { running: true, grabbed: false, attempts: 0, startedAt: Date.now() } },
        () => chrome.tabs.create({ url: target }));
    }
  });
});

$('stop').onclick = () => {
  chrome.storage.local.set({ [STATE_KEY]: { running: false, grabbed: false, attempts: 0, startedAt: 0 } });
  sendToTab({ type: 'stop' });
  $('title').classList.remove('on');
  $('status').textContent = '已停止';
};

load();
