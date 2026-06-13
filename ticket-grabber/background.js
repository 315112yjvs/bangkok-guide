// background.js — Service Worker
// content.js 會在頁面載入後自行從 storage 恢復執行狀態，無需 background 介入。
// 背景僅負責一件事：把 content.js 送來的通知請求轉成桌面通知
//（content script 無法直接呼叫 chrome.notifications，必須經由 service worker）。
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'NOTIFY') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: msg.title || '🎫 搶票助手',
      message: msg.message || '',
      priority: 2,
      requireInteraction: !!msg.sticky, // CAPTCHA／卡關等需要你出手的，通知不自動消失
    });
  }
});
