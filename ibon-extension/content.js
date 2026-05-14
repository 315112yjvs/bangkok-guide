(() => {
  if (!location.href.includes('ibon.com.tw')) return;

  const isTopFrame = window === window.top;
  const isDetails  = /\/Details\//i.test(location.href);

  // ════════════════════════════════════════════════════
  // 共用：點擊防抖 + 真實點擊
  // ════════════════════════════════════════════════════
  let lastClickTime = 0;

  function realClick(el, label) {
    const now = Date.now();
    if (now - lastClickTime < 2000) return false;
    lastClickTime = now;
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) {}
    el.click();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    console.log(`[ibon搶票] ✅ 點擊: ${label}`);
    return true;
  }

  // ════════════════════════════════════════════════════
  // 找「線上購票」可點擊元素（多種 API 確保找到）
  // ════════════════════════════════════════════════════
  function findBuyBtns(enabledOnly) {
    const seen = new Set();
    const results = [];

    function add(el) {
      if (!el || seen.has(el)) return;
      if (enabledOnly && el.disabled) return;
      const t = (el.textContent || '').trim();
      if (!t.includes('線上購票')) return;
      seen.add(el);
      results.push(el);
    }

    // 1. querySelectorAll — 精確 class（不加 offsetParent 限制，讓後面步驟判斷）
    const sel = enabledOnly
      ? 'button.btn-buy:not([disabled]),a.btn-buy:not([disabled]),button.btn-pink:not([disabled]),a.btn-pink:not([disabled])'
      : 'button.btn-buy,a.btn-buy,button.btn-pink,a.btn-pink';
    document.querySelectorAll(sel).forEach(add);

    // 2. getElementsByClassName（不同底層 API，有時 QSA 抓不到時仍可用）
    for (const cls of ['btn-buy', 'btn-pink']) {
      Array.from(document.getElementsByClassName(cls)).forEach(add);
    }

    // 3. 全 button/a 掃描，手動比對 className
    document.querySelectorAll('button,a').forEach(el => {
      const cls = el.className || '';
      if (cls.includes('btn-buy') || cls.includes('btn-pink')) add(el);
    });

    if (results.length) return results;

    // 4. 任何含「線上購票」文字的可見按鈕／連結（排除說明區）
    const allClickable = document.querySelectorAll(
      enabledOnly
        ? 'button:not([disabled]),a:not([disabled]),[role="button"]:not([disabled])'
        : 'button,a,[role="button"]'
    );
    for (const el of allClickable) {
      if (!el.offsetParent) continue;
      if (!(el.textContent || '').includes('線上購票')) continue;
      const parent = el.parentElement;
      if (parent && (parent.textContent || '').includes('ibon機台')) continue;
      add(el);
    }
    if (results.length) return results;

    // 5. TreeWalker 文字節點 → 反查可點擊祖先
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.includes('線上購票')) continue;
        let el = n.parentElement;
        if (!el) continue;
        if ((el.textContent || '').includes('ibon機台')) continue;
        let clickable = el;
        let cur = el;
        for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
          const tag = (cur.tagName || '').toUpperCase();
          if (tag === 'BUTTON' || tag === 'A') { clickable = cur; break; }
          if (cur.getAttribute('role') === 'button') { clickable = cur; break; }
          cur = cur.parentElement;
        }
        if (enabledOnly && clickable.disabled) continue;
        if (!clickable.offsetParent) continue;
        add(clickable);
      }
    } catch (_) {}

    return results;
  }

  // 每 15 秒印診斷，讓我們知道哪個 API 能看到按鈕
  let diagCount = 0;
  function diagLog() {
    diagCount++;
    if (diagCount % 100 !== 0) return;
    const d = {
      btn:      document.querySelectorAll('button').length,
      btnPink:  document.querySelectorAll('button.btn-pink,a.btn-pink').length,
      btnBuy:   document.querySelectorAll('button.btn-buy,a.btn-buy').length,
      gecPink:  document.getElementsByClassName('btn-pink').length,
      gecBuy:   document.getElementsByClassName('btn-buy').length,
      ngTns:    document.querySelectorAll('[class*="ng-tns"]').length,
      ngStar:   document.querySelectorAll('.ng-star-inserted').length,
      inHTML:   document.body.innerHTML.includes('btn-pink'),
    };
    console.log('[ibon搶票][DIAG]', JSON.stringify(d));
  }

  // ════════════════════════════════════════════════════
  // SUB-FRAME
  // ════════════════════════════════════════════════════
  if (!isTopFrame) {
    function subTryClick() {
      const btns = findBuyBtns(true);
      if (!btns.length) return false;
      const label = (btns[0].textContent || '').trim().substring(0, 20);
      if (realClick(btns[0], label)) {
        chrome.runtime.sendMessage({ type: 'session_clicked', label });
        return true;
      }
      return false;
    }

    let subActive = false;
    let subTimer = null;
    let subObs = null;

    function subStart() {
      if (subActive) return;
      subActive = true;
      subTryClick();
      subTimer = setInterval(subTryClick, 150);
      subObs = new MutationObserver(subTryClick);
      subObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }

    function subStop() {
      subActive = false;
      clearInterval(subTimer);
      if (subObs) { subObs.disconnect(); subObs = null; }
    }

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'start') subStart();
      if (msg.action === 'stop')  subStop();
    });
    chrome.storage.local.get(['sniper_active'], (d) => { if (d.sniper_active) subStart(); });
    chrome.storage.onChanged.addListener((c) => {
      if (c.sniper_active) c.sniper_active.newValue ? subStart() : subStop();
    });
    return;
  }

  // ════════════════════════════════════════════════════
  // TOP FRAME
  // ════════════════════════════════════════════════════
  const cfg = { zones: [], session: '', ticketType: '', qty: 1, priceStrategy: 'high' };
  let timer = null;
  let isActive = false;
  let ticketPageHandled = false;
  let mutObs = null;
  let lastHudMsg = '';

  // ── HUD ──────────────────────────────────────────────
  let overlay = document.getElementById('ibon-sniper-hud');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ibon-sniper-hud';
    overlay.style.cssText = `
      position:fixed;bottom:18px;right:18px;z-index:2147483647;
      background:rgba(15,15,15,0.93);color:#eee;
      padding:9px 13px;border-radius:10px;
      font:12px/1.7 -apple-system,sans-serif;
      max-width:300px;display:none;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
      border-left:3px solid #e91e63;
      pointer-events:none;
    `;
    document.body.appendChild(overlay);
  }

  function hud(msg, type = 'info') {
    const c = { info: '#eee', ok: '#69f0ae', warn: '#ffd740', err: '#ff5252' }[type] || '#eee';
    const t = new Date().toLocaleTimeString('zh-TW');
    overlay.style.display = 'block';
    overlay.innerHTML = `<b style="color:#e91e63">🎟 ibon</b> <span style="color:#555;font-size:10px">${t}</span><br><span style="color:${c}">${msg}</span>`;
    if (msg !== lastHudMsg) {
      lastHudMsg = msg;
      chrome.storage.local.set({ sniper_log: msg });
    }
  }

  function loadCfg(cb) {
    chrome.storage.local.get(
      ['sniper_zones', 'sniper_session', 'sniper_ticket_type', 'sniper_qty', 'sniper_price_strategy'],
      (d) => {
        cfg.zones         = d.sniper_zones || [];
        cfg.session       = d.sniper_session || '';
        cfg.ticketType    = d.sniper_ticket_type || '';
        cfg.qty           = parseInt(d.sniper_qty) || 1;
        cfg.priceStrategy = d.sniper_price_strategy || 'high';
        cb && cb();
      }
    );
  }

  function extractPrice(el) {
    const m = (el.textContent || '').match(/[\d,]{3,}/g);
    if (!m) return 0;
    return Math.max(...m.map(s => parseInt(s.replace(/,/g, '')) || 0));
  }

  function textIncludes(el, kw) {
    return (el.textContent || '').replace(/\s/g, '').includes(kw.replace(/\s/g, ''));
  }

  // ── 點場次按鈕 ───────────────────────────────────────
  function trySessionBtn() {
    const btns = findBuyBtns(true);
    if (!btns.length) return false;

    let target = btns[0];
    if (cfg.session) {
      for (const btn of btns) {
        let el = btn;
        for (let i = 0; i < 5; i++) {
          el = el.parentElement;
          if (!el) break;
          if ((el.textContent || '').replace(/\s/g, '').includes(cfg.session.replace(/\s/g, ''))) {
            target = btn; break;
          }
        }
        if (target !== btns[0]) break;
      }
    }

    const rowEl = target.closest('tr, li, [class*="row"]') || target.parentElement;
    const label = (rowEl ? rowEl.textContent : '').replace(/\s+/g, ' ').trim().substring(0, 30);
    if (realClick(target, label)) {
      hud(`✅ 已點擊：${label}`, 'ok');
      stop();
      return true;
    }
    return false;
  }

  // ── 票種選擇（購票頁） ───────────────────────────────
  function tryTicketSelect() {
    if (ticketPageHandled) return false;
    const actionKw = ['加入購物車', '選購', '購買', '確認', '立即選購'];
    const allRows = Array.from(document.querySelectorAll('tr, li'));
    const available = [];
    allRows.forEach(row => {
      const btn = Array.from(row.querySelectorAll('button:not([disabled]), a.btn:not([disabled])')).find(b =>
        actionKw.some(k => (b.textContent || '').includes(k))
      );
      if (!btn || !btn.offsetParent) return;
      available.push({ row, btn, text: row.textContent || '', price: extractPrice(row) });
    });
    if (!available.length) return false;

    let target = null;
    if (cfg.zones.length > 0) {
      for (const zone of cfg.zones) {
        const match = available.find(item => textIncludes(item.row, zone) && (!cfg.ticketType || textIncludes(item.row, cfg.ticketType)));
        if (match) { target = match; break; }
      }
    }
    if (!target) {
      let pool = cfg.ticketType ? available.filter(i => textIncludes(i.row, cfg.ticketType)) : available;
      if (!pool.length) pool = available;
      pool.sort((a, b) => cfg.priceStrategy === 'low' ? a.price - b.price : b.price - a.price);
      target = pool[0];
    }
    if (!target) return false;

    const qtyEl = target.row.querySelector('input[type="number"], select');
    if (qtyEl) {
      if (qtyEl.tagName === 'SELECT') {
        const opt = Array.from(qtyEl.options).find(o => o.value == cfg.qty || o.text.trim() == String(cfg.qty));
        if (opt) { qtyEl.value = opt.value; qtyEl.dispatchEvent(new Event('change', { bubbles: true })); }
      } else {
        qtyEl.value = cfg.qty;
        ['input', 'change'].forEach(e => qtyEl.dispatchEvent(new Event(e, { bubbles: true })));
      }
    }

    const label = target.text.replace(/\s+/g, ' ').trim().substring(0, 25);
    hud(`🎯 選票：${label}（$${target.price}）`, 'warn');
    setTimeout(() => {
      if (realClick(target.btn, label)) ticketPageHandled = true;
    }, 300);
    return true;
  }

  // ── 主 tick ──────────────────────────────────────────
  function tick() {
    diagLog();
    if (isDetails) {
      // 有按鈕就直接點，不管是什麼狀態
      if (trySessionBtn()) return;
      // 沒找到：更新 HUD 狀態
      const all = findBuyBtns(false);
      if (all.length > 0) {
        hud(`⏳ ${all.length} 個場次（未開賣）`);
      } else {
        hud('⏳ 待開賣...');
      }
    } else {
      if (!ticketPageHandled) tryTicketSelect();
    }
  }

  // ── MutationObserver（DOM 一變就立刻嘗試） ───────────
  function startMutObs() {
    if (mutObs) return;
    mutObs = new MutationObserver(() => {
      if (!isActive || !isDetails) return;
      trySessionBtn();
    });
    mutObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  }

  function stopMutObs() {
    if (mutObs) { mutObs.disconnect(); mutObs = null; }
  }

  // ── 啟動 / 停止 ──────────────────────────────────────
  function start() {
    if (isActive) return;
    loadCfg(() => {
      isActive = true;
      ticketPageHandled = false;
      const info = cfg.zones.length > 0
        ? `票區：${cfg.zones.join('>')} | ${cfg.qty}張`
        : `${cfg.priceStrategy === 'high' ? '↑高價' : '↓低價'} | ${cfg.qty}張`;
      hud(`🚀 就緒 — ${info}`, 'ok');
      startMutObs();
      // 立刻試一次
      tick();
      timer = setInterval(tick, 150);
    });
  }

  function stop() {
    isActive = false;
    ticketPageHandled = false;
    clearInterval(timer); timer = null;
    stopMutObs();
    overlay.style.display = 'none';
    chrome.storage.local.set({ sniper_active: false, sniper_log: '已停止' });
  }

  // ── 接收訊息 ─────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'start') start();
    if (msg.action === 'stop')  stop();
    if (msg.type === 'session_clicked') hud(`✅ 已點擊：${msg.label || ''}`, 'ok');
  });

  chrome.storage.local.get(['sniper_active'], (d) => {
    if (d.sniper_active) start();
  });
})();
