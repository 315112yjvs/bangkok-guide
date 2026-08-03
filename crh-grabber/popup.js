/* City Recital Hall 搶票助手 — popup 設定介面 */

const CFG_KEY = 'crhConfig';
const STATE_KEY = 'crhState';

const DEFAULTS = {
  enabled: false,
  targetUrls: [],
  autoDiscover: true,
  discoverKeyword: '',
  perfKeyword: '',
  onsaleTime: '',
  tierPriority: [],
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
    updateOnsaleHint();
    updatePerfUI();

    const s = r[STATE_KEY] || {};
    if (s.running) $('title').classList.add('on');
    $('status').textContent = s.grabbed
      ? '已搶到票 — 請完成結帳'
      : s.running ? `執行中（第 ${s.attempts || 0} 次嘗試）` : '待命中';
    showTabDiagnostic();
  });
}

// 「按了沒反應」幾乎都是因為當前分頁沒有 content script，
// 所以直接把這件事顯示出來，不要讓人猜。
// 同一個 status 回應也帶回頁面上偵測到的場次清單，順路畫成按鈕。
function showTabDiagnostic() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const el = $('tabinfo');
    if (!el || !tabs[0]) { renderPerfChips([]); return; }
    let host;
    try { host = new URL(tabs[0].url).hostname; } catch (_) { host = '(不明)'; }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'status' }, (res) => {
      void chrome.runtime.lastError;
      el.textContent = res
        ? `目前分頁：${host} — 外掛已就緒 ✓`
        : `目前分頁：${host} — 外掛在這頁沒有作用`;
      el.className = res ? 'tabinfo ok' : 'tabinfo bad';
      renderPerfChips((res && res.performances) || []);
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

// ── 開賣時間即時解析 ─────────────────────────────────────────
// ISO 字串在窄欄位裡會被截斷，人眼沒法確認對不對；
// 這裡即時翻成本地時間＋倒數，填錯馬上看得出來
function updateOnsaleHint() {
  const el = $('onsaleHint');
  const v = $('onsaleTime').value.trim();
  if (!v) { el.textContent = '未設定 — 按開始會立刻執行，不倒數'; el.className = 'hint'; return; }
  const t = new Date(v).getTime();
  if (isNaN(t)) { el.textContent = '⚠ 格式無法解析，倒數不會生效'; el.className = 'hint bad'; return; }
  const local = new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const left = t - Date.now();
  if (left <= 0) { el.textContent = `＝ 你的時區 ${local}（已過，會立刻開搶）`; el.className = 'hint ok'; return; }
  const d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000);
  el.textContent = `＝ 你的時區 ${local}（剩 ${d ? d + '天' : ''}${h}時${m}分）`;
  el.className = 'hint ok';
}
$('onsaleTime').addEventListener('input', updateOnsaleHint);

// ── 場次選擇 chips ───────────────────────────────────────────
// 清單不是寫死的：開著售票頁時，content script 會回報頁面上實際列出的
// 所有場次（listPerformances），這裡把它們畫成按鈕。任何活動都適用。
// 點了直接寫入關鍵字＋目標網址並存檔，不怕忘記按儲存。
let perfCount = 0;   // 目前頁面偵測到幾場，決定「未指定」要不要紅字警告

function updatePerfUI() {
  const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, '');
  const v = norm($('perfKeyword').value);
  document.querySelectorAll('#perfChips .chip').forEach((chip) => {
    chip.classList.toggle('active', !!v && norm(chip.dataset.fill).includes(v));
  });
  const hint = $('perfHint');
  if (!v && perfCount > 1) {
    hint.textContent = `⚠ 偵測到 ${perfCount} 個場次但未指定 — 開跑後會停下來等你選`;
    hint.className = 'hint bad';
    $('perfKeyword').classList.add('field-warn');
  } else if (!v) {
    hint.textContent = '留空＝單一場次自動繼續；多場次活動會停下來等你選';
    hint.className = 'hint';
    $('perfKeyword').classList.remove('field-warn');
  } else {
    hint.textContent = '';
    hint.className = 'hint';
    $('perfKeyword').classList.remove('field-warn');
  }
}

function renderPerfChips(perfs) {
  perfCount = perfs.length;
  const box = $('perfChips');
  box.innerHTML = '';
  if (!perfs.length) {
    const d = document.createElement('div');
    d.className = 'chips-empty';
    d.textContent = '開啟活動的售票頁後，這裡會自動列出所有場次';
    box.appendChild(d);
    updatePerfUI();
    return;
  }
  perfs.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = p.label || p.url;
    b.title = p.label + (p.url ? '\n' + p.url : '');
    b.dataset.fill = p.label;
    b.onclick = () => {
      $('perfKeyword').value = p.label;
      if (p.url) {
        // 順手把這場的確切網址放到目標清單最前面，之後直達不用再找
        const lines = $('targetUrls').value.split('\n').map((s) => s.trim()).filter(Boolean);
        $('targetUrls').value = [p.url, ...lines.filter((u) => u !== p.url)].join('\n');
      }
      updatePerfUI();
      save(() => { $('status').textContent = `已選「${p.label}」並儲存`; });
    };
    box.appendChild(b);
  });
  updatePerfUI();
}

$('perfKeyword').addEventListener('input', updatePerfUI);

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
        const perfMissing = !$('perfKeyword').value.trim();
        $('status').textContent = res
          ? (perfMissing ? '已啟動，但⚠未指定場次 — 進站遇到多場次會停下來' : '已啟動 — 請看頁面右下角的面板')
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
