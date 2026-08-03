/* ============================================================
 * City Recital Hall 搶票助手 — content script
 *
 * 售票系統：Tessitura TNEW (tickets.cityrecitalhall.com)
 * 防護層：Queue-it 候位室 + Imperva Incapsula 機器人偵測
 *
 * 設計原則
 *  1. 只操作真實分頁的 UI，不自己發 XHR 打 API（會被 Incapsula 擋）
 *  2. 進了 Queue-it 候位室就完全不動，重整＝失去排隊位置
 *  3. 走 ?z=0「最佳座位」純 HTML 表單，比畫布選位快非常多
 *  4. 停在結帳頁，絕不代填付款資料
 * ============================================================ */

(() => {
  'use strict';

  if (window.__crhGrabberLoaded) return;
  window.__crhGrabberLoaded = true;

  // ── 常數 ──────────────────────────────────────────────────
  const SITE = 'tickets.cityrecitalhall.com';
  const CFG_KEY = 'crhConfig';
  const STATE_KEY = 'crhState';

  const SEL = {
    // 最佳座位模式（?z=0）
    baForm:        '#tn-events-detail-best-available-form',
    zoneGroup:     'select.tn-zone-group-selector',
    zoneRadio:     'input.tn-ticket-selector__input-zone',
    soldOutZone:   '.tn-ticket-selector__sold-out-zone',
    ptContainer:   '.tn-ticket-selector__pricetype-container',
    ptRow:         '.tn-ticket-selector__pricetype',
    ptSelect:      'select.tn-ticket-selector__pricetype-select',
    ptFixedInput:  'input.tn-ticket-selector__fixed-amount-input',
    purchaseBtn:   '#tn-add-to-cart-button',
    modeChange:    '.tn-ticketing-mode-change__anchor',
    // 畫布選位模式（SYOS，備援）
    syosRoot:      '.tn-syos',
    syosScreenBtn: '.tn-syos-screen-button',
    syosSeat:      '.tn-syos-seat-map__seat',
    syosSeatBad:   'tn-syos-seat-map__seat--unavailable',
    syosAddCart:   '.tn-syos__btn-add-to-cart',
    syosBusy:      '.tn-syos-busy-indicator--spinning',
    // 通用
    loggedOut:     '.tn-utility-nav-account-section--logged-out',
    cartTimer:     '.tn-utility-nav-cart-timer__time',
    cartQty:       '.tn-utility-nav-cart-link__quantity-badge',
    cartCheckout:  '.tn-cart-buttons__primary-action',
    errorBox:      '.tn-form-error-message-container, .tn-alert-message, .alert-danger',
  };

  const DEFAULTS = {
    enabled: false,
    // 目標場次網址，一行一個。例：https://tickets.cityrecitalhall.com/7999/8001
    targetUrls: [],
    // 還沒開賣、拿不到網址時，用關鍵字在 /events/ 自動找
    autoDiscover: true,
    discoverKeyword: 'GMMTV',
    // 開賣時間（ISO 8601，含時區）。雪梨 9/19 這場是 2026-08-06 10:00 AEST
    onsaleTime: '2026-08-06T10:00:00+10:00',
    // 票區優先順序，逗號分隔，比對票區名稱
    tierPriority: ['S', 'A', 'B', 'General'],
    allowLowerTier: true,
    // 票種關鍵字（留空＝用第一個可選的票種，通常是 Standard）
    priceTypeKeyword: '',
    quantity: 2,
    minQuantity: 1,           // 搶不到指定張數時，最少可接受幾張（0＝一定要指定張數）
    preferBestAvailable: true, // 走 ?z=0
    autoAddToCart: true,
    autoGoCheckout: true,      // 只導到結帳頁，不代刷卡
    retryIntervalMs: 900,
    retryJitterMs: 400,
    maxRetryMinutes: 25,
    sound: true,
  };

  let cfg = { ...DEFAULTS };
  let state = { running: false, grabbed: false, attempts: 0, startedAt: 0 };
  let serverOffsetMs = 0;   // serverNow - localNow
  let busy = false;
  let stopped = false;
  let logLines = [];

  // ── 小工具 ────────────────────────────────────────────────
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = () => cfg.retryIntervalMs + Math.floor(Math.random() * cfg.retryJitterMs);
  const now = () => Date.now() + serverOffsetMs;
  const txt = (el) => (el ? (el.innerText || el.textContent || '').trim() : '');

  function log(msg, kind = 'info') {
    const t = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    logLines.unshift({ t, msg, kind });
    logLines = logLines.slice(0, 60);
    renderLog();
    console.log(`[CRH搶票 ${t}] ${msg}`);
  }

  function notify(title, body, urgent = false) {
    try {
      chrome.runtime.sendMessage({ type: 'notify', title, body, urgent });
    } catch (_) { /* service worker 可能剛好睡著，忽略 */ }
    if (urgent && cfg.sound) beep();
  }

  let audioCtx = null;
  function beep(times = 3) {
    if (!cfg.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880 + i * 220;
        const t0 = audioCtx.currentTime + i * 0.22;
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
        osc.start(t0); osc.stop(t0 + 0.2);
      }
    } catch (_) {}
  }

  // 觸發框架看得懂的事件（TNEW 綁 jQuery change / input）
  function fire(el, types = ['input', 'change']) {
    types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
  }
  function realClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  async function waitFor(fn, timeoutMs = 8000, stepMs = 120) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (stopped) return null;
      const v = fn();
      if (v) return v;
      await sleep(stepMs);
    }
    return null;
  }

  // ── 伺服器時間校正 ────────────────────────────────────────
  // 本機時鐘差個幾秒就會早開或晚開，用同源 HEAD 的 Date header 校正。
  // 只在啟動時和每 5 分鐘做一次，請求量極低，不會踩到 Incapsula。
  async function syncServerTime() {
    if (location.hostname !== SITE) return;
    try {
      const t0 = Date.now();
      const res = await fetch(location.origin + '/', {
        method: 'HEAD', cache: 'no-store', credentials: 'include',
      });
      const t1 = Date.now();
      const dateHdr = res.headers.get('date');
      if (!dateHdr) return;
      const serverMs = new Date(dateHdr).getTime();
      // Date header 只有秒精度，補半個 RTT 再加 500ms 期望值
      serverOffsetMs = serverMs + 500 + (t1 - t0) / 2 - t1;
      log(`伺服器時間校正完成，本機誤差 ${Math.round(serverOffsetMs)}ms`);
    } catch (e) {
      log('時間校正失敗，改用本機時鐘', 'warn');
    }
  }

  // ── 頁面判斷 ──────────────────────────────────────────────
  function pageType() {
    if (/queue-it\.net$/i.test(location.hostname)) return 'queue';
    if (location.hostname !== SITE) return 'other';
    const p = location.pathname.replace(/\/+$/, '');
    if (/^\/\d+\/\d+$/.test(p)) return 'performance';
    if (/^\/\d+$/.test(p)) return 'production';
    if (/^\/events/.test(p)) return 'events';
    if (/^\/cart/.test(p)) return 'cart';
    if (/^\/account\/login/.test(p)) return 'login';
    if (/^\/checkout|^\/order/.test(p)) return 'checkout';
    return 'other';
  }

  // 有些頁面被 Queue-it 攔截後仍在原網域，只是內容換掉了
  function looksLikeQueuePage() {
    if (/queue-it\.net$/i.test(location.hostname)) return true;
    if ($('#MainPart_lbUsersInLineAheadOfYou, #buttonConfirmRedirect, .qit-waitingroom')) return true;
    const t = document.body ? document.body.innerText.slice(0, 3000) : '';
    return /you are now in line|waiting room|your place in|virtual queue|線上排隊/i.test(t);
  }

  // ── 票區比對 ──────────────────────────────────────────────
  // 「S」「A」這種單字母票區不能用 substring 比，會亂中。
  // 先做 token 完全比對，再退回 substring。
  function zoneMatchScore(label, keyword) {
    const L = label.toLowerCase();
    const K = keyword.trim().toLowerCase();
    if (!K) return -1;
    const tokens = L.split(/[^a-z0-9一-鿿]+/).filter(Boolean);
    if (tokens.includes(K)) return 2;                       // 完全吻合的字詞
    if (K.length >= 3 && L.includes(K)) return 1;           // 較長關鍵字才允許 substring
    if (tokens.some((t) => t === K + 'reserve' || t === K + 'tier')) return 2;
    return 0;
  }

  function pickZones() {
    const radios = $$(SEL.zoneRadio).filter((r) => !r.disabled);
    const zones = radios.map((r) => {
      const label = txt(r.closest('label')) || txt(r.parentElement);
      const avail = parseInt(r.getAttribute('data-tn-zone-available-count') || '0', 10);
      return { el: r, label, avail, zoneId: r.getAttribute('data-zone-id') };
    }).filter((z) => z.avail > 0);

    const ranked = [];
    cfg.tierPriority.forEach((kw, i) => {
      zones.forEach((z) => {
        const s = zoneMatchScore(z.label, kw);
        if (s > 0 && !ranked.find((x) => x.zoneId === z.zoneId)) {
          ranked.push({ ...z, prio: i, score: s });
        }
      });
    });
    ranked.sort((a, b) => (a.prio - b.prio) || (b.score - a.score));

    if (cfg.allowLowerTier) {
      // 沒對到關鍵字的票區排在後面當備胎
      zones.forEach((z) => {
        if (!ranked.find((x) => x.zoneId === z.zoneId)) {
          ranked.push({ ...z, prio: 999, score: 0 });
        }
      });
    }
    return ranked;
  }

  // ── 最佳座位模式（主要路徑）────────────────────────────────
  async function tryBestAvailable() {
    const form = $(SEL.baForm);
    if (!form) return { ok: false, reason: 'no-form' };

    // 票區群組下拉（有些場次會分群，先確保顯示全部）
    const grp = $(SEL.zoneGroup);
    if (grp && grp.value === '' && grp.options.length > 1) {
      grp.selectedIndex = 1;
      fire(grp);
      await sleep(250);
    }

    const zones = pickZones();
    if (!zones.length) {
      const soldOut = $$(SEL.soldOutZone).map(txt).join('、');
      return { ok: false, reason: 'no-zone', detail: soldOut };
    }

    for (const z of zones) {
      if (stopped) return { ok: false, reason: 'stopped' };
      log(`嘗試票區：${z.label}（剩 ${z.avail}）`);

      z.el.checked = true;
      realClick(z.el);
      fire(z.el, ['change']);

      const box = await waitFor(
        () => $$(SEL.ptContainer).find(
          (c) => c.getAttribute('data-zone-id') === z.zoneId && c.offsetParent !== null,
        ),
        3000,
      );
      if (!box) { log(`票區 ${z.label} 沒展開票種，換下一個`, 'warn'); continue; }

      const maxQty = Math.min(
        cfg.quantity,
        z.avail,
        parseInt(box.getAttribute('data-tn-max-quantity') || '99', 10) || 99,
      );
      if (maxQty < 1) continue;

      const got = setQuantity(box, maxQty);
      if (!got) { log(`票區 ${z.label} 找不到票種欄位`, 'warn'); continue; }
      if (got < maxQty) log(`只能選 ${got} 張（原本要 ${cfg.quantity} 張）`, 'warn');

      const floor = cfg.minQuantity > 0 ? cfg.minQuantity : cfg.quantity;
      if (got < floor) {
        log(`${got} 張低於可接受下限 ${floor} 張，換下一個票區`, 'warn');
        clearQuantity(box);
        continue;
      }

      if (!cfg.autoAddToCart) {
        log(`已選好「${z.label}」${got} 張 — 自動加入購物車已關閉，請手動按 Purchase`, 'good');
        return { ok: true, manual: true };
      }

      const btn = await waitFor(
        () => {
          const b = $(SEL.purchaseBtn);
          return b && !b.classList.contains('disabled') && b.getAttribute('aria-disabled') !== 'true' ? b : null;
        },
        3000,
      );
      if (!btn) { log('Purchase 按鈕沒解鎖，換下一個票區', 'warn'); clearQuantity(box); continue; }

      log(`送出：${z.label} × ${got}`, 'good');
      realClick(btn);
      return { ok: true, zone: z.label, qty: got };
    }
    return { ok: false, reason: 'all-zones-failed' };
  }

  function priceTypeRows(box) {
    const rows = $$(SEL.ptRow, box);
    if (!cfg.priceTypeKeyword) return rows;
    const kw = cfg.priceTypeKeyword.toLowerCase();
    const matched = rows.filter((r) => {
      const d = (r.getAttribute('data-tn-pricetype-description') || txt(r)).toLowerCase();
      return d.includes(kw);
    });
    return matched.length ? matched : rows;
  }

  // 回傳實際設定成功的張數
  function setQuantity(box, want) {
    let remaining = want;
    for (const row of priceTypeRows(box)) {
      if (remaining <= 0) break;
      const sel = $(SEL.ptSelect, row);
      if (sel) {
        const vals = Array.from(sel.options)
          .map((o) => parseInt(o.value, 10))
          .filter((n) => !isNaN(n));
        const best = vals.filter((v) => v <= remaining).sort((a, b) => b - a)[0];
        if (best && best > 0) {
          sel.value = String(best);
          fire(sel);
          remaining -= best;
        }
        continue;
      }
      const inp = $(SEL.ptFixedInput, row);
      if (inp) {
        const max = parseInt(inp.max || '99', 10) || 99;
        const n = Math.min(remaining, max);
        if (n > 0) {
          inp.value = String(n);
          fire(inp);
          remaining -= n;
        }
      }
    }
    return want - remaining;
  }

  function clearQuantity(box) {
    $$(SEL.ptSelect, box).forEach((s) => { s.value = '0'; fire(s); });
    $$(SEL.ptFixedInput, box).forEach((i) => { i.value = '0'; fire(i); });
  }

  // ── 畫布選位模式（備援）────────────────────────────────────
  async function trySyos() {
    if (!$(SEL.syosRoot)) return { ok: false, reason: 'no-syos' };
    log('走畫布選位模式（較慢，建議改用最佳座位）', 'warn');

    const screens = $$(SEL.syosScreenBtn).filter((b) => !b.classList.contains('disabled'));
    if (!screens.length) return { ok: false, reason: 'no-screen' };

    const ranked = [];
    cfg.tierPriority.forEach((kw, i) => {
      screens.forEach((b) => {
        if (zoneMatchScore(txt(b), kw) > 0 && !ranked.includes(b)) {
          b.__prio = i; ranked.push(b);
        }
      });
    });
    if (cfg.allowLowerTier) screens.forEach((b) => { if (!ranked.includes(b)) { b.__prio = 999; ranked.push(b); } });
    ranked.sort((a, b) => a.__prio - b.__prio);

    for (const btn of ranked) {
      if (stopped) return { ok: false, reason: 'stopped' };
      log(`嘗試區域：${txt(btn).replace(/\s+/g, ' ')}`);
      realClick(btn);

      await waitFor(() => !$(SEL.syosBusy), 8000);
      const seats = await waitFor(() => {
        const s = $$(SEL.syosSeat).filter((e) => !e.classList.contains(SEL.syosSeatBad));
        return s.length ? s : null;
      }, 8000);
      if (!seats) { log('此區沒有可選座位', 'warn'); await backToScreens(); continue; }

      const take = Math.min(cfg.quantity, seats.length);
      for (let i = 0; i < take; i++) {
        realClick(seats[i]);
        await sleep(180);
      }

      const add = await waitFor(() => {
        const b = $(SEL.syosAddCart);
        return b && !b.classList.contains('disabled') ? b : null;
      }, 4000);
      if (!add) { log('Add to Cart 沒解鎖', 'warn'); await backToScreens(); continue; }

      log(`送出：${take} 個座位`, 'good');
      realClick(add);
      return { ok: true, qty: take };
    }
    return { ok: false, reason: 'all-screens-failed' };
  }

  async function backToScreens() {
    const back = $('.tn-syos-btn-view-screens');
    if (back) { realClick(back); await sleep(600); }
  }

  // ── 場次頁主流程 ──────────────────────────────────────────
  async function runPerformance() {
    if (busy) return;
    busy = true;
    try {
      // 未登入就先擋下 — 沒登入的話加入購物車也留不住
      if ($(SEL.loggedOut)) {
        log('偵測到「未登入」！請先登入再開始，否則搶到也會被踢掉', 'bad');
        notify('請先登入', 'City Recital Hall 帳號尚未登入，搶票前請先登入', true);
      }

      // 切到最佳座位模式（純 HTML 表單，比畫布快）
      // 注意：SYOS 頁的切換連結指向 ?z=0，而 ?z=0 頁的連結指回 SYOS。
      // 只在「目前不是 z=0」時才跳，否則兩頁會互相導來導去。
      if (cfg.preferBestAvailable && !$(SEL.baForm) && !location.search.includes('z=0')) {
        const link = $(SEL.modeChange);
        const href = link ? link.getAttribute('href') : null;
        const target = href && href.includes('z=0')
          ? new URL(href, location.origin).href
          : location.pathname + '?z=0';
        log('切換到最佳座位模式（?z=0）');
        location.href = target;
        return;
      }

      const result = $(SEL.baForm) ? await tryBestAvailable() : await trySyos();

      if (result.ok && !result.manual) {
        state.grabbed = true;
        saveState();
        log('已送出加入購物車，等待伺服器回應…', 'good');
        // 頁面會導向購物車；沒導的話下面的錯誤檢查會接手
        await sleep(2500);
        checkFormError();
        return;
      }
      if (result.ok && result.manual) return;

      if (result.reason === 'no-form' || result.reason === 'no-syos') {
        log('尚未開賣或頁面還沒渲染，等待中…');
      } else if (result.reason === 'no-zone') {
        log(`目前沒有可選票區${result.detail ? '（售完：' + result.detail + '）' : ''}`, 'warn');
      } else {
        log(`本輪未成功（${result.reason}）`, 'warn');
      }
      scheduleRetry();
    } finally {
      busy = false;
    }
  }

  function checkFormError() {
    const box = $(SEL.errorBox);
    const msg = txt(box);
    if (msg) {
      log(`系統訊息：${msg}`, 'bad');
      state.grabbed = false;
      saveState();
      scheduleRetry();
    }
  }

  // ── 重試排程 ──────────────────────────────────────────────
  let retryTimer = null;
  function scheduleRetry() {
    if (stopped || !state.running || state.grabbed) return;
    const elapsedMin = (Date.now() - state.startedAt) / 60000;
    if (elapsedMin > cfg.maxRetryMinutes) {
      log(`已重試 ${cfg.maxRetryMinutes} 分鐘，自動停止`, 'warn');
      notify('搶票已停止', `重試逾 ${cfg.maxRetryMinutes} 分鐘仍未成功`, true);
      stop();
      return;
    }
    state.attempts++;
    saveState();
    const wait = jitter();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      // 表單還在就原地重試（不重整，比較不會觸發 Incapsula / Queue-it）
      if ($(SEL.baForm) || $(SEL.syosRoot)) runPerformance();
      else location.reload();
    }, wait);
    setPanelStatus(`第 ${state.attempts} 次嘗試，${(wait / 1000).toFixed(1)}s 後再試`);
  }

  // ── 開賣前等待 ────────────────────────────────────────────
  async function waitForOnsale() {
    const target = cfg.onsaleTime ? new Date(cfg.onsaleTime).getTime() : 0;
    if (!target) return;
    while (!stopped && state.running) {
      const left = target - now();
      if (left <= 0) { log('開賣時間到！', 'good'); return; }
      setPanelStatus(`距離開賣 ${fmtLeft(left)}`);
      // 剩 90 秒內轉為密集校時，避免時鐘飄移
      if (left < 90000 && left > 60000) await syncServerTime();
      await sleep(left > 5000 ? 1000 : 200);
    }
  }

  function fmtLeft(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? `${h}時` : '') + (h || m ? `${m}分` : '') + `${ss}秒`;
  }

  // ── 事件列表：自動找場次 ──────────────────────────────────
  async function runEventsDiscovery() {
    const kw = (cfg.discoverKeyword || '').trim().toLowerCase();
    if (!kw) { log('沒有設定關鍵字，無法自動搜尋', 'warn'); return; }

    const find = () => $$('a[href]')
      .map((a) => ({ a, href: a.getAttribute('href') || '' }))
      .filter((x) => /\/\d+(\/\d+)?(\?|$)/.test(x.href))
      .find((x) => {
        const card = x.a.closest('article, li, .tn-events-list-view__event, div') || x.a;
        return txt(card).toLowerCase().includes(kw);
      });

    const hit = await waitFor(find, 6000, 400);
    if (hit) {
      const url = new URL(hit.href, location.origin).href;
      log(`找到「${cfg.discoverKeyword}」場次：${url}`, 'good');
      notify('找到場次了', url, true);
      chrome.storage.local.get(CFG_KEY, (r) => {
        const c = { ...DEFAULTS, ...(r[CFG_KEY] || {}) };
        if (!c.targetUrls.includes(url)) c.targetUrls = [...c.targetUrls, url];
        chrome.storage.local.set({ [CFG_KEY]: c }, () => { location.href = url; });
      });
      return;
    }

    log(`列表上還沒出現「${cfg.discoverKeyword}」，${(jitter() / 1000).toFixed(1)}s 後重新整理`);
    setTimeout(() => { if (!stopped && state.running) location.reload(); }, Math.max(jitter(), 3000));
  }

  // ── 節目頁：挑場次 ────────────────────────────────────────
  async function runProduction() {
    const prodId = location.pathname.replace(/\/+$/, '').slice(1);
    const links = $$(`a[href*="/${prodId}/"]`);
    if (!links.length) { log('這個節目頁還沒列出可購買場次'); scheduleRetry(); return; }

    // 用目標網址裡指定的場次 ID 對；對不到就取第一個
    const wanted = cfg.targetUrls.map((u) => (u.match(/\/(\d+)\/(\d+)/) || [])[2]).filter(Boolean);
    const hit = links.find((a) => wanted.some((id) => a.getAttribute('href').includes('/' + id)))
             || links[0];
    log(`前往場次：${txt(hit).replace(/\s+/g, ' ').slice(0, 40)}`);
    location.href = new URL(hit.getAttribute('href'), location.origin).href;
  }

  // ── 購物車 ────────────────────────────────────────────────
  function runCart() {
    const qty = txt($(SEL.cartQty));
    const timer = txt($(SEL.cartTimer));
    if (qty && qty !== '0') {
      state.grabbed = true;
      state.running = false;
      saveState();
      log(`購物車已有 ${qty} 張票！保留時間 ${timer || '—'}`, 'good');
      notify('搶到票了！', `購物車 ${qty} 張，請盡快結帳（保留 ${timer || '有限時間'}）`, true);
      beep(6);
      setPanelStatus(`搶到 ${qty} 張，剩餘保留時間 ${timer || '—'}`);

      if (cfg.autoGoCheckout) {
        const btn = $(SEL.cartCheckout);
        if (btn) {
          log('自動前往結帳頁（付款資料需要你自己填）', 'good');
          setTimeout(() => realClick(btn), 900);
        }
      }
      // 持續顯示保留倒數
      setInterval(() => {
        const t = txt($(SEL.cartTimer));
        if (t) setPanelStatus(`已搶到票 — 保留剩餘 ${t}`);
      }, 1000);
    } else {
      log('購物車是空的 — 加入失敗或已逾時', 'bad');
      state.grabbed = false;
      saveState();
      if (state.running && cfg.targetUrls.length) {
        setTimeout(() => { location.href = cfg.targetUrls[0]; }, jitter());
      }
    }
  }

  // ── Queue-it 候位室 ───────────────────────────────────────
  function runQueue() {
    log('偵測到 Queue-it 候位室 — 已進入安全模式', 'warn');
    log('絕對不要重新整理或關掉這個分頁，會失去排隊位置！', 'bad');
    setPanelStatus('排隊中 — 請勿重整');
    notify('已進入排隊室', '請保持分頁開著，不要重整。輪到你時會通知你', false);

    let last = '';
    const tick = setInterval(() => {
      const ahead = txt($('#MainPart_lbUsersInLineAheadOfYou'));
      const wait  = txt($('#MainPart_lbWhichIsEquivalentTo'));
      const cur = [ahead, wait].filter(Boolean).join(' / ');
      if (cur && cur !== last) {
        last = cur;
        setPanelStatus(`排隊中：前面還有 ${ahead || '?'} 人 ${wait ? '（' + wait + '）' : ''}`);
      }
      // 排隊完成時 Queue-it 會自己導回售票站，content script 會在那邊接手
      if (!looksLikeQueuePage()) {
        clearInterval(tick);
        log('排隊結束，準備進場！', 'good');
        notify('輪到你了！', '已離開排隊室，開始搶票', true);
      }
    }, 1000);

    // 分頁被切走也要提醒使用者輪到了
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) log('分頁回到前景，仍在排隊中');
    });
  }

  // ── 面板 UI ───────────────────────────────────────────────
  let panel, panelStatus, panelLog;
  function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'crh-grabber-panel';
    panel.innerHTML = `
      <style>
        #crh-grabber-panel{position:fixed;right:16px;bottom:16px;width:320px;z-index:2147483647;
          font:12px/1.5 -apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;color:#e8eaf0;
          background:#141a2b;border:1px solid #2c3555;border-radius:12px;
          box-shadow:0 12px 40px rgba(0,0,0,.45);overflow:hidden}
        #crh-grabber-panel .crh-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;
          background:linear-gradient(135deg,#3a2a6b,#1d2547);font-weight:700;font-size:13px}
        #crh-grabber-panel .crh-dot{width:8px;height:8px;border-radius:50%;background:#5a6480}
        #crh-grabber-panel.on .crh-dot{background:#38d39f;box-shadow:0 0 8px #38d39f}
        #crh-grabber-panel .crh-min{margin-left:auto;cursor:pointer;opacity:.7;padding:0 4px}
        #crh-grabber-panel .crh-bd{padding:10px 12px}
        #crh-grabber-panel .crh-st{background:#1d2540;border-radius:8px;padding:8px 10px;margin-bottom:8px;
          font-weight:600;color:#9fd3ff;word-break:break-all}
        #crh-grabber-panel .crh-btns{display:flex;gap:6px;margin-bottom:8px}
        #crh-grabber-panel button{flex:1;padding:7px 0;border:0;border-radius:7px;cursor:pointer;
          font-weight:700;font-size:12px;font-family:inherit}
        #crh-grabber-panel .crh-go{background:#38d39f;color:#0b1220}
        #crh-grabber-panel .crh-stop{background:#3a4260;color:#e8eaf0}
        #crh-grabber-panel .crh-log{max-height:190px;overflow:auto;font-size:11px}
        #crh-grabber-panel .crh-log div{padding:2px 0;border-bottom:1px solid #222b45;word-break:break-all}
        #crh-grabber-panel .crh-log .t{color:#616c8c;margin-right:5px}
        #crh-grabber-panel .good{color:#38d39f}
        #crh-grabber-panel .warn{color:#ffc861}
        #crh-grabber-panel .bad{color:#ff7a7a}
        #crh-grabber-panel.mini .crh-bd{display:none}
      </style>
      <div class="crh-hd"><span class="crh-dot"></span>CRH 搶票助手<span class="crh-min">—</span></div>
      <div class="crh-bd">
        <div class="crh-st">待命中</div>
        <div class="crh-btns">
          <button class="crh-go">開始</button>
          <button class="crh-stop">停止</button>
        </div>
        <div class="crh-log"></div>
      </div>`;
    document.documentElement.appendChild(panel);
    panelStatus = $('.crh-st', panel);
    panelLog = $('.crh-log', panel);
    $('.crh-min', panel).onclick = () => panel.classList.toggle('mini');
    $('.crh-go', panel).onclick = () => start();
    $('.crh-stop', panel).onclick = () => stop();
  }

  function setPanelStatus(s) { if (panelStatus) panelStatus.textContent = s; }
  function renderLog() {
    if (!panelLog) return;
    panelLog.innerHTML = logLines
      .map((l) => `<div class="${l.kind}"><span class="t">${l.t}</span>${escapeHtml(l.msg)}</div>`)
      .join('');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ── 啟動 / 停止 ───────────────────────────────────────────
  function saveState() { chrome.storage.local.set({ [STATE_KEY]: state }); }

  async function start() {
    if (state.running) return;
    stopped = false;
    state.running = true;
    state.grabbed = false;
    state.attempts = 0;
    state.startedAt = Date.now();
    saveState();
    panel && panel.classList.add('on');
    beep(1); // 這聲同時解鎖 AudioContext，之後才叫得出提示音
    log('開始執行', 'good');
    await route(true);
  }

  function stop() {
    stopped = true;
    state.running = false;
    saveState();
    clearTimeout(retryTimer);
    panel && panel.classList.remove('on');
    setPanelStatus('已停止');
    log('已停止', 'warn');
  }

  // ── 路由 ──────────────────────────────────────────────────
  async function route(manualStart = false) {
    const type = looksLikeQueuePage() ? 'queue' : pageType();

    if (type === 'queue') { runQueue(); return; }
    if (!state.running && !manualStart) {
      setPanelStatus('待命中（按「開始」啟動）');
      return;
    }

    if (type === 'login') {
      log('這是登入頁 — 請自己登入，外掛不會碰你的帳密', 'warn');
      setPanelStatus('等待登入');
      return;
    }
    if (type === 'cart' || type === 'checkout') { runCart(); return; }

    await syncServerTime();
    await waitForOnsale();
    if (stopped || !state.running) return;

    if (type === 'performance') { await runPerformance(); return; }
    if (type === 'production')  { await runProduction();  return; }
    if (type === 'events')      { await runEventsDiscovery(); return; }

    // 不在票務頁：有目標網址就直接過去（若已在該網址就別再跳，會無限重整）
    const first = cfg.targetUrls[0];
    if (first && !location.href.startsWith(first.split('?')[0])) {
      log('前往目標場次');
      location.href = first;
    } else if (first) {
      log('已在目標網址但頁面無法辨識，稍後重試', 'warn');
      scheduleRetry();
    } else if (cfg.autoDiscover) {
      log('沒有目標網址，前往活動列表自動搜尋');
      location.href = 'https://' + SITE + '/events/';
    } else {
      log('請在設定裡填入場次網址', 'warn');
    }
  }

  // ── 訊息 ──────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg.type === 'start') { start(); reply({ ok: true }); }
    if (msg.type === 'stop')  { stop();  reply({ ok: true }); }
    if (msg.type === 'status') reply({ state, cfg, log: logLines.slice(0, 12) });
    if (msg.type === 'cfg-updated') {
      chrome.storage.local.get(CFG_KEY, (r) => { cfg = { ...DEFAULTS, ...(r[CFG_KEY] || {}) }; });
    }
    return true;
  });

  // ── 初始化 ────────────────────────────────────────────────
  chrome.storage.local.get([CFG_KEY, STATE_KEY], (r) => {
    cfg = { ...DEFAULTS, ...(r[CFG_KEY] || {}) };
    state = { ...state, ...(r[STATE_KEY] || {}) };
    buildPanel();
    if (state.running) panel.classList.add('on');
    log(`載入完成 — ${location.hostname}${location.pathname}`);
    if (state.grabbed && pageType() !== 'cart') log('上一輪已搶到票，記得完成結帳', 'good');
    route();
  });
})();
