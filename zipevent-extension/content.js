(function () {
  'use strict';

  // ── 工具 ─────────────────────────────────────────────────────

  function setVal(el, value) {
    if (!el) return;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  }

  function tap(el) {
    if (!el) return;
    el.click();
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function toast(msg, color) {
    const old = document.getElementById('zipevent-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'zipevent-toast';
    el.style.cssText = `
      position:fixed;top:72px;right:16px;z-index:2147483647;
      background:${color || '#28a745'};color:#fff;
      padding:10px 16px;border-radius:8px;font-size:13px;
      font-family:-apple-system,sans-serif;
      box-shadow:0 2px 12px rgba(0,0,0,.25);max-width:270px;line-height:1.4;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ── 頁面偵測 ─────────────────────────────────────────────────

  const pagePath = window.location.pathname.toLowerCase();
  const isEventPage = pagePath.startsWith('/e/');
  const isBookPage  = pagePath.startsWith('/event/book/');
  const isOrderPage = pagePath.startsWith('/walkin/');
  if (!isEventPage && !isBookPage && !isOrderPage) return;

  // ── 活動頁：選票 + Buy Ticket ─────────────────────────────────

  function initEventPage(cfg) {
    const qty = parseInt(cfg.ticketQty) || 1;
    const label = qty > 1 ? `快速購票 ×${qty}` : '快速購票';

    const fab = document.createElement('div');
    fab.id = 'zipevent-fab';
    fab.textContent = '🎟️ ' + label;
    fab.style.cssText = `
      position:fixed;bottom:24px;right:20px;z-index:2147483647;
      background:linear-gradient(135deg,#007bff,#0056b3);
      color:#fff;padding:12px 22px;border-radius:25px;
      cursor:pointer;font-size:14px;font-weight:700;
      font-family:-apple-system,sans-serif;
      box-shadow:0 4px 16px rgba(0,123,255,.45);
      user-select:none;transition:transform .15s,box-shadow .15s;
    `;
    fab.addEventListener('mouseenter', () => {
      fab.style.transform = 'scale(1.05)';
      fab.style.boxShadow = '0 6px 20px rgba(0,123,255,.6)';
    });
    fab.addEventListener('mouseleave', () => {
      fab.style.transform = '';
      fab.style.boxShadow = '0 4px 16px rgba(0,123,255,.45)';
    });
    fab.addEventListener('click', () => triggerBuy(cfg));
    document.body.appendChild(fab);

    if (cfg.autoBuy) waitForPageAndBuy(cfg);
  }

  // autoBuy 入口：等頁面就緒後分流
  function waitForPageAndBuy(cfg, elapsed) {
    elapsed = elapsed || 0;
    if (isBookPage) {
      waitForTicketList(cfg, 0);
    } else if (document.querySelector('td.day.has-event, #event-round')) {
      selectCalendarAndBuy(cfg);
    } else if (document.querySelector('input.ticket_quantity')) {
      selectAndBuy(cfg);
    } else if (elapsed < 10000) {
      setTimeout(() => waitForPageAndBuy(cfg, elapsed + 300), 300);
    } else {
      toast('等待頁面超時，請手動操作', '#dc3545');
    }
  }

  // ── 純座位圖模式：點第一個可用 area 區塊 ─────────────────────

  function selectZoneMap(cfg) {
    const keywords = (cfg.zoneKeywords || '')
      .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

    // select_zone(GUID, zoneName, isSoldOut) — 第三參數 true = 售罄
    const areas = Array.from(document.querySelectorAll('area[href*="select_zone"]'))
      .filter(a => {
        const href = a.getAttribute('href') || '';
        // 解析第三參數判斷是否售罄
        const m = href.match(/select_zone\([^,]+,\s*'([^']*)',\s*(true|false)\)/);
        if (m && m[2] === 'true') return false; // 售罄跳過
        // 關鍵字比對（title 或 alt）
        const name = (a.title || a.alt || '').toLowerCase();
        if (keywords.length > 0 && !keywords.some(k => name.includes(k))) return false;
        return true;
      });

    if (areas.length === 0) {
      toast(keywords.length ? `找不到符合「${cfg.zoneKeywords}」的座位區` : '找不到可用座位區', '#dc3545');
      return;
    }

    toast('選擇座位區…', '#17a2b8');
    areas[0].click();

    // 等待票種清單出現後繼續
    setTimeout(() => waitForPageAndBuy(cfg, 0), 600);
  }

  // 統一入口
  function triggerBuy(cfg) {
    if (isBookPage) {
      // /event/book/ 頁面：完全忽略座位圖，直接等 Tickets 清單出現
      waitForTicketList(cfg, 0);
    } else if (document.querySelector('td.day.has-event, #event-round')) {
      selectCalendarAndBuy(cfg);
    } else if (document.querySelector('input.ticket_quantity')) {
      selectAndBuy(cfg);
    } else {
      toast('找不到票種或日曆，請確認頁面已載入', '#dc3545');
    }
  }

  // 等 Tickets 清單（input.ticket_quantity）出現後執行選票
  function waitForTicketList(cfg, elapsed) {
    if (document.querySelector('input.ticket_quantity')) {
      selectAndBuy(cfg);
    } else if (elapsed < 8000) {
      setTimeout(() => waitForTicketList(cfg, elapsed + 200), 200);
    } else {
      toast('等待票種清單超時，請手動操作', '#dc3545');
    }
  }

  // 等待購票按鈕可點擊（最多 3 秒，#btn-create-order 選票後才啟用）
  function waitForBuyBtn(elapsed) {
    const btn = document.getElementById('btn-get-ticket') ||
                document.getElementById('btn-create-order') ||
                document.querySelector('.btn-buy-ticket') ||
                document.getElementById('footer-buy-btn');
    if (btn && !btn.disabled) {
      btn.click();
    } else if (elapsed < 3000) {
      setTimeout(() => waitForBuyBtn(elapsed + 100), 100);
    } else {
      toast('找不到可點擊的購票按鈕，請手動點擊', '#dc3545');
    }
  }

  // ── 日曆模式：選第一個可用日期 → 第一個時段 → Next ───────────

  function selectCalendarAndBuy(cfg) {
    // 若有待完成訂單的 Cancel 按鈕，先關閉（搶新票）
    const cancelBtn = document.querySelector('.btn-cancel:not([style*="display:none"])');
    if (cancelBtn && /^cancel$/i.test(cancelBtn.textContent.trim())) {
      cancelBtn.click();
      setTimeout(() => selectCalendarAndBuy(cfg), 400);
      return;
    }

    // 若已有選取的日期就跳過，否則點第一個可用日期
    const hasSelectedDate = document.querySelector('td.day.active, td.active.has-event');
    if (!hasSelectedDate) {
      const firstDate =
        document.querySelector('td.day.has-event:not(.disabled):not(.old)') ||
        document.querySelector('td.day.has-event:not(.disabled)');
      if (!firstDate) {
        toast('找不到可選的活動日期', '#dc3545');
        return;
      }
      toast('選擇日期中…', '#17a2b8');
      firstDate.click();
    }

    // 等 #event-round 出現後處理時段
    waitForRound(cfg, 0);
  }

  function waitForRound(cfg, elapsed) {
    const container = document.getElementById('event-round');

    if (container) {
      const selectedRound = container.querySelector('.card.selected, .card.active');
      const firstRound    = container.querySelector(
        '.card:not(.disabled):not(.sold-out):not([class*="sold"])'
      ) || container.querySelector('.card');

      if (selectedRound || firstRound) {
        // 若時段尚未選取才點擊
        if (!selectedRound && firstRound) {
          toast('選擇時段中…', '#17a2b8');
          firstRound.click();
        }
        // 等畫面更新後點 Next
        setTimeout(() => {
          const nextBtn = findNextBtn();
          if (nextBtn) {
            nextBtn.click();
          } else {
            toast('找不到 Next 按鈕，請手動點擊', '#dc3545');
          }
        }, 350);
        return;
      }
    }

    if (elapsed < 6000) {
      setTimeout(() => waitForRound(cfg, elapsed + 200), 200);
    } else {
      toast('等待時段超時，請手動選擇', '#dc3545');
    }
  }

  // 根據設定選票種 + 調整張數 + 點 Buy Ticket
  function selectAndBuy(cfg) {
    const keywords = (cfg.zoneKeywords || '')
      .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const maxPrice = parseFloat(cfg.maxPrice) || Infinity;
    const targetQty = parseInt(cfg.ticketQty) || 1;

    // 取得所有不重複的票種 <tr>（有 input.ticket_quantity）
    const seen = new Set();
    const rows = Array.from(document.querySelectorAll('tr')).filter(row => {
      const inp = row.querySelector('input.ticket_quantity');
      if (!inp || seen.has(inp.id)) return false;
      seen.add(inp.id);
      return true;
    });

    if (rows.length === 0) {
      toast('找不到票種，請確認頁面已載入', '#dc3545');
      return;
    }

    let matched = 0;
    let totalDelay = 0;

    for (const row of rows) {
      const inp = row.querySelector('input.ticket_quantity');

      // 票名
      const namePara = row.querySelector('p');
      const ticketName = namePara ? namePara.innerText.trim().toLowerCase() : '';

      // 票價
      let price = 0;
      row.querySelectorAll('p').forEach(p => {
        const m = p.innerText.match(/[\d,]+\.?\d*/);
        if (m && !price) price = parseFloat(m[0].replace(/,/g, ''));
      });

      // 篩選：票價上限
      if (price > maxPrice) continue;

      // 篩選：有關鍵字才比對；沒有關鍵字 = 選第一個符合票價的票種即止
      if (keywords.length > 0) {
        if (!keywords.some(k => ticketName.includes(k))) continue;
      }

      const current = parseInt(inp.value) || 0;
      const diff    = targetQty - current;
      const group   = inp.closest('.ticket-quantity-group') || inp.parentElement;
      const addBtn  = group?.querySelector('.btn-add-quantity');
      const rmBtn   = group?.querySelector('.btn-remove-quantity');

      if (diff > 0 && addBtn) {
        for (let i = 0; i < diff; i++) {
          setTimeout(() => addBtn.click(), totalDelay + i * 60);
        }
        totalDelay += diff * 60;
      } else if (diff < 0 && rmBtn) {
        for (let i = 0; i < Math.abs(diff); i++) {
          setTimeout(() => rmBtn.click(), totalDelay + i * 60);
        }
        totalDelay += Math.abs(diff) * 60;
      }

      matched++;

      // 沒有關鍵字時只選第一個，找到就停
      if (keywords.length === 0) break;
    }

    if (matched === 0) {
      toast(
        keywords.length ? `找不到符合「${cfg.zoneKeywords}」的票種` : '找不到可購買的票種',
        '#dc3545'
      );
      return;
    }

    // 等按鈕點擊完成 + DOM 更新後，輪詢購票按鈕變可用
    setTimeout(() => waitForBuyBtn(0), totalDelay + 200);
  }

  // ── 結帳頁：自動填表 ──────────────────────────────────────────

  function initOrderPage(cfg) {
    if (!cfg.autoFill) return;
    toast('自動填表啟動中…', '#17a2b8');
    setTimeout(() => fillOrderForm(cfg), 900);
  }

  function fillOrderForm(cfg) {
    const done = [];

    // 1. 「รับทราบ」確認 radio（每題選第一個選項）
    const ackGroups = {};
    document.querySelectorAll('input[type="radio"][name*="custom_data"]').forEach(r => {
      const m = r.name.match(/custom_data\[(\d+)\]/);
      if (m && !ackGroups[m[1]]) ackGroups[m[1]] = r;
    });
    Object.values(ackGroups).forEach(r => {
      if (!r.checked) { tap(r); done.push('確認選項'); }
    });

    // 2. 發票
    const reqBill = document.getElementById('req_bill');
    if (cfg.billing?.enabled) {
      if (reqBill && !reqBill.checked) reqBill.click();
      setTimeout(() => fillBilling(cfg.billing, done), 400);
    } else {
      if (reqBill && reqBill.checked) reqBill.click();
    }

    // 3. 付款方式（12=QR / 24=信用卡）
    const pmEl = document.getElementById('payment_' + (cfg.paymentMethod || '12'));
    if (pmEl && !pmEl.checked) { tap(pmEl); done.push('付款方式'); }

    // 4. 同意條款
    const consent = document.getElementById('has_consent');
    if (consent && !consent.checked) { consent.click(); done.push('服務條款'); }

    const payConsent = document.getElementById('payment_consent');
    if (payConsent && !payConsent.checked) { payConsent.click(); done.push('付款確認'); }

    setTimeout(() => {
      toast('已自動填寫：' + (done.length ? done.join('、') : '（無需填寫）'));

      if (cfg.autoPay) {
        setTimeout(() => {
          const btn = findPayNow();
          if (!btn) { toast('找不到 Pay Now 按鈕，請手動點擊', '#dc3545'); return; }

          let cancelled = false;
          let remaining = 3;

          const showCountdown = () => {
            toast(`⚠️ ${remaining} 秒後自動付款… 按 ESC 取消`, '#fd7e14');
          };
          showCountdown();

          const onKey = (e) => {
            if (e.key === 'Escape') {
              cancelled = true;
              document.removeEventListener('keydown', onKey);
              toast('已取消自動付款', '#6c757d');
            }
          };
          document.addEventListener('keydown', onKey);

          const tick = setInterval(() => {
            remaining--;
            if (cancelled) { clearInterval(tick); return; }
            if (remaining > 0) { showCountdown(); return; }
            clearInterval(tick);
            document.removeEventListener('keydown', onKey);
            btn.click();
          }, 1000);
        }, 800);
      }
    }, cfg.billing?.enabled ? 700 : 300);
  }

  function fillBilling(b, done) {
    const thaiRadio = document.getElementById('bill_country_type_1');
    if (thaiRadio && !thaiRadio.checked) tap(thaiRadio);

    if (b.taxId) {
      const el = document.getElementById('tax_no');
      if (el) { setVal(el, b.taxId); done.push('稅籍編號'); }
    }

    const typeEl = document.getElementById('tax_type_' + (b.type || '1'));
    if (typeEl && !typeEl.checked) tap(typeEl);

    if (b.name) {
      const el = document.getElementById('bill_name');
      if (el) { setVal(el, b.name); done.push('發票名稱'); }
    }
    if (b.address) {
      const el = document.getElementById('bill_address');
      if (el) { setVal(el, b.address); done.push('發票地址'); }
    }
  }

  function findNextBtn() {
    // 依優先順序：Order panel 的 Next → footer Next → 任何文字為 Next 的按鈕
    return document.getElementById('btn-next-round') ||
           document.getElementById('footer-unfinished-btn') ||
           document.querySelector('.btn-continue[href*="/event/book/"]') ||
           Array.from(document.querySelectorAll('button, a.btn'))
             .find(b => /^next$/i.test(b.textContent.trim()) && !b.disabled);
  }

  function findPayNow() {
    for (const btn of document.querySelectorAll('button')) {
      if (/pay\s*now/i.test(btn.textContent)) return btn;
    }
    return null;
  }

  // ── 來自 popup 的訊息 ────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.action === 'startSnipe') {
      if (isEventPage || isBookPage) {
        triggerBuy(msg.cfg);
        sendResponse({ ok: true });
      } else if (isOrderPage) {
        fillOrderForm(msg.cfg);
        sendResponse({ ok: true });
      } else {
        sendResponse({ error: '不是活動頁面' });
      }
    }
    return true; // 保持 channel 開啟
  });

  // ── 入口 ─────────────────────────────────────────────────────

  chrome.storage.sync.get({
    zoneKeywords:  '',
    maxPrice:      '',
    ticketQty:     1,
    autoFill:      true,
    autoBuy:       false,
    autoPay:       false,
    paymentMethod: '12',
    billing: { enabled: false, taxId: '', type: '1', name: '', address: '' }
  }, function (cfg) {
    if (isEventPage || isBookPage) initEventPage(cfg);
    else if (isOrderPage) initOrderPage(cfg);
  });
})();
