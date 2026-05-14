(() => {
  const frameUrl = location.href;
  const isIbonPage = frameUrl.includes('ibon.com.tw');
  const isTopFrame = window === window.top;

  console.log(`[ibon搶票] frame=${isTopFrame ? 'TOP' : 'sub'} url=${frameUrl.substring(0, 80)}`);

  if (!isIbonPage) return;

  // ════════════════════════════════════════════════════
  // 共用工具
  // ════════════════════════════════════════════════════
  let lastClickTime = 0;

  function realClick(el, label) {
    const now = Date.now();
    if (now - lastClickTime < 3000) return false;
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

  function isInInfoSection(el) {
    let ancestor = el.parentElement;
    for (let i = 0; i < 3 && ancestor && ancestor !== document.body; i++) {
      const t = ancestor.textContent || '';
      if (t.includes('售票平台') && t.includes('機台')) return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  function queryShadowAll(selector, root) {
    root = root || document;
    const results = Array.from(root.querySelectorAll(selector));
    const allEls = root.querySelectorAll('*');
    for (let i = 0; i < allEls.length; i++) {
      const sr = allEls[i].shadowRoot;
      if (sr) queryShadowAll(selector, sr).forEach(e => results.push(e));
    }
    return results;
  }

  function findClickableByText(text, enabledOnly) {
    const results = [];
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.includes(text)) continue;
        let el = n.parentElement;
        if (!el) continue;
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

  function findEnabledSessionBtns() {
    const byClass = Array.from(document.querySelectorAll('button.btn-buy:not([disabled]), a.btn-buy:not([disabled])'));
    if (byClass.length > 0) return byClass;

    const byPink = Array.from(document.querySelectorAll('button.btn-pink:not([disabled]), a.btn-pink:not([disabled])')).filter(b =>
      (b.textContent || '').trim().includes('線上購票')
    );
    if (byPink.length > 0) return byPink;

    const byBtnClass = Array.from(document.querySelectorAll('[class*="btn"]:not([disabled])')).filter(el => {
      if (!el.offsetParent) return false;
      if (!(el.textContent || '').includes('線上購票')) return false;
      return !isInInfoSection(el);
    });
    if (byBtnClass.length > 0) return byBtnClass;

    const byRole = Array.from(document.querySelectorAll(
      'button:not([disabled]), a:not([disabled]), [role="button"]:not([disabled]), div[onclick], span[onclick]'
    )).filter(el => {
      if (!el.offsetParent) return false;
      if (!(el.textContent || '').includes('線上購票')) return false;
      return !isInInfoSection(el);
    });
    if (byRole.length > 0) return byRole;

    const byText = findClickableByText('線上購票', true);
    if (byText.length > 0) return byText;

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
    return queryShadowAll('button.btn-buy, a.btn-buy, button.btn-pink').filter(el => !isInInfoSection(el));
  }

  // ════════════════════════════════════════════════════
  // SUB-FRAME 邏輯
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
        const btn = enabled[0];
        const label = (btn.textContent || '').trim().substring(0, 20);
        if (realClick(btn, label)) {
          subStop();
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

    return;
  }

  // ════════════════════════════════════════════════════
  // TOP FRAME 邏輯
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

  // ── 頁面 context 橋接 ────────────────────────────────
  // Angular 的按鈕有時在 extension isolated world 看不到，
  // 注入 <script> 讓頁面自己的 JS 找按鈕並點擊
  function injectPageHelper() {
    if (window.__ibonHelperInjected) return;
    window.__ibonHelperInjected = true;
    const s = document.createElement('script');
    s.textContent = `(function(){
      if (window.__ibonPageHelper) return;
      window.__ibonPageHelper = true;
      var active = false;
      var lastClick = 0;

      function tryFind() {
        var sel = 'button.btn-pink:not([disabled]),button.btn-buy:not([disabled]),a.btn-pink:not([disabled]),a.btn-buy:not([disabled])';
        return Array.from(document.querySelectorAll(sel)).filter(function(b) {
          return b.offsetParent !== null && (b.textContent||'').includes('\\u7dda\\u4e0a\\u8cfc\\u7968');
        });
      }

      function tryClick() {
        if (Date.now() - lastClick < 2000) return false;
        var found = tryFind();
        if (!found.length) return false;
        lastClick = Date.now();
        var btn = found[0];
        try { btn.scrollIntoView({block:'center',behavior:'instant'}); } catch(_) {}
        btn.click();
        btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
        document.dispatchEvent(new CustomEvent('__ibon_clicked__',{detail:{text:(btn.textContent||'').trim()}}));
        return true;
      }

      function diag() {
        var found = tryFind();
        var r = {
          btnPink: document.querySelectorAll('button.btn-pink,a.btn-pink').length,
          btnBuy:  document.querySelectorAll('button.btn-buy,a.btn-buy').length,
          btn:     document.querySelectorAll('button').length,
          ngTns:   document.querySelectorAll('[class*="ng-tns"]').length,
          enabled: found.length
        };
        document.dispatchEvent(new CustomEvent('__ibon_diag__',{detail:r}));
      }

      var obs = new MutationObserver(function() {
        if (active) tryClick();
      });
      obs.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['disabled','class']});

      document.addEventListener('__ibon_cmd__', function(e) {
        var cmd = e.detail && e.detail.cmd;
        if (cmd === 'start') { active = true;  tryClick(); }
        if (cmd === 'stop')  { active = false; }
        if (cmd === 'click') { tryClick(); }
        if (cmd === 'diag')  { diag(); }
      });

      // 自動診斷：等 Angular 渲染後回報
      setTimeout(diag, 2500);
    })();`;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  }

  function pageCmd(cmd) {
    document.dispatchEvent(new CustomEvent('__ibon_cmd__', { detail: { cmd } }));
  }

  // 監聽頁面 context 回傳的事件
  document.addEventListener('__ibon_diag__', function(e) {
    const d = e.detail;
    console.log('[ibon搶票][PAGE-CTX]', JSON.stringify(d));
    if (!isActive) {
      // 自動診斷，只印 log
      hud(`PAGE: btn-pink=${d.btnPink}(可點:${d.enabled}) btn=${d.btn} ng-tns=${d.ngTns}`);
    }
  });

  document.addEventListener('__ibon_clicked__', function(e) {
    const text = (e.detail && e.detail.text) || '';
    console.log('[ibon搶票][PAGE-CTX] 點擊成功:', text);
    hud(`✅ 已點擊場次：${text}`, 'ok');
    // 點擊成功後停止 interval，等頁面跳轉
    clearInterval(timer); timer = null;
    stopMutObs();
  });

  // ── 找「立即購票」展開按鈕 ────────────────────────────
  function tryMainBtn() {
    const btn = document.querySelector('#BuyTicketsNow_btn button:not([disabled])');
    if (btn) { realClick(btn, '立即購票'); return true; }
    return false;
  }

  // ── 場次按鈕（隔離世界 fallback） ────────────────────
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

      if (checkCount % 5 === 0) {
        // 同時透過 page context 嘗試點擊（解決 isolated world 看不見 Angular 按鈕的問題）
        pageCmd('click');
      }

      if (checkCount % 20 === 0) {
        if (enabledBtns.length > 0) {
          hud(`🎯 找到 ${enabledBtns.length} 個可購場次，點擊中...`, 'warn');
        } else if (allBtns.length > 0) {
          const small = document.querySelector('small');
          const openInfo = small ? small.textContent.trim() : '';
          hud(`⏳ 找到 ${allBtns.length} 個場次（未開賣）${openInfo ? ' · ' + openInfo : ''}`);
        } else {
          const extBtn = document.querySelectorAll('button').length;
          const extNgTns = document.querySelectorAll('[class*="ng-tns"]').length;
          hud(`⏳ 等待... EXT:btn=${extBtn} ng-tns=${extNgTns}`);
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
      injectPageHelper();
      pageCmd('start');
      startMutObs();
      timer = setInterval(tick, 100);
    });
  }

  function stop() {
    isActive = false;
    ticketPageHandled = false;
    clearInterval(timer); timer = null;
    stopMutObs();
    pageCmd('stop');
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

  // 頁面 context 自動診斷（無需啟動監控即可看到 Angular 的 DOM 狀況）
  if (/\/Details\//i.test(location.href)) {
    injectPageHelper();
    // 等 Angular 渲染後，helper 會自動觸發 diag（2.5s）
  }
})();
