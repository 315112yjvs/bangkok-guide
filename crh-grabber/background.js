/* City Recital Hall 搶票助手 — service worker
 * 負責桌面通知、badge 狀態，以及在搶到票時把分頁叫到前景。 */

const STATE_KEY = 'crhState';

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'notify') {
    chrome.notifications.create('', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: msg.title || 'CRH 搶票助手',
      message: msg.body || '',
      priority: msg.urgent ? 2 : 0,
      requireInteraction: !!msg.urgent,
    });
    if (msg.urgent && sender.tab) {
      // 搶到票 / 排到號這種時刻，直接把分頁拉到眼前
      chrome.tabs.update(sender.tab.id, { active: true });
      chrome.windows.update(sender.tab.windowId, { focused: true, drawAttention: true });
    }
    reply && reply({ ok: true });
  }
  return true;
});

// badge 反映執行狀態
function refreshBadge() {
  chrome.storage.local.get(STATE_KEY, (r) => {
    const s = r[STATE_KEY] || {};
    if (s.grabbed) {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#38d39f' });
    } else if (s.running) {
      chrome.action.setBadgeText({ text: String(s.attempts || 0).slice(-3) });
      chrome.action.setBadgeBackgroundColor({ color: '#f5a623' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STATE_KEY]) refreshBadge();
});

chrome.runtime.onStartup.addListener(refreshBadge);
chrome.runtime.onInstalled.addListener(refreshBadge);
