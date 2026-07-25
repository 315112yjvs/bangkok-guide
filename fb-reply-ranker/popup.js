const scanBtn = document.getElementById("scanBtn");
const autoBtn = document.getElementById("autoBtn");
const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const exportbar = document.getElementById("exportbar");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const urlInput = document.getElementById("urlInput");
const tabReplies = document.getElementById("tabReplies");
const tabAuthors = document.getElementById("tabAuthors");

let results = [];
let mode = "replies"; // replies | authors

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isFacebook(url) {
  return /^https:\/\/(www|web)\.facebook\.com\//.test(url || "");
}

function render() {
  listEl.innerHTML = "";
  if (!results.length) {
    listEl.innerHTML =
      mode === "authors"
        ? '<div class="empty">沒有讀到任何留言。<br>請先捲到留言區，或改用「自動掃描」。</div>'
        : '<div class="empty">沒有偵測到任何「查看 N 則回覆」的留言。<br>這篇留言可能大多沒有回覆，或還沒載入。</div>';
    exportbar.style.display = "none";
    return;
  }
  exportbar.style.display = "flex";
  results.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "row" + (i === 0 ? " top" : "");
    const count = mode === "authors" ? `${r.total} 則` : `${r.replies} 則`;
    row.innerHTML = `
      <div class="rank">${i + 1}</div>
      <div class="info">
        <div class="author"></div>
        <div class="text"></div>
      </div>
      <div class="count">${count}</div>`;
    row.querySelector(".author").textContent =
      mode === "authors" ? r.name : r.author;
    row.querySelector(".text").textContent =
      mode === "authors"
        ? `留言 ${r.comments}／回覆 ${r.replies}`
        : r.text || "（無文字內容）";
    if (mode === "authors") {
      row.style.cursor = r.profile ? "pointer" : "default";
      if (r.profile) {
        row.addEventListener("click", () =>
          chrome.tabs.create({ url: new URL(r.profile, "https://www.facebook.com").href })
        );
      }
    } else {
      row.addEventListener("click", () => scrollToComment(r.id));
    }
    listEl.appendChild(row);
  });
}

function setMode(next) {
  mode = next;
  tabReplies.classList.toggle("active", mode === "replies");
  tabAuthors.classList.toggle("active", mode === "authors");
  results = [];
  render();
  setStatus(
    mode === "authors"
      ? "統計每個帳號在已載入留言區裡留了幾則（自動掃描會一併展開回覆）。"
      : "「自動掃描」會自動往下載入留言再排名；「快速掃描」只讀目前畫面。"
  );
}

// 若有填網址，先把分頁導到該網址並等載入完成
async function ensureUrl(tab) {
  const url = (urlInput.value || "").trim();
  if (!url) return tab;
  if (!isFacebook(url)) {
    setStatus("網址不是 facebook.com 貼文，已略過導向。");
    return tab;
  }
  setStatus("正在開啟貼文…");
  await chrome.tabs.update(tab.id, { url });
  await new Promise((resolve) => {
    function listener(id, info) {
      if (id === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
  await new Promise((r) => setTimeout(r, 3000)); // 等留言區渲染
  return await getActiveTab();
}

function setBusy(busy) {
  scanBtn.disabled = busy;
  autoBtn.disabled = busy;
}

async function runScan(auto) {
  setBusy(true);
  try {
    let tab = await getActiveTab();
    tab = await ensureUrl(tab);
    if (!isFacebook(tab.url)) {
      setStatus("請在電腦版 Facebook 貼文頁使用，或在上方貼上貼文網址。");
      return;
    }

    const action = auto
      ? mode === "authors"
        ? "autoAuthorScan"
        : "autoScan"
      : mode === "authors"
      ? "authorScan"
      : "scan";

    if (auto) {
      setStatus("自動載入留言中，請不要關掉這個視窗…（約 30～60 秒）");
      const resp = await chrome.tabs.sendMessage(tab.id, {
        action,
        opts: { maxRounds: 40, expandReplies: true },
      });
      handleResp(resp, true);
    } else {
      setStatus("掃描中…");
      const resp = await chrome.tabs.sendMessage(tab.id, { action });
      handleResp(resp, false);
    }
  } catch (e) {
    setStatus("無法連線到頁面，請重新整理貼文、或確認插件已載入後再試。");
  } finally {
    setBusy(false);
  }
}

function handleResp(resp, auto) {
  if (!resp || !resp.ok) {
    setStatus("掃描失敗，請重新整理頁面後再試。");
    return;
  }
  results = resp.results || [];
  if (!results.length) {
    setStatus(
      mode === "authors" ? "沒有讀到留言。" : "沒有偵測到任何有回覆的留言。"
    );
    render();
    return;
  }

  if (mode === "authors") {
    setStatus(
      `已讀取 ${resp.total} 則留言／回覆，來自 ${resp.accounts} 個帳號；最多的是 ${results[0].name}（${results[0].total} 則）。`
    );
  } else {
    const head = auto ? `已載入約 ${resp.loaded || "?"} 個留言區塊，` : "";
    setStatus(
      `${head}共 ${results.length} 則有回覆的留言，冠軍 ${results[0].replies} 則回覆。`
    );
  }
  render();
}

async function scrollToComment(id) {
  const tab = await getActiveTab();
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "scrollTo", id });
  } catch (e) {}
}

function toText() {
  if (mode === "authors") {
    const lines = [
      "FB 帳號留言次數統計",
      `掃描時間：${new Date().toLocaleString()}`,
      "帳號\t總計\t留言\t回覆\t個人檔案",
    ];
    results.forEach((r) => {
      lines.push(
        `${r.name}\t${r.total}\t${r.comments}\t${r.replies}\t${r.profile || ""}`
      );
    });
    return lines.join("\n");
  }
  const lines = ["FB 留言回覆排行榜", `掃描時間：${new Date().toLocaleString()}`, ""];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.replies} 則回覆] ${r.author}`);
    if (r.text) lines.push(`   ${r.text}`);
  });
  return lines.join("\n");
}

async function copy() {
  try {
    await navigator.clipboard.writeText(toText());
    setStatus("已複製到剪貼簿。");
  } catch (e) {
    setStatus("複製失敗。");
  }
}

function exportTxt() {
  const blob = new Blob([toText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    mode === "authors"
      ? `fb-author-count-${Date.now()}.txt`
      : `fb-reply-ranking-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

tabReplies.addEventListener("click", () => setMode("replies"));
tabAuthors.addEventListener("click", () => setMode("authors"));
autoBtn.addEventListener("click", () => runScan(true));
scanBtn.addEventListener("click", () => runScan(false));
copyBtn.addEventListener("click", copy);
exportBtn.addEventListener("click", exportTxt);
