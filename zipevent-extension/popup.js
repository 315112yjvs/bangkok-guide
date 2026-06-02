document.addEventListener('DOMContentLoaded', function () {

  // ── 讀取已儲存設定 ──────────────────────────────────────────
  chrome.storage.sync.get({
    autoFill:      true,
    autoBuy:       false,
    autoPay:       false,
    paymentMethod: '12',
    billing: { enabled: false, taxId: '', type: '1', name: '', address: '' }
  }, function (cfg) {
    document.getElementById('autoFill').checked = cfg.autoFill;
    document.getElementById('autoBuy').checked  = cfg.autoBuy;
    document.getElementById('autoPay').checked  = cfg.autoPay;

    const pmRadio = document.querySelector(`input[name="pm"][value="${cfg.paymentMethod}"]`);
    if (pmRadio) pmRadio.checked = true;

    document.getElementById('billingEnabled').checked = cfg.billing.enabled;
    document.getElementById('taxId').value            = cfg.billing.taxId    || '';
    document.getElementById('billName').value         = cfg.billing.name     || '';
    document.getElementById('billAddress').value      = cfg.billing.address  || '';

    const btRadio = document.querySelector(`input[name="bt"][value="${cfg.billing.type || '1'}"]`);
    if (btRadio) btRadio.checked = true;

    syncUI();
  });

  // ── 事件綁定 ────────────────────────────────────────────────
  document.getElementById('billingEnabled').addEventListener('change', syncUI);
  document.getElementById('autoPay').addEventListener('change', syncUI);
  document.getElementById('saveBtn').addEventListener('click', save);

  // ── 同步 UI 狀態 ─────────────────────────────────────────────
  function syncUI() {
    const billingOn = document.getElementById('billingEnabled').checked;
    document.getElementById('billingFields').classList.toggle('show', billingOn);

    const autoPayOn = document.getElementById('autoPay').checked;
    document.getElementById('autoPayWarn').classList.toggle('show', autoPayOn);
  }

  // ── 儲存設定 ─────────────────────────────────────────────────
  function save() {
    const pmEl = document.querySelector('input[name="pm"]:checked');
    const btEl = document.querySelector('input[name="bt"]:checked');

    const cfg = {
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
