document.addEventListener('DOMContentLoaded', function () {

  // ── 張數 +/- ────────────────────────────────────────────────
  function setQty(n) {
    n = Math.max(1, Math.min(10, parseInt(n) || 1));
    document.getElementById('ticketQty').value        = n;
    document.getElementById('qtyDisplay').textContent = n;
  }
  document.getElementById('qtyMinus').addEventListener('click', () =>
    setQty(parseInt(document.getElementById('ticketQty').value) - 1));
  document.getElementById('qtyPlus').addEventListener('click', () =>
    setQty(parseInt(document.getElementById('ticketQty').value) + 1));

  // ── 讀取設定 ─────────────────────────────────────────────────
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
    document.getElementById('zoneKeywords').value  = cfg.zoneKeywords;
    document.getElementById('maxPrice').value      = cfg.maxPrice;
    setQty(cfg.ticketQty);

    document.getElementById('autoFill').checked = cfg.autoFill;
    document.getElementById('autoBuy').checked  = cfg.autoBuy;
    document.getElementById('autoPay').checked  = cfg.autoPay;

    const pmEl = document.querySelector(`input[name="pm"][value="${cfg.paymentMethod}"]`);
    if (pmEl) pmEl.checked = true;

    document.getElementById('billingEnabled').checked = cfg.billing.enabled;
    document.getElementById('taxId').value            = cfg.billing.taxId    || '';
    document.getElementById('billName').value         = cfg.billing.name     || '';
    document.getElementById('billAddress').value      = cfg.billing.address  || '';
    const btEl = document.querySelector(`input[name="bt"][value="${cfg.billing.type || '1'}"]`);
    if (btEl) btEl.checked = true;

    syncUI();
  });

  // ── 事件 ────────────────────────────────────────────────────
  document.getElementById('billingEnabled').addEventListener('change', syncUI);
  document.getElementById('autoPay').addEventListener('change', syncUI);
  document.getElementById('saveBtn').addEventListener('click', save);

  function syncUI() {
    document.getElementById('billingFields')
      .classList.toggle('show', document.getElementById('billingEnabled').checked);
    document.getElementById('autoPayWarn')
      .classList.toggle('show', document.getElementById('autoPay').checked);
  }

  // ── 儲存 ─────────────────────────────────────────────────────
  function save() {
    const pmEl = document.querySelector('input[name="pm"]:checked');
    const btEl = document.querySelector('input[name="bt"]:checked');

    const cfg = {
      zoneKeywords:  document.getElementById('zoneKeywords').value.trim(),
      maxPrice:      document.getElementById('maxPrice').value.trim(),
      ticketQty:     parseInt(document.getElementById('ticketQty').value) || 1,
      autoFill:      document.getElementById('autoFill').checked,
      autoBuy:       document.getElementById('autoBuy').checked,
      autoPay:       document.getElementById('autoPay').checked,
      paymentMethod: pmEl ? pmEl.value : '12',
      billing: {
        enabled: document.getElementById('billingEnabled').checked,
        taxId:   document.getElementById('taxId').value.trim(),
        type:    btEl ? btEl.value : '1',
        name:    document.getElementById('billName').value.trim(),
        address: document.getElementById('billAddress').value.trim()
      }
    };

    chrome.storage.sync.set(cfg, function () {
      const msg = document.getElementById('savedMsg');
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 2000);
    });
  }
});
