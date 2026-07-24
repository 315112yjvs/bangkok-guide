/* =========================================================================
 * 留言小幫手（FB / IG 抽獎）
 * 在指定的留言串「回覆」自動送出：食物 emoji + 食物英文 + 活動 hashtag
 * 內建隨機延遲，降低被判定 spam 的機率。自動偵測 Facebook / Instagram。
 *
 * 用法：
 *   1. 打開活動貼文，把留言區展開到看得到你要洗的那一串
 *   2. 面板點「選取目標留言」→ 再點頁面上那則留言
 *   3. 確認 hashtag / 間隔秒數 → 按「開始」
 * ========================================================================= */
(() => {
  "use strict";
  if (window.__commentBotLoaded) return;
  window.__commentBotLoaded = true;

  const autoPlatform = () => (location.hostname.includes("instagram") ? "IG" : "FB");
  const platform = () => (state.platformOverride === "auto" ? autoPlatform() : state.platformOverride);
  const STORE_KEY = "cbot_settings_v1";

  // ---- 多語系按鈕文字 ----
  const REPLY_TEXTS = ["回覆", "回复", "Reply", "ตอบกลับ"];
  const POST_TEXTS  = ["發佈", "發布", "发布", "Post", "โพสต์"];

  // ---- 食物清單（emoji + 英文）----
  const FOODS = [
    ["🍕","Pizza"],["🍔","Burger"],["🍟","Fries"],["🌭","Hotdog"],
    ["🍣","Sushi"],["🍜","Ramen"],["🍲","Hotpot"],["🍛","Curry"],
    ["🍤","Shrimp"],["🥟","Dumpling"],["🍢","Oden"],["🍙","Riceball"],
    ["🍚","Rice"],["🥩","Steak"],["🍗","Chicken"],["🥓","Bacon"],
    ["🌮","Taco"],["🌯","Burrito"],["🥙","Kebab"],["🥗","Salad"],
    ["🍝","Pasta"],["🥪","Sandwich"],["🧀","Cheese"],["🥐","Croissant"],
    ["🥞","Pancake"],["🧇","Waffle"],["🍞","Bread"],["🥖","Baguette"],
    ["🍩","Donut"],["🍪","Cookie"],["🎂","Cake"],["🧁","Cupcake"],
    ["🍰","Shortcake"],["🍫","Chocolate"],["🍬","Candy"],["🍭","Lollipop"],
    ["🍦","Icecream"],["🍨","Sundae"],["🍧","Bingsu"],["🍮","Pudding"],
    ["🍯","Honey"],["🥭","Mango"],["🍓","Strawberry"],["🍉","Watermelon"],
    ["🍇","Grape"],["🍎","Apple"],["🍊","Orange"],["🍌","Banana"],
    ["🍍","Pineapple"],["🥥","Coconut"],["🥑","Avocado"],["🍑","Peach"],
    ["🍒","Cherry"],["🫐","Blueberry"],["🥝","Kiwi"],["🍋","Lemon"],
    ["🍵","Matcha"],["☕","Coffee"],["🧋","Bubbletea"],["🥤","Soda"],
    ["🍹","Cocktail"],["🍺","Beer"],["🥛","Milk"],["🧃","Juice"],
    ["🥘","Paella"],["🍳","Omelet"],["🥨","Pretzel"],["🥯","Bagel"],
    ["🍠","Sweetpotato"],["🌽","Corn"],["🥔","Potato"],["🍄","Mushroom"],
    ["🦐","Prawn"],["🦀","Crab"],["🦞","Lobster"],["🐟","Fish"],
    ["🍡","Dango"],["🥮","Mooncake"],["🍘","Cracker"],["🧆","Falafel"],
  ];

  const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick  = (arr) => arr[rand(0, arr.length - 1)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function buildMessage() {
    const tag = (state.hashtag || "").trim();
    // 避免跟上一則用到同一種食物
    let first;
    do { first = pick(FOODS); } while (FOODS.length > 1 && first[1] === state.lastFood);
    state.lastFood = first[1];
    const [e1, f1] = first;
    if (Math.random() < 0.25) {
      let second = pick(FOODS);
      while (second[1] === f1) second = pick(FOODS);
      return `${e1} ${f1} ${second[0]} ${second[1]} ${tag}`.trim();
    }
    return `${e1} ${f1} ${tag}`.trim();
  }

  // ---------------------------------------------------------------------
  const state = {
    running: false, count: 0,
    minSec: 30, maxSec: 90,
    batchSize: 10,          // 每批連續留言幾則後休息，0=不分批
    restMinMin: 5, restMaxMin: 8,  // 每批之間休息幾分鐘（隨機區間）
    batchDone: 0,           // 目前這批已送出幾則
    bigBatchSize: 50,       // 每滿幾則做一次「大休息」，0=不啟用
    bigRestMin: 15,         // 大休息幾分鐘
    bigDone: 0,             // 距離上次大休息已送出幾則
    hashtag: "#LINEMANWongnaiUsersChoicexInnOngsa",
    mentionName: "",
    maxCount: 0,            // 目標則數，0=不限
    platformOverride: "auto",
    autoReply: true,        // FB：每則重新點回覆、用自動帶入的 @提及
    lastFood: null, fails: 0, mentionFails: 0,
    targetUser: null, pickMode: false, timer: null,
  };

  // ---- 設定持久化（FB 一直重繪/重整也不會清空）----
  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        hashtag: state.hashtag, mentionName: state.mentionName,
        minSec: state.minSec, maxSec: state.maxSec,
        batchSize: state.batchSize,
        restMinMin: state.restMinMin, restMaxMin: state.restMaxMin,
        bigBatchSize: state.bigBatchSize, bigRestMin: state.bigRestMin,
        maxCount: state.maxCount, platformOverride: state.platformOverride,
        autoReply: state.autoReply,
      }));
    } catch (e) {}
  }
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      Object.assign(state, s);
    } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // 共用工具
  // ---------------------------------------------------------------------
  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.width > 0 && r.height > 0;
  }

  function findByText(texts, root = document) {
    const cands = root.querySelectorAll('div[role="button"],button,span,a');
    for (const el of cands) {
      const t = (el.textContent || "").trim();
      if (texts.includes(t) && isVisible(el)) return el;
    }
    return null;
  }

  function getTargetContainer() {
    const c = document.querySelector('[data-cbot-target="1"]');
    return c && document.body.contains(c) ? c : null;
  }

  function getReplyButton() {
    const stamped = getTargetContainer();
    if (stamped) {
      const rb = findByText(REPLY_TEXTS, stamped);
      if (rb) return rb;
    }
    if (state.targetUser) {
      const btns = [...document.querySelectorAll('div[role="button"],button,span')]
        .filter((x) => REPLY_TEXTS.includes((x.textContent || "").trim()) && isVisible(x));
      for (const b of btns) {
        let el = b;
        for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
          const hit = [...el.querySelectorAll("a")].some((a) => {
            const href = a.getAttribute("href") || "";
            return href.includes("/" + state.targetUser + "/") ||
                   (a.textContent || "").trim() === state.targetUser;
          });
          if (hit) return b;
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // IG：textarea + 原生 setter + 點「發佈」
  // ---------------------------------------------------------------------
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function sendOneIG() {
    const replyBtn = getReplyButton();
    if (!replyBtn) { log("⚠️ 找不到目標留言的「回覆」按鈕，請重新選取目標。"); return false; }
    replyBtn.scrollIntoView({ block: "center" });
    await sleep(400);
    replyBtn.click();
    await sleep(rand(900, 1500));

    const ta = [...document.querySelectorAll("textarea")].filter(isVisible).pop();
    if (!ta) { log("⚠️ 找不到留言輸入框。"); return false; }
    // IG 的 @提及：直接打 @handle 文字，送出後 IG 會自動連結（不需玩下拉選單）
    const mention = state.mentionName
      ? "@" + state.mentionName.trim().replace(/^@+/, "") + " " : "";
    const base = ta.value || "";
    const sep = base && !base.endsWith(" ") ? " " : "";
    const msg = base + sep + mention + buildMessage();
    ta.focus();
    setNativeValue(ta, msg);
    await sleep(rand(500, 900));

    const form = ta.closest("form");
    const postBtn = (form && findByText(POST_TEXTS, form)) || findByText(POST_TEXTS);
    if (!postBtn) { log("⚠️ 找不到「發佈」按鈕。"); return false; }
    postBtn.click();
    return true;
  }

  // ---------------------------------------------------------------------
  // FB：contenteditable + execCommand insertText + 按 Enter
  // ---------------------------------------------------------------------
  function getEditables(scope) {
    return [...(scope || document).querySelectorAll('div[role="textbox"][contenteditable="true"]')]
      .filter(isVisible);
  }

  // 找出「回覆用」的輸入框（優先目標容器內、或 aria-label 含「回覆」的，避免用到最底部的主留言框）
  function pickReplyBox(container) {
    if (container) {
      const inside = getEditables(container);
      if (inside.length) return inside[0];
    }
    const labeled = getEditables(document).filter((b) => {
      const al = (b.getAttribute("aria-label") || "") + (b.getAttribute("placeholder") || "");
      return REPLY_TEXTS.some((t) => al.includes(t));
    });
    if (labeled.length) return labeled[labeled.length - 1];
    const all = getEditables(document);
    return all.length ? all[all.length - 1] : null;
  }

  function pressEnter(el) {
    const opts = { bubbles: true, cancelable: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  // 把游標移到輸入框最後面（保留 FB 自動帶入的 @提及，接在它後面打字）
  function caretToEnd(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // 只在「真正跳出來的下拉框」裡找符合名稱的選項，避免誤抓頁面其他元素
  function findMentionOption(name) {
    const key = name.toLowerCase();
    let opts = [];
    document.querySelectorAll('[role="listbox"],[role="menu"]').forEach((lb) => {
      if (isVisible(lb)) opts.push(...lb.querySelectorAll('[role="option"],[role="menuitem"]'));
    });
    opts = opts.filter(isVisible);
    if (!opts.length) return null; // 下拉還沒出現
    return opts.find((o) => (o.textContent || "").trim() === name) ||
           opts.find((o) => (o.textContent || "").toLowerCase().includes(key)) || null;
  }

  // 完整滑鼠事件點選（FB 選項需要 hover + 完整 pointer/mouse 序列，且要命中座標上的實際元素）
  function realClick(el) {
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const target = document.elementFromPoint(x, y) || el;
    const base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    const P = (t, extra) => target.dispatchEvent(new PointerEvent(t, { ...base, pointerId: 1, pointerType: "mouse", ...extra }));
    const M = (t, extra) => target.dispatchEvent(new MouseEvent(t, { ...base, button: 0, ...extra }));
    P("pointerover"); M("mouseover");
    P("pointermove"); M("mousemove");
    P("pointerdown", { buttons: 1 }); M("mousedown", { buttons: 1 });
    P("pointerup", { buttons: 0 });   M("mouseup", { buttons: 0 });
    M("click");
  }

  // 在 FB 留言框輸入真正的 @提及：逐字把名字打完整 → 等選單 → 點選你的帳號 → 驗證
  async function insertMention(box, name) {
    box.focus();
    await sleep(150);
    // 查詢字串：名字第一個空格前那段（不夠長就用整個名字），最多 12 字，讓帳號排到選單前面
    const firstWord = name.split(/\s+/)[0] || name;
    const query = (firstWord.length >= 3 ? firstWord : name).slice(0, 12);

    document.execCommand("insertText", false, "@");
    await sleep(220);
    // 先把查詢字打完整，不要打一半就急著選
    for (const ch of query) {
      document.execCommand("insertText", false, ch);
      await sleep(rand(140, 240));
    }

    // 等選單出現並找到你的帳號（最多約 4 秒）
    let opt = null;
    for (let i = 0; i < 16 && !opt; i++) {
      await sleep(250);
      opt = findMentionOption(name);
    }
    // 還沒出來就 nudge：刪最後一字→補回，強迫 FB 重算
    for (let round = 0; round < 2 && !opt; round++) {
      document.execCommand("delete", false, null);
      await sleep(300);
      document.execCommand("insertText", false, query.slice(-1));
      for (let j = 0; j < 8 && !opt; j++) { await sleep(250); opt = findMentionOption(name); }
    }
    if (!opt) return false;

    // 點選（重找一次最新的元素再點，避免清單重繪後參照失效）
    for (let attempt = 0; attempt < 3; attempt++) {
      const fresh = findMentionOption(name) || opt;
      realClick(fresh);
      await sleep(rand(500, 800));
      const txt = (box.textContent || "").trim();
      if (!txt.includes("@")) return true; // 成功變成 mention（@ 消失）
    }
    return false;
  }

  async function sendOneFB() {
    const container = getTargetContainer();

    // ===== 模式 A：每則重新點「回覆」，用 FB 自動帶入的 @提及（推薦，避開打字限流）=====
    if (state.autoReply) {
      const rb = getReplyButton();
      if (!rb) { log("⚠️ 找不到目標留言的「回覆」按鈕，請重新選取目標。"); return false; }
      rb.scrollIntoView({ block: "center" });
      await sleep(400);
      rb.click(); // 每次點回覆 → FB 會把被回覆者的 @提及帶進輸入框
      await sleep(rand(1000, 1700));

      const box = pickReplyBox(getTargetContainer());
      if (!box) { log("⚠️ 找不到回覆輸入框。"); return false; }
      box.focus();
      await sleep(200);
      caretToEnd(box);
      const cur = box.textContent || "";
      // 若要求要帶提及、但這則沒自動帶到 @，提示（通常代表目標不是「某人的留言」）
      if (state.mentionName && !cur.trim()) {
        log("ℹ️ 這則沒自動帶到 @提及。請把目標選成「你本人發的那則留言」，點它的回覆才會自動 @ 你。");
      }
      const sep = cur && !/\s$/.test(cur) ? " " : "";
      document.execCommand("insertText", false, sep + buildMessage());
      await sleep(rand(400, 800));
      pressEnter(box);
      return true;
    }

    // ===== 模式 B：重用回覆框 + 自己打字叫 typeahead @提及 =====
    let box = pickReplyBox(container);

    // 若沒有開著的回覆框，先點目標留言的「回覆」
    if (!box) {
      const rb = getReplyButton();
      if (!rb) { log("⚠️ 找不到目標留言的「回覆」按鈕，請重新選取目標。"); return false; }
      rb.scrollIntoView({ block: "center" });
      await sleep(400);
      rb.click();
      await sleep(rand(900, 1500));
      box = pickReplyBox(container);
    }
    if (!box) { log("⚠️ 找不到回覆輸入框。"); return false; }

    box.focus();
    await sleep(150);
    // 清掉殘留內容
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);

    // 需要 @提及自己的帳號
    if (state.mentionName) {
      const ok = await insertMention(box, state.mentionName);
      if (!ok) {
        // 清掉打到一半的 @字串，避免殘留；交給 loop 做 backoff 重試
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
        return "mention";
      }
      document.execCommand("insertText", false, " ");
    }

    document.execCommand("insertText", false, buildMessage());
    await sleep(rand(400, 800));
    pressEnter(box);
    return true;
  }

  // ---------------------------------------------------------------------
  async function sendOne() {
    return platform() === "IG" ? await sendOneIG() : await sendOneFB();
  }

  async function loopTick() {
    if (!state.running) return;
    let res = false;
    try { res = await sendOne(); }
    catch (e) { log("❌ 錯誤：" + (e && e.message ? e.message : e)); }

    // FB 暫時不建議你的帳號（限流）→ 拉長等待、重試同一則，不算入一般失敗
    if (res === "mention") {
      state.mentionFails++;
      if (state.mentionFails >= 8) {
        log("⚠️ 連續多次抓不到你的帳號（FB 限流）。先自動停止，建議把間隔調長到 60~120 秒、或休息幾分鐘再跑。");
        stop(); return;
      }
      const wait = rand(90, 150);
      log(`⏸ FB 暫時搜不到你的帳號（第 ${state.mentionFails} 次，疑似限流），等 ${wait} 秒後重試同一則…`);
      if (!state.running) return;
      state.timer = setTimeout(loopTick, wait * 1000);
      return;
    }

    if (res === true) {
      state.count++;
      state.batchDone++;
      state.bigDone++;
      state.fails = 0;
      state.mentionFails = 0;
      log(`✅ 已送出 #${state.count}` +
          (state.batchSize > 0 ? `（本批 ${state.batchDone}/${state.batchSize}）` : ""));
      updateStats();
      await sleep(rand(1500, 2500));
    } else {
      state.fails++;
      if (state.fails >= 5) {
        log("⚠️ 連續 5 次失敗，自動停止。請確認目標留言還在、或 @帳號名稱正確。");
        stop(); return;
      }
    }

    if (state.maxCount > 0 && state.count >= state.maxCount) {
      log(`🎯 已達目標 ${state.maxCount} 則，自動停止。`);
      stop(); return;
    }
    if (!state.running) return;

    // 大休息：每滿 bigBatchSize 則 → 休息較久（優先於小批休息，避免留太多太密被鎖）
    if (state.bigBatchSize > 0 && state.bigDone >= state.bigBatchSize) {
      state.bigDone = 0;
      state.batchDone = 0; // 大休息同時把小批計數歸零，避免休完馬上又觸發小休息
      const restSec = rand(Math.round(state.bigRestMin * 60), Math.round(state.bigRestMin * 60) + 90);
      const mins = (restSec / 60).toFixed(1);
      log(`🛌 已累積送出 ${state.bigBatchSize} 則，大休息 ${mins} 分鐘後再繼續…`);
      state.timer = setTimeout(loopTick, restSec * 1000);
      return;
    }

    // 分批休息：這批已達 batchSize → 休息數分鐘再開下一批（模擬真人、避免被鎖）
    if (state.batchSize > 0 && state.batchDone >= state.batchSize) {
      state.batchDone = 0;
      const lo = Math.min(state.restMinMin, state.restMaxMin);
      const hi = Math.max(state.restMinMin, state.restMaxMin);
      const restSec = rand(Math.round(lo * 60), Math.round(hi * 60));
      const mins = (restSec / 60).toFixed(1);
      log(`😴 已連續送出 ${state.batchSize} 則，休息 ${mins} 分鐘後再開下一批…`);
      state.timer = setTimeout(loopTick, restSec * 1000);
      return;
    }

    const wait = rand(state.minSec, state.maxSec);
    log(`⏳ 等待 ${wait} 秒後送下一則…`);
    state.timer = setTimeout(loopTick, wait * 1000);
  }

  function start() {
    if (state.running) return;
    if (!getReplyButton() && !getTargetContainer()) {
      log("⚠️ 尚未鎖定目標留言，請先點「選取目標留言」。");
      return;
    }
    state.minSec = Math.max(3, parseInt(el.min.value, 10) || 30);
    state.maxSec = Math.max(state.minSec, parseInt(el.max.value, 10) || 90);
    state.batchSize = Math.max(0, parseInt(el.batchSize.value, 10) || 0);
    state.restMinMin = Math.max(0, parseFloat(el.restMin.value) || 0);
    state.restMaxMin = Math.max(state.restMinMin, parseFloat(el.restMax.value) || 0);
    state.bigBatchSize = Math.max(0, parseInt(el.bigBatch.value, 10) || 0);
    state.bigRestMin = Math.max(0, parseFloat(el.bigRest.value) || 0);
    state.batchDone = 0;
    state.bigDone = 0;
    state.hashtag = el.tag.value.trim() || state.hashtag;
    state.mentionName = el.mention.value.trim();
    state.maxCount = Math.max(0, parseInt(el.maxCount.value, 10) || 0);
    state.fails = 0;
    state.mentionFails = 0;
    saveSettings();
    state.running = true;
    el.startBtn.textContent = "■ 停止";
    el.startBtn.classList.add("cbot-stop");
    log(`▶️ 開始（${platform()}），間隔 ${state.minSec}~${state.maxSec} 秒` +
        (state.batchSize ? `，每 ${state.batchSize} 則休息 ${state.restMinMin}~${state.restMaxMin} 分鐘` : "") +
        (state.bigBatchSize ? `，每 ${state.bigBatchSize} 則大休息 ${state.bigRestMin} 分鐘` : "") +
        (state.maxCount ? `，目標 ${state.maxCount} 則。` : "。"));
    loopTick();
  }

  function stop() {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    el.startBtn.textContent = "▶ 開始";
    el.startBtn.classList.remove("cbot-stop");
    log("⏹ 已停止。");
  }

  // ---------------------------------------------------------------------
  // 選取目標留言
  // ---------------------------------------------------------------------
  function enterPickMode() {
    state.pickMode = true;
    document.body.style.cursor = "crosshair";
    log("🎯 選取模式：請點擊你要洗的那則目標留言（點在留言文字上）。");
    document.addEventListener("click", pickHandler, true);
  }
  function exitPickMode() {
    state.pickMode = false;
    document.body.style.cursor = "";
    document.removeEventListener("click", pickHandler, true);
  }
  function pickHandler(e) {
    if (!state.pickMode) return;
    if (e.target.closest("#cbot-panel")) return;
    e.preventDefault();
    e.stopPropagation();

    let node = e.target, container = null;
    while (node && node !== document.body) {
      if (findByText(REPLY_TEXTS, node)) { container = node; break; }
      node = node.parentElement;
    }
    if (!container) {
      log("⚠️ 這裡抓不到「回覆」按鈕，請改點留言文字、或先展開回覆。");
      exitPickMode();
      return;
    }

    document.querySelectorAll('[data-cbot-target="1"]').forEach((n) => {
      n.removeAttribute("data-cbot-target");
      n.style.outline = "";
    });
    container.setAttribute("data-cbot-target", "1");
    container.style.outline = "2px dashed #ff4d8d";

    const link = [...container.querySelectorAll("a")].find((a) => {
      const h = a.getAttribute("href") || "";
      return /^\/[A-Za-z0-9._]+\/?$/.test(h);
    });
    state.targetUser = link
      ? link.getAttribute("href").replace(/\//g, "")
      : (container.querySelector("a")?.textContent || "").trim() || null;

    el.target.textContent = state.targetUser ? "已鎖定：" + state.targetUser : "已鎖定目標留言";
    log("🔒 已鎖定目標留言。可以按「開始」。");
    exitPickMode();
  }

  // ---------------------------------------------------------------------
  // UI 面板
  // ---------------------------------------------------------------------
  const el = {};
  function log(msg) {
    if (!el.logBox) return;
    const time = new Date().toLocaleTimeString("zh-TW", { hour12: false });
    const line = document.createElement("div");
    line.textContent = `[${time}] ${msg}`;
    el.logBox.appendChild(line);
    el.logBox.scrollTop = el.logBox.scrollHeight;
    while (el.logBox.childNodes.length > 200) el.logBox.removeChild(el.logBox.firstChild);
  }
  function updateStats() { if (el.count) el.count.textContent = String(state.count); }

  // 用 createElement 建 DOM（避免 Facebook Trusted Types 擋掉 innerHTML）
  function h(tag, props, children) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === "text") e.textContent = props[k];
      else if (k === "style") e.style.cssText = props[k];
      else e.setAttribute(k, props[k]);
    }
    if (children) for (const c of children) e.appendChild(c);
    return e;
  }

  function buildPanel() {
    const style = document.createElement("style");
    style.textContent = `
      #cbot-panel{position:fixed;top:80px;right:20px;z-index:2147483647;width:290px;
        max-height:calc(100vh - 100px);display:flex;flex-direction:column;
        background:#fff;border:1px solid #dbdbdb;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.18);
        font:13px/1.5 -apple-system,"PingFang TC",sans-serif;color:#262626;overflow:hidden}
      #cbot-panel *{box-sizing:border-box}
      #cbot-head{cursor:move;flex:0 0 auto;background:linear-gradient(90deg,#1877f2,#dd2a7b,#8134af);
        color:#fff;padding:10px 12px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
      #cbot-close{cursor:pointer;opacity:.85}
      #cbot-body{padding:12px;overflow-y:auto;flex:1 1 auto;-webkit-overflow-scrolling:touch}
      #cbot-body::-webkit-scrollbar{width:8px}
      #cbot-body::-webkit-scrollbar-thumb{background:#c7c7c7;border-radius:4px}
      #cbot-body::-webkit-scrollbar-track{background:transparent}
      #cbot-body label{display:block;font-size:11px;color:#8e8e8e;margin:8px 0 3px}
      #cbot-body input{width:100%;padding:7px 8px;border:1px solid #dbdbdb;border-radius:8px;font-size:12px}
      .cbot-row{display:flex;gap:8px}
      .cbot-row>div{flex:1}
      #cbot-target{background:#fafafa;border:1px solid #efefef;border-radius:8px;padding:7px 8px;
        font-size:12px;color:#262626;margin-top:4px;word-break:break-all}
      .cbot-btn{width:100%;padding:9px;border:0;border-radius:9px;font-weight:700;cursor:pointer;font-size:13px;margin-top:10px}
      #cbot-pick{background:#efefef;color:#262626}
      #cbot-start{background:#0095f6;color:#fff}
      #cbot-start.cbot-stop{background:#ed4956}
      .cbot-seg{display:flex;gap:4px;margin-top:4px}
      .cbot-seg button{flex:1;padding:6px 0;border:1px solid #dbdbdb;border-radius:8px;background:#fff;
        font-size:12px;font-weight:600;cursor:pointer;color:#262626}
      .cbot-seg button.on{background:#1877f2;border-color:#1877f2;color:#fff}
      #cbot-stats{margin-top:10px;font-size:12px;color:#8e8e8e}
      #cbot-stats b{color:#262626;font-size:14px}
      #cbot-log{margin-top:8px;height:120px;overflow:auto;background:#fafafa;border:1px solid #efefef;
        border-radius:8px;padding:6px;font-size:11px;color:#555;font-family:ui-monospace,monospace}
    `;
    (document.head || document.documentElement).appendChild(style);

    loadSettings(); // 先讀回上次的設定

    const closeBtn = h("span", { id: "cbot-close", title: "收合", text: "—" });
    el.titleSpan = h("span", { text: "🍕 留言小幫手 · " + platform() });
    const head = h("div", { id: "cbot-head" }, [el.titleSpan, closeBtn]);

    // 平台切換：自動 / FB / IG
    const segBtns = {};
    const seg = h("div", { class: "cbot-seg" });
    ["auto", "FB", "IG"].forEach((mode) => {
      const b = h("button", { text: mode === "auto" ? "自動" : mode });
      if (state.platformOverride === mode) b.classList.add("on");
      b.addEventListener("click", () => {
        state.platformOverride = mode;
        Object.values(segBtns).forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        el.titleSpan.textContent = "🍕 留言小幫手 · " + platform();
        saveSettings();
        log(`已切換平台：${platform()}`);
      });
      segBtns[mode] = b;
      seg.appendChild(b);
    });

    el.target = h("div", { id: "cbot-target", text: "尚未選取" });
    const pickBtn = h("button", { class: "cbot-btn", id: "cbot-pick", text: "🎯 選取目標留言" });
    el.autoReply = h("input", { id: "cbot-autoreply", type: "checkbox" });
    el.autoReply.checked = state.autoReply !== false;
    const autoReplyRow = h("label", { style: "display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#262626;cursor:pointer" },
      [el.autoReply, document.createTextNode("每則重新點「回覆」自動帶提及（FB 推薦）")]);
    el.mention = h("input", { id: "cbot-mention", placeholder: "FB填顯示名稱 / IG填@handle（留空=不標記）", value: state.mentionName || "" });
    el.tag = h("input", { id: "cbot-tag", value: state.hashtag || "#LINEMANWongnaiUsersChoicexInnOngsa" });
    el.min = h("input", { id: "cbot-min", type: "number", value: String(state.minSec || 30), min: "3" });
    el.max = h("input", { id: "cbot-max", type: "number", value: String(state.maxSec || 90), min: "3" });
    el.batchSize = h("input", { id: "cbot-batch", type: "number", value: String(state.batchSize ?? 10), min: "0" });
    el.restMin = h("input", { id: "cbot-restmin", type: "number", step: "0.5", value: String(state.restMinMin ?? 5), min: "0" });
    el.restMax = h("input", { id: "cbot-restmax", type: "number", step: "0.5", value: String(state.restMaxMin ?? 8), min: "0" });
    el.bigBatch = h("input", { id: "cbot-bigbatch", type: "number", value: String(state.bigBatchSize ?? 50), min: "0" });
    el.bigRest = h("input", { id: "cbot-bigrest", type: "number", step: "0.5", value: String(state.bigRestMin ?? 15), min: "0" });
    el.maxCount = h("input", { id: "cbot-maxcount", type: "number", value: String(state.maxCount || 0), min: "0" });
    el.startBtn = h("button", { class: "cbot-btn", id: "cbot-start", text: "▶ 開始" });
    el.count = h("b", { id: "cbot-count", text: "0" });
    el.logBox = h("div", { id: "cbot-log" });

    const stats = h("div", { id: "cbot-stats" }, [
      document.createTextNode("已送出："), el.count, document.createTextNode(" 則"),
    ]);
    const row = h("div", { class: "cbot-row" }, [
      h("div", null, [h("label", { text: "最短間隔(秒)" }), el.min]),
      h("div", null, [h("label", { text: "最長間隔(秒)" }), el.max]),
    ]);
    const restRow = h("div", { class: "cbot-row" }, [
      h("div", null, [h("label", { text: "休息最短(分)" }), el.restMin]),
      h("div", null, [h("label", { text: "休息最長(分)" }), el.restMax]),
    ]);
    const bigRow = h("div", { class: "cbot-row" }, [
      h("div", null, [h("label", { text: "大休息門檻(則,0=關)" }), el.bigBatch]),
      h("div", null, [h("label", { text: "大休息(分)" }), el.bigRest]),
    ]);
    const body = h("div", { id: "cbot-body" }, [
      h("label", { text: "平台" }), seg,
      h("label", { text: "目標留言" }), el.target, pickBtn,
      autoReplyRow,
      h("label", { text: "每則 @ 的帳號（選填，模式B/IG 用）" }), el.mention,
      h("label", { text: "活動 Hashtag" }), el.tag,
      row,
      h("label", { text: "每批留言幾則後休息（0=不分批）" }), el.batchSize,
      restRow,
      bigRow,
      h("label", { text: "目標則數（0=不限，達標自動停）" }), el.maxCount,
      el.startBtn, stats, el.logBox,
    ]);

    const p = h("div", { id: "cbot-panel" }, [head, body]);
    document.body.appendChild(p);
    el.panel = p;

    // 改任何欄位就即時存起來
    [el.mention, el.tag, el.min, el.max, el.batchSize, el.restMin, el.restMax, el.bigBatch, el.bigRest, el.maxCount].forEach((inp) =>
      inp.addEventListener("change", () => {
        state.hashtag = el.tag.value.trim() || state.hashtag;
        state.mentionName = el.mention.value.trim();
        state.minSec = Math.max(3, parseInt(el.min.value, 10) || 30);
        state.maxSec = Math.max(state.minSec, parseInt(el.max.value, 10) || 90);
        state.batchSize = Math.max(0, parseInt(el.batchSize.value, 10) || 0);
        state.restMinMin = Math.max(0, parseFloat(el.restMin.value) || 0);
        state.restMaxMin = Math.max(state.restMinMin, parseFloat(el.restMax.value) || 0);
        state.bigBatchSize = Math.max(0, parseInt(el.bigBatch.value, 10) || 0);
        state.bigRestMin = Math.max(0, parseFloat(el.bigRest.value) || 0);
        state.maxCount = Math.max(0, parseInt(el.maxCount.value, 10) || 0);
        saveSettings();
      })
    );

    el.autoReply.addEventListener("change", () => {
      state.autoReply = el.autoReply.checked;
      saveSettings();
    });

    pickBtn.addEventListener("click", enterPickMode);
    el.startBtn.addEventListener("click", () => (state.running ? stop() : start()));
    closeBtn.addEventListener("click", () => {
      body.style.display = body.style.display === "none" ? "block" : "none";
    });

    makeDraggable(p, head);
    log(`面板已就緒（目前平台：${platform()}）。先「選取目標留言」再按開始。`);
  }

  function makeDraggable(panel, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.id === "cbot-close") return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = ox + (e.clientX - sx) + "px";
      panel.style.top = oy + (e.clientY - sy) + "px";
      panel.style.right = "auto";
    });
    document.addEventListener("mouseup", () => (dragging = false));
  }

  if (document.body) buildPanel();
  else window.addEventListener("DOMContentLoaded", buildPanel);
})();
