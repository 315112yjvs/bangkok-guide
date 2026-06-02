(function () {
  'use strict';

  // ── 工具函式 ────────────────────────────────────────────────

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
      box-shadow:0 2px 12px rgba(0,0,0,.25);max-width:260px;
      line-height:1.4;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ── 偵測頁面類型 ─────────────────────────────────────────────

  const path = window.location.pathname.toLowerCase();
  const isEventPage = path.startsWith('/e/');
  const isOrderPage = path.startsWith('/walkin/');

  // ── 活動頁面：加入快速購票浮動按鈕 ──────────────────────────

  function initEventPage(cfg) {
    const qty = parseInt(cfg.ticketQty) || 1;

    const fab = document.createElement('div');
    fab.id = 'zipevent-fab';
    fab.innerHTML = `🎟️ 快速購票 ${qty > 1 ? '×' + qty : ''}`.trim();
    fab.style.cssText = `
      position:fixed;bottom:24px;right:20px;z-index:2147483647;
      background:linear-gradient(135deg,#007bff,#0056b3);
      color:#fff;padding:12px 20px;border-radius:25px;
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
    fab.addEventListener('click', () => setQtyAndBuy(qty));
    document.body.appendChild(fab);

    if (cfg.autoBuy) {
      setTimeout(() => setQtyAndBuy(qty), 1500);
    }
  }

  // 設定張數後點擊 Buy Ticket
  function setQtyAndBuy(targetQty) {
    const qtyInput = document.querySelector('input.ticket_quantity');
    if (qtyInput) {
      const current = parseInt(qtyInput.value) || 1;
      const diff = targetQty - current;

      if (diff > 0) {
        const addBtn = document.querySelector('.btn-add-quantity');
        let clicked = 0;
        const interval = setInterval(() => {
          if (clicked >= diff || !addBtn) { clearInterval(interval); doClickBuy(); return; }
          addBtn.click();
          clicked++;
        }, 120);
        return;
      } else if (diff < 0) {
        const rmBtn = document.querySelector('.btn-remove-quantity');
        let clicked = 0;
        const interval = setInterval(() => {
          if (clicked >= Math.abs(diff) || !rmBtn) { clearInterval(interval); doClickBuy(); return; }
          rmBtn.click();
          clicked++;
        }, 120);
        return;
      }
    }
    doClickBuy();
  }

  function doClickBuy() {
    // 優先右側 Order panel 的 Buy Ticket（class btn-buy-ticket 或 id btn-get-ticket）
    const btn = document.getElementById('btn-get-ticket') ||
                document.querySelector('.btn-buy-ticket') ||
                document.querySelector('#footer-buy-btn');
    if (btn) {
      btn.click();
    } else {
      toast('找不到 Buy Ticket 按鈕，請手動點擊', '#dc3545');
    }
  }

  // ── 結帳頁面：自動填表 ────────────────────────────────────────

  function initOrderPage(cfg) {
    if (!cfg.autoFill) return;
    toast('自動填表啟動中…', '#17a2b8');
    setTimeout(() => fillOrderForm(cfg), 900);
  }

  function fillOrderForm(cfg) {
    const done = [];

    // 1. 「รับทราบ」確認選項（每個 custom_data 問題選第一個 radio）
    const ackGroups = {};
    document.querySelectorAll('input[type="radio"][name*="custom_data"]').forEach(r => {
      const m = r.name.match(/custom_data\[(\d+)\]/);
      if (m && !ackGroups[m[1]]) ackGroups[m[1]] = r;
    });
    Object.values(ackGroups).forEach(r => {
      if (!r.checked) { tap(r); done.push('確認選項'); }
    });

    // 2. 不索取發票 — 確保 req_bill 未勾選（除非使用者有設定帳單資訊）
    const reqBill = document.getElementById('req_bill');
    if (!cfg.billing?.enabled && reqBill?.checked) {
      reqBill.click();
    }

    // 3. 帳單資訊（若有設定）
    if (cfg.billing?.enabled) {
      if (reqBill && !reqBill.checked) reqBill.click();
      setTimeout(() => fillBilling(cfg.billing, done), 400);
    }

    // 4. 付款方式（12 = QR / 24 = 信用卡）
    const pmId = 'payment_' + (cfg.paymentMethod || '12');
    const pmEl = document.getElementById(pmId);
    if (pmEl && !pmEl.checked) { tap(pmEl); done.push('付款方式'); }

    // 5. 同意條款 checkbox
    const consent = document.getElementById('has_consent');
    if (consent && !consent.checked) { consent.click(); done.push('服務條款'); }

    const payConsent = document.getElementById('payment_consent');
    if (payConsent && !payConsent.checked) { payConsent.click(); done.push('付款確認'); }

    setTimeout(() => {
      toast('已自動填寫：' + (done.length ? done.join('、') : '（無需填寫）'));

      if (cfg.autoPay) {
        setTimeout(() => {
          const payBtn = findPayNow();
          if (payBtn) {
            toast('3 秒後自動付款…', '#fd7e14');
            setTimeout(() => payBtn.click(), 3000);
          } else {
            toast('找不到 Pay Now 按鈕，請手動付款', '#dc3545');
          }
        }, 800);
      }
    }, cfg.billing?.enabled ? 700 : 300);
  }

  function fillBilling(b, done) {
    // 國家：Thailand（預設）
    const thaiRadio = document.getElementById('bill_country_type_1');
    if (thaiRadio && !thaiRadio.checked) tap(thaiRadio);

    if (b.taxId) {
      const el = document.getElementById('tax_no');
      if (el) { setVal(el, b.taxId); done.push('稅籍編號'); }
    }

    // 類型：1=個人 2=公司
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

  function findPayNow() {
    for (const btn of document.querySelectorAll('button')) {
      if (/pay\s*now/i.test(btn.textContent)) return btn;
    }
    return null;
  }

  // ── 入口 ─────────────────────────────────────────────────────

  if (!isEventPage && !isOrderPage) return;

  chrome.storage.sync.get({
    autoFill:      true,
    autoBuy:       false,
    autoPay:       false,
    ticketQty:     1,
    paymentMethod: '12',
    billing: { enabled: false, taxId: '', type: '1', name: '', address: '' }
  }, function (cfg) {
    if (isEventPage) initEventPage(cfg);
    else if (isOrderPage) initOrderPage(cfg);
  });
})();
