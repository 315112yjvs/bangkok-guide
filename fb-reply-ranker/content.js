// FB 留言回覆排行榜 - content script
// 讀留言區「查看 N 則回覆 / View N replies」數字並排名。
// 支援：快速掃描（只讀目前畫面）＋ 自動掃描（自動捲動載入更多留言後再讀）。

(() => {
  "use strict";

  const REPLY_KEYWORD = /(回覆|回复|replies|reply)/i;
  // 載入更多「上層留言」的按鈕文字（不是展開回覆）
  const MORE_COMMENTS = /(查看更多留言|檢視更多留言|更多留言|載入更多留言|View more comments|more comments|Show more comments)/i;
  // 展開回覆的按鈕（含「查看全部 N 則回覆」「查看更多回覆」「N 則回覆」）
  const MORE_REPLIES =
    /(查看全部|查看更多|檢視更多|更多|先前的|View all|View more|Show more|Previous)/i;
  const HIDE_REPLIES = /(隱藏|隐藏|Hide)/i;
  // 留言／回覆的 aria-label
  const COMMENT_LABEL = /(留言|回覆|回复|Comment|Reply)/i;
  const IS_REPLY_LABEL = /(回覆|回复|Reply)/i;

  let elementById = new Map();
  const clickedNodes = new WeakSet();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function parseCount(raw) {
    if (!raw) return null;
    const m = raw.match(
      /([\d][\d.,]*)\s*([萬万千kKmM])?\s*(?:則|條|条|個|个)?\s*(?:回覆|回复|replies|reply)/i
    );
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (isNaN(n)) return null;
    const unit = m[2];
    if (unit === "萬" || unit === "万") n *= 10000;
    else if (unit === "千") n *= 1000;
    else if (unit === "k" || unit === "K") n *= 1000;
    else if (unit === "m" || unit === "M") n *= 1000000;
    return Math.round(n);
  }

  // 找出留言區的捲動容器（貼文常在 modal 裡，捲動的是對話框而非整頁）
  function findScrollContainer() {
    const art = document.querySelector('[role="article"]');
    let el = art ? art.parentElement : null;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 40
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  // 點掉所有「查看更多留言」按鈕，回傳點了幾個
  function clickMoreComments() {
    let clicked = 0;
    const nodes = document.querySelectorAll(
      'div[role="button"], span[role="button"], [role="button"], a[role="link"], span'
    );
    for (const el of nodes) {
      const txt = (el.textContent || "").trim();
      if (!txt || txt.length > 40) continue;
      if (!MORE_COMMENTS.test(txt)) continue;
      try {
        el.click();
        clicked++;
      } catch (e) {}
    }
    return clicked;
  }

  // 點掉所有「查看全部 N 則回覆 / 查看更多回覆」按鈕，把回覆展開
  function clickMoreReplies() {
    let clicked = 0;
    const nodes = document.querySelectorAll('[role="button"], a[role="link"], span');
    for (const el of nodes) {
      const txt = (el.textContent || "").trim();
      if (!txt || txt.length > 40) continue;
      if (!REPLY_KEYWORD.test(txt)) continue;
      if (HIDE_REPLIES.test(txt)) continue;
      // 「查看更多回覆」這種，或「N 則回覆」這種（點下去會展開）
      if (!MORE_REPLIES.test(txt) && parseCount(txt) == null) continue;
      if (clickedNodes.has(el)) continue;
      // 只點最內層，避免父層代點造成重複
      if (el.querySelector('[role="button"], a[role="link"]')) continue;
      clickedNodes.add(el);
      try {
        el.click();
        clicked++;
      } catch (e) {}
    }
    return clicked;
  }

  // 把個人檔案連結正規化成帳號 key，避免同名不同人被合併
  function profileKey(href) {
    if (!href) return "";
    try {
      const u = new URL(href, location.origin);
      const mUser = u.pathname.match(/\/user\/(\d+)/);
      if (mUser) return "id:" + mUser[1];
      if (u.pathname === "/profile.php") {
        const id = u.searchParams.get("id");
        if (id) return "id:" + id;
      }
      const m = u.pathname.match(/^\/([^/]+)\/?$/);
      if (
        m &&
        !/^(profile\.php|story\.php|permalink\.php|photo|photo\.php|posts|watch|reel|reels|groups|events|pages|share|login\.php)$/i.test(
          m[1]
        )
      ) {
        return "u:" + decodeURIComponent(m[1]).toLowerCase();
      }
    } catch (e) {}
    return "";
  }

  function getAuthorIdentity(article) {
    const label = article.getAttribute("aria-label") || "";
    let name = label
      .replace(/的留言|的回覆|的回复|Comment by\s*|Reply by\s*/gi, "")
      .trim();

    let key = "";
    let profile = "";
    const links = article.querySelectorAll('a[role="link"][href]');
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      const k = profileKey(href);
      if (!k) continue;
      const t = (a.innerText || "").trim();
      if (name && t && t !== name) continue; // 內文裡 tag 別人的連結，跳過
      key = k;
      profile = k.startsWith("id:")
        ? "https://www.facebook.com/profile.php?id=" + k.slice(3)
        : "https://www.facebook.com/" + k.slice(2);
      if (!name && t) name = t.slice(0, 60);
      break;
    }
    if (!name) name = "(未知帳號)";
    return { name, key: key || "name:" + name, profile };
  }

  // 統計每個帳號在目前已載入的留言區裡留了幾則（留言＋回覆分開算）
  function authorScan() {
    const arts = document.querySelectorAll('[role="article"]');
    const map = new Map();
    let total = 0;

    for (const art of arts) {
      const label = art.getAttribute("aria-label") || "";
      if (!label || !COMMENT_LABEL.test(label)) continue;
      const isReply = IS_REPLY_LABEL.test(label);
      const { name, key, profile } = getAuthorIdentity(art);

      let rec = map.get(key);
      if (!rec) {
        rec = { name, profile, total: 0, comments: 0, replies: 0 };
        map.set(key, rec);
      }
      if (!rec.profile && profile) rec.profile = profile;
      rec.total++;
      if (isReply) rec.replies++;
      else rec.comments++;
      total++;
    }

    const results = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return { results, total, accounts: results.length };
  }

  async function autoAuthorScan(opts = {}) {
    const maxRounds = opts.maxRounds || 40;
    const idleLimit = opts.idleLimit || 4;
    const delay = opts.delay || 1300;
    const expandReplies = opts.expandReplies !== false;
    const container = findScrollContainer();

    let last = -1;
    let idle = 0;
    let rounds = 0;
    for (let i = 0; i < maxRounds; i++) {
      rounds = i + 1;
      clickMoreComments();
      if (expandReplies) clickMoreReplies();
      try {
        container.scrollTo({ top: container.scrollHeight });
      } catch (e) {
        container.scrollTop = container.scrollHeight;
      }
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(delay);

      const now = document.querySelectorAll('[role="article"]').length;
      if (now <= last) {
        idle++;
        if (idle >= idleLimit) break;
      } else {
        idle = 0;
        last = now;
      }
    }
    return { ...authorScan(), rounds };
  }

  function findReplyToggles() {
    const candidates = [];
    const nodes = document.querySelectorAll(
      'div[role="button"], span[role="button"], a[role="link"], span'
    );
    for (const el of nodes) {
      const txt = (el.textContent || "").trim();
      if (!txt || txt.length > 40) continue;
      if (!REPLY_KEYWORD.test(txt)) continue;
      if (parseCount(txt) == null) continue;
      candidates.push(el);
    }
    return candidates.filter(
      (el) => !candidates.some((other) => other !== el && el.contains(other))
    );
  }

  function getCommentInfo(toggleEl) {
    const article = toggleEl.closest('[role="article"]');
    if (!article) return null;

    let author = "";
    const label = article.getAttribute("aria-label") || "";
    if (label) {
      author = label
        .replace(/的留言|的回覆|的回复|Comment by\s*|Reply by\s*/gi, "")
        .trim();
    }
    if (!author) {
      const link = article.querySelector('a[role="link"] span, a[role="link"]');
      if (link) author = (link.textContent || "").trim().slice(0, 40);
    }
    if (!author) author = "(未知作者)";

    let text = "";
    const bodies = article.querySelectorAll('div[dir="auto"]');
    for (const b of bodies) {
      const t = (b.innerText || "").trim();
      if (!t) continue;
      if (t === author) continue;
      if (REPLY_KEYWORD.test(t) && t.length < 30) continue;
      text = t;
      break;
    }
    return { author, text, article };
  }

  function scan() {
    const toggles = findReplyToggles();
    const seen = new Set();
    const results = [];
    elementById = new Map();

    for (const toggle of toggles) {
      const count = parseCount(toggle.textContent);
      if (count == null) continue;
      const info = getCommentInfo(toggle);
      if (!info || !info.article) continue;
      if (seen.has(info.article)) continue;
      seen.add(info.article);

      const id = results.length;
      elementById.set(id, info.article);
      results.push({
        id,
        author: info.author,
        text: (info.text || "").replace(/\s+/g, " ").slice(0, 120),
        replies: count,
      });
    }
    results.sort((a, b) => b.replies - a.replies);
    return results;
  }

  // 自動捲動載入更多留言，直到留言數量不再增加或達到上限，再掃描
  async function autoScan(opts = {}) {
    const maxRounds = opts.maxRounds || 40; // 最多捲動輪數
    const idleLimit = opts.idleLimit || 4; // 連續幾輪沒新增就停
    const delay = opts.delay || 1300;
    const container = findScrollContainer();

    let last = -1;
    let idle = 0;
    let rounds = 0;
    for (let i = 0; i < maxRounds; i++) {
      rounds = i + 1;
      clickMoreComments();
      try {
        container.scrollTo({ top: container.scrollHeight });
      } catch (e) {
        container.scrollTop = container.scrollHeight;
      }
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(delay);

      const now = document.querySelectorAll('[role="article"]').length;
      if (now <= last) {
        idle++;
        if (idle >= idleLimit) break;
      } else {
        idle = 0;
        last = now;
      }
    }
    const results = scan();
    return { results, rounds, loaded: last };
  }

  function scrollToComment(id) {
    const el = elementById.get(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prev = el.style.outline;
    el.style.outline = "3px solid #1877f2";
    el.style.outlineOffset = "2px";
    setTimeout(() => {
      el.style.outline = prev;
    }, 2500);
    return true;
  }

  // 供測試用（在一般網頁 / 測試頁沒有 chrome.runtime 時也不會壞掉）
  window.__fbCommentStats = { scan, authorScan, autoAuthorScan, profileKey };
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.onMessage) return;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.action === "scan") {
      try {
        sendResponse({ ok: true, results: scan() });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }
    if (msg.action === "autoScan") {
      autoScan(msg.opts || {})
        .then((r) => sendResponse({ ok: true, ...r }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // 保持通道開啟等待非同步結果
    }
    if (msg.action === "authorScan") {
      try {
        sendResponse({ ok: true, ...authorScan() });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }
    if (msg.action === "autoAuthorScan") {
      autoAuthorScan(msg.opts || {})
        .then((r) => sendResponse({ ok: true, ...r }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true;
    }
    if (msg.action === "scrollTo") {
      sendResponse({ ok: scrollToComment(msg.id) });
      return true;
    }
    if (msg.action === "ping") {
      sendResponse({ ok: true });
      return true;
    }
  });
})();
