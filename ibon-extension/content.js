(() => {
  const frameUrl = location.href;
  const isIbonPage = frameUrl.includes('ibon.com.tw');
  const isTopFrame = window === window.top;

  console.log(`[ibon搶票] frame=${isTopFrame ? 'TOP' : 'sub'} url=${frameUrl.substring(0, 80)}`);

  if (!isIbonPage) return;

  // ════════════════════════════════════════════════════
  // 共用工具
  // ════════════════════════════════════════════════════
  let lastClickTime = 0; // 所有 frame 共用，防止重複點擊

  // 遞迴搜尋所有 shadow root（Angular ViewEncapsulation.ShadowDom 時需要）
  function queryShadowAll(selector, root) {
    root = root || document;
    const results = Array.from(root.querySelectorAll(selector));
    const allEls = root.querySelectorAll('*');
    for (let i = 0; i < allEls.length; i++) {
      const sr = allEls[i].shadowRoot;
      if (sr) {
        const inner = queryShadowAll(selector, sr);
        for (let j = 0; j < inner.length; j++) results.push(inner[j]);
      }
    }
    return results;
  }

  function realClick(el, label) {
    const now = Date.now();
    if (now - lastClickTime < 3000) {
      console.log(`[ibon搶票][${isTopFrame ? 'TOP' : 'sub'}] ⏸ 點擊冷卻中，跳過: ${label}`);
      return false;
    }
    lastClickTime = now;
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) {}
    el.click();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    console.log(`[ibon搶票][${isTopFrame ? 'TOP' : 'sub'}] ✅ 點擊: ${label}`);
    return true;
  }

  function textIncludes(el, kw) {
    const txt = (el.textContent || el.innerText || '').replace(/\s/g, '');
    return txt.includes(kw.replace(/\s/g, ''));
  }

  function extractPrice(el) {
    const m = (el.textContent || '').match(/[\d,]{3,}/g);
    if (!m) return 0;
    return Math.max(...m.map(s => parseInt(s.replace(/,/g, '')) || 0));
  }

  // XPath fallback
  function findByXPath(text) {
    try {
      const xp = `//*[contains(normalize-space(text()),"${text}") and not(@disabled)]`;
      const r = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      const nodes = [];
      let n;
      while ((n = r.iterateNext())) {
        if (n.offsetParent !== null) nodes.push(n);
      }
      for (const node of nodes) {
        let el = node;
        while (el && el !== document.body) {
          if (el.tagName === 'BUTTON' || el.tagName === 'A') return el;
          el = el.parentElement;
        }
        return node;
      }
    } catch (_) {}
    return null;
  }

  // 用文字節點反查最近的可點擊祖先（處理 Angular 自訂元素）
  function findClickableByText(text, enabledOnly) {
    const results = [];
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.includes(text)) continue;
        let el = n.parentElement;
        if (!el) continue;
        // 往上最多 6 層，找第一個「看起來可點擊」的祖先
        let clickable = null;
        let cur = el;
        for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
          const tag = (cur.tagName || '').toUpperCase();
          if (tag === 'BUTTON' || tag === 'A') { clickable = cur; break; }
          if (cur.getAttribute('role') === 'button') { clickable = cur; break; }
          if (cur.getAttribute('onclick')) { clickable = cur; break; }
          try {
            if (getComputedStyle(cur).cursor === 'pointer' && tag !== 'BODY' && tag !== 'HTML') {
              clickable = cur; break;
            }
          } catch (_) {}
          cur = cur.parentElement;
        }
        if (!clickable) clickable = el;
        if (enabledOnly && clickable.disabled) continue;
        if (!clickable.offsetParent) continue;
        if (isInInfoSection(clickable)) continue;
        if (!results.includes(clickable)) results.push(clickable);
      }
    } catch (_) {}
    return results;
  }

  // 判斷元素是否在「售票平台：ibon機台、線上購票」說明區（而非場次表格）
  // 只走 3 層，避免走到 page-level container（它的 textContent 包含整頁文字）
  function isInInfoSection(el) {
    let ancestor = el.parentElement;
    for (let i = 0; i < 3 && ancestor && ancestor !== document.body; i++) {
      const t = ancestor.textContent || '';
      if (t.includes('售票平台') && t.includes('機台')) return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  // 找場次按鈕（只在當前 document 找，不跨 iframe）
  function findEnabledSessionBtns() {
    // 1. 精確 class 匹配
    const byClass = Array.from(document.querySelectorAll('button.btn-buy:not([disabled]), a.btn-buy:not([disabled])'));
    if (byClass.length > 0) return byClass;

    // 2. btn-pink class 含購票文字
    const byPink = Array.from(document.querySelectorAll('button.btn-pink:not([disabled]), a.btn-pink:not([disabled])')).filter(b => {
      const t = (b.textContent || '').trim();
      return t.includes('線上購票') || t.includes('購票');
    });
    if (byPink.length > 0) return byPink;

    // 3. 任何有 btn class 的元素（div/span 也算）
    const byBtnClass = Array.from(document.querySelectorAll('[class*="btn"]:not([disabled])')).filter(el => {
      if (!el.offsetParent) return false;
      if (!(el.textContent || '').includes('線上購票')) return false;
      return !isInInfoSection(el);
    });
    if (byBtnClass.length > 0) return byBtnClass;

    // 4. role="button" 或任何可見元素含「線上購票」文字
    const byRole = Array.from(document.querySelectorAll(
      'button:not([disabled]), a:not([disabled]), [role="button"]:not([disabled]), div[onclick], span[onclick]'
    )).filter(el => {
      if (!el.offsetParent) return false;
      if (!(el.textContent || '').includes('線上購票')) return false;
      return !isInInfoSection(el);
    });
    if (byRole.length > 0) return byRole;

    // 5. 文字節點反查（div 按鈕 fallback）
    const byText = findClickableByText('線上購票', true);
    if (byText.length > 0) return byText;

    // 6. Shadow DOM 遞迴搜尋（Angular ViewEncapsulation.ShadowDom）
    return queryShadowAll('button.btn-buy:not([disabled]), a.btn-buy:not([disabled]), button.btn-pink:not([disabled])').filter(el => {
      if (!el.offsetParent) return false;
      return !isInInfoSection(el);
    });
  }

  function findAllSessionBtns() {
    const byClass = Array.from(document.querySelectorAll('button.btn-buy, a.btn-buy'));
    if (byClass.length > 0) return byClass;
    const byPink = Array.from(document.querySelectorAll('button.btn-pink, a.btn-pink')).filter(b =>
      (b.textContent || '').trim().includes('線上購票')
    );
    if (byPink.length > 0) return byPink;
    const byBtnClass = Array.from(document.querySelectorAll('[class*="btn"]')).filter(el => {
      if (!(el.textContent || '').includes('線上購票')) return false;
      return !isInInfoSection(el);
    });
    if (byBtnClass.length > 0) return byBtnClass;
    const byRole = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      if (!(el.textContent || '').includes('線上購票')) return false;
      return !isInInfoSection(el);
    });
    if (byRole.length > 0) return byRole;
    const byText = findClickableByText('線上購票', false);
    if (byText.length > 0) return byText;
    // Shadow DOM fallback
    return queryShadowAll('button.btn-buy, a.btn-buy, button.btn-pink').filter(el => !isInInfoSection(el));
  }

  // ════════════════════════════════════════════════════
  // SUB-FRAME 邏輯（iframe，專注點擊按鈕）
  // ════════════════════════════════════════════════════
  if (!isTopFrame) {
    let subActive = false;
    let subTimer = null;
    let subObs = null;
    let subCount = 0;

    function subTick() {
      subCount++;
      const enabled = findEnabledSessionBtns();
      if (enabled.length > 0) {
        console.log(`[ibon搶票][sub] 找到 ${enabled.length} 個可購場次`);
        const btn = enabled[0];
        const label = (btn.textContent || '').trim().substring(0, 20);
        if (realClick(btn, label)) {
          subStop(); // 點擊成功後停止，避免重複點擊
          chrome.runtime.sendMessage({ type: 'session_clicked', label });
        }
        return;
      }

      if (subCount % 50 === 0) {
        const all = findAllSessionBtns();
        console.log(`[ibon搶票][sub] 場次: enabled=${enabled.length} all=${all.length}`);
      }
    }

    function subStart() {
      if (subActive) return;
      subActive = true;
      subCount = 0;
      console.log('[ibon搶票][sub] 啟動');
      subTimer = setInterval(subTick, 200);

      // MutationObserver：disabled 解除時立刻點
      subObs = new MutationObserver(() => {
        if (!subActive) return;
        const enabled = findEnabledSessionBtns();
        if (enabled.length > 0) {
          const btn = enabled[0];
          const label = (btn.textContent || '').trim().substring(0, 20);
          if (realClick(btn, label)) {
            subStop();
            chrome.runtime.sendMessage({ type: 'session_clicked', label });
          }
        }
      });
      subObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }

    function subStop() {
      subActive = false;
      clearInterval(subTimer);
      if (subObs) { subObs.disconnect(); subObs = null; }
    }

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'start') subStart();
      if (msg.action === 'stop') subStop();
    });

    chrome.storage.local.get(['sniper_active'], (d) => {
      if (d.sniper_active) subStart();
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.sniper_active) {
        changes.sniper_active.newValue ? subStart() : subStop();
      }
    });

    return; // sub frame 到此結束
  }

  // ════════════════════════════════════════════════════
  // TOP FRAME 邏輯（主框架，負責 HUD + state）
  // ════════════════════════════════════════════════════
  const cfg = { zones: [], session: '', ticketType: '', qty: 1, priceStrategy: 'high' };
  let timer = null;
  let checkCount = 0;
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

  // 限速：相同訊息不重複更新 storage
  function hud(msg, type = 'info') {
    const c = { info: '#eee', ok: '#69f0ae', warn: '#ffd740', err: '#ff5252' }[type] || '#eee';
    const t = new Date().toLocaleTimeString('zh-TW');
    overlay.style.display = 'block';
    overlay.innerHTML = `<b style="color:#e91e63">🎟 ibon</b> <span style="color:#555;font-size:10px">${t}</span><br><span style="color:${c}">${msg}</span>`;
    if (msg !== lastHudMsg) {
      lastHudMsg = msg;
      chrome.storage.local.set({ sniper_log: msg });
    }
    console.log(`[ibon搶票][TOP] ${t} ${msg}`);
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

  // ── 找「立即購票」展開按鈕 ────────────────────────────
  function tryMainBtn() {
    const btn = document.querySelector('#BuyTicketsNow_btn button:not([disabled])');
    if (btn) {
      realClick(btn, '立即購票');
      return true;
    }
    return false;
  }

  // ── 場次按鈕（top frame 自己也試） ───────────────────
  function trySessionBtn() {
    const btns = findEnabledSessionBtns();
    if (btns.length === 0) return false;

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

    const rowEl = target.closest('[class*="flex-md-row"], .tr, li, tr') || target.parentElement;
    const label = (rowEl ? rowEl.textContent : '').replace(/\s+/g, ' ').trim().substring(0, 30);
    return realClick(target, label);
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
    if (available.length === 0) return false;

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
      realClick(target.btn, label);
      ticketPageHandled = true;
    }, 300);
    return true;
  }

  function tryNextBtn() {
    const kws = ['下一步', '確認', '結帳', '前往付款', 'Checkout', 'Next', '繼續'];
    for (const btn of document.querySelectorAll('button:not([disabled]), a.btn:not([disabled]), input[type="submit"]')) {
      if (!btn.offsetParent) continue;
      if (kws.some(k => (btn.textContent || btn.value || '').includes(k))) {
        return realClick(btn, btn.textContent.trim() || 'Next');
      }
    }
    return false;
  }

  // ── 主循環 ───────────────────────────────────────────
  function tick() {
    checkCount++;
    const isDetailsPage = /\/Details\//i.test(location.href);

    if (isDetailsPage) {
      const enabledBtns = findEnabledSessionBtns();
      const allBtns     = findAllSessionBtns();
      const mainBtn     = document.querySelector('#BuyTicketsNow_btn button:not([disabled])');

      if (checkCount % 20 === 0) {
        if (enabledBtns.length > 0) {
          hud(`🎯 找到 ${enabledBtns.length} 個可購場次，點擊中...`, 'warn');
        } else if (allBtns.length > 0) {
          const small = document.querySelector('small');
          const openInfo = small ? small.textContent.trim() : '';
          hud(`⏳ 找到 ${allBtns.length} 個場次（未開賣）${openInfo ? ' · ' + openInfo : ''}`);
        } else {
          const iframeSrcs = Array.from(document.querySelectorAll('iframe'))
            .map(f => (f.src || '(blank)').replace(/https?:\/\//, '').substring(0, 35))
            .join(', ');
          // 診斷：比對 extension isolated world vs 頁面 page context
          const extBtn  = document.querySelectorAll('button').length;
          const extNgTns = document.querySelectorAll('[class*="ng-tns"]').length;
          // 注入 <script> 到頁面 context，讓頁面本身的 JS 查詢
          if (!window.__ibonPageDiagDone) {
            window.__ibonPageDiagDone = true;
            document.addEventListener('__ibon_page_diag__', function h(e) {
              document.removeEventListener('__ibon_page_diag__', h);
              console.log('[ibon搶票][PAGE-CTX]', JSON.stringify(e.detail));
            });
            try {
              const s = document.createElement('script');
              s.textContent = `(function(){
                var r={btnPink:document.querySelectorAll('button.btn-pink,a.btn-pink').length,
                       btnBuy:document.querySelectorAll('button.btn-buy,a.btn-buy').length,
                       btn:document.querySelectorAll('button').length,
                       ngTns:document.querySelectorAll('[class*="ng-tns"]').length};
                document.dispatchEvent(new CustomEvent('__ibon_page_diag__',{detail:r}));
              })();`;
              (document.head||document.documentElement).appendChild(s);
              s.remove();
            } catch(e) { console.log('[ibon搶票] script inject err:', e.message); }
          }
          console.log('[ibon搶票][EXT-CTX] btn:', extBtn, 'ng-tns:', extNgTns);
          hud(`⏳ 等待... EXT:btn=${extBtn} ng-tns=${extNgTns} (check console for PAGE-CTX)`);
        }
      }

      if (enabledBtns.length > 0) { trySessionBtn(); return; }
      if (allBtns.length === 0 && checkCount % 5 === 0) tryMainBtn();
      if (allBtns.length > 0 && checkCount % 300 === 0) { hud('🔄 刷新...'); location.reload(); }

    } else {
      if (!ticketPageHandled) tryTicketSelect();
    }
  }

  // ── MutationObserver ─────────────────────────────────
  function startMutObs() {
    if (mutObs) return;
    let debounce = null;
    mutObs = new MutationObserver(() => {
      if (!isActive) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const enabled = findEnabledSessionBtns();
        if (enabled.length > 0) {
          hud(`🎯 DOM變化：發現 ${enabled.length} 個可購場次！`, 'warn');
          trySessionBtn();
        }
      }, 200);
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
      checkCount = 0;
      const info = [
        cfg.zones.length > 0 ? `票區：${cfg.zones.join('>')}` : (cfg.priceStrategy === 'high' ? '↑高價' : '↓低價') + '優先',
        cfg.session ? `場次：${cfg.session}` : '',
        `${cfg.qty}張`,
      ].filter(Boolean).join(' | ');
      hud(`🚀 啟動 — ${info}`, 'ok');
      startMutObs();
      timer = setInterval(tick, 100);
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
    if (msg.action === 'stop') stop();
    if (msg.type === 'session_clicked') hud(`✅ iframe 已點擊場次：${msg.label || ''}`, 'ok');
  });

  chrome.storage.local.get(['sniper_active'], (d) => {
    if (d.sniper_active) start();
  });
})();
