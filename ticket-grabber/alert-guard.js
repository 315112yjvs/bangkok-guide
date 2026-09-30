// alert-guard.js — 跑在頁面 MAIN world（document_start，比網站自己的 JS 更早）
// 網站在 Zone 全滿／座位被搶時會跳原生 alert()，它會凍結整個分頁
//（content script 的計時器也一起停），搶票就卡住直到有人按「確定」。
// 搶票進行中（content.js 在 <html> 掛上 data-ttm-run）時改成不跳視窗，
// 把訊息轉給 content.js 記錄並立刻換下一步；沒在搶票時維持原生行為。
(() => {
  const nativeAlert = window.alert;
  window.alert = function (msg) {
    if (document.documentElement.hasAttribute('data-ttm-run')) {
      window.postMessage({ __ttmAlert: String(msg ?? '') }, location.origin);
      return;
    }
    return nativeAlert.apply(this, arguments);
  };
})();
