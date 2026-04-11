// background.js — Service Worker

// 頁面更新時（自動重整後），若 isRunning 為 true，通知 content script 恢復
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get('isRunning', data => {
      if (data.isRunning) {
        // content.js 本身會在 DOMContentLoaded 後自動從 storage 讀取並恢復
        // 這裡只做確認 log
        console.log('[搶票助手] 頁面載入完成，content script 將自動恢復');
      }
    });
  }
});
