/* City Recital Hall 搶票助手 — popup 設定介面 */

const CFG_KEY = 'crhConfig';
const STATE_KEY = 'crhState';

const DEFAULTS = {
  enabled: false,
  targetUrls: [],
  autoDiscover: true,
  discoverKeyword: 'GMMTV',
  perfKeyword: '',
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
const TEXTS  = ['discoverKeyword', 'perfKeyword', 'onsaleTime', 'priceTypeKeyword'];
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
    showTabDiagnostic();
  });
}

// 「按了沒反應」幾乎都是因為當前分頁沒有 content script，
// 所以直接把這件事顯示出來，不要讓人猜
function showTabDiagnostic() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const el = $('tabinfo');
    if (!el || !tabs[0]) return;
    let host;
    try { host = new URL(tabs[0].url).hostname; } catch (_) { host = '(不明)'; }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'status' }, (res) => {
      void chrome.runtime.lastError;
      el.textContent = res
        ? `目前分頁：${host} — 外掛已就緒 ✓`
        : `目前分頁：${host} — 外掛在這頁沒有作用`;
      el.className = res ? 'tabinfo ok' : 'tabinfo bad';
    });
  });
}

function save(then) {
  chrome.storage.local.get(CFG_KEY, (r) => {
    const c = { ...DEFAULTS, ...(r[CFG_KEY] || {}) };
    c.targetUrls = $('targetUrls').value.split('\n').map((s) => s.trim()).filter(Boolean);
    c.tierPriority = $('tierPriority').value.split(',').map((s) => s.trim()).filter(Boolean);
    CHECKS.forEach((k) => { c[k] = $(k).checked; });
    TEXTS.forEach((k)  => { c[k] = $(k).value.trim(); });
    // 不能寫成 Number(v) || DEFAULTS[k]：minQuantity 填 0（＝一定要指定張數）
    // 會被當成 falsy 而被預設值蓋掉，這個選項就永遠設不起來
    NUMS.forEach((k) => {
      const n = Number($(k).value);
      c[k] = ($(k).value.trim() === '' || isNaN(n)) ? DEFAULTS[k] : n;
    });

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
    const tab = tabs[0];
    const url = tab ? tab.url || '' : '';
    const running = { running: true, grabbed: false, attempts: 0, startedAt: Date.now() };

    // content script 只跑在售票站 / 官網 / queue-it。
    // 其他頁面（新分頁、Google…）按開始不會有面板，必須講清楚。
    const hasScript = /(tickets|www)\.cityrecitalhall\.com|queue-it\.net/.test(url);
    if (!hasScript) {
      const target = c.targetUrls[0] || 'https://tickets.cityrecitalhall.com/events/';
      chrome.storage.local.set({ [STATE_KEY]: running }, () => {
        // 導向目前分頁而不是開新分頁：開新分頁會讓 popup 失焦關閉，
        // 使用者看不到任何回饋，會以為「按了沒反應」
        chrome.tabs.update(tab.id, { url: target }, () => {
          void chrome.runtime.lastError;
          $('status').textContent = '這頁沒有外掛，已帶你前往售票站';
        });
      });
      return;
    }

    chrome.storage.local.set({ [STATE_KEY]: running }, () => {
      sendToTab({ type: 'start' }, (res) => {
        $('title').classList.add('on');
        $('status').textContent = res
          ? '已啟動 — 請看頁面右下角的面板'
          : '頁面尚未載入完成，請重新整理該分頁後再按開始';
      });
    });
  });
});

$('stop').onclick = () => {
  chrome.storage.local.set({ [STATE_KEY]: { running: false, grabbed: false, attempts: 0, startedAt: 0 } });
  sendToTab({ type: 'stop' });
  $('title').classList.remove('on');
  $('status').textContent = '已停止';
};

load();
