#!/usr/bin/env python3
"""
Ticketmaster 掉落票監控（Playwright 版）
用真實 Chromium 繞過反爬蟲，偵測座位亮起時推 Telegram
"""

import json
import time
import sys
import re
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "config.json"

DEFAULT_CONFIG = {
    "event_id":   "0A006429B2CB6418",
    "event_url":  "https://www.ticketmaster.com/bts-world-tour-arirang-in-los-inglewood-california-09-05-2026/event/0A006429B2CB6418",
    "event_name": "BTS World Tour: ARIRANG – Inglewood 09/05/2026",
    "interval_seconds": 30,
    "telegram_bot_token": "",
    "telegram_chat_id": "",
}


def load_config() -> dict:
    if CONFIG_FILE.exists():
        cfg = json.loads(CONFIG_FILE.read_text())
        for k, v in DEFAULT_CONFIG.items():
            cfg.setdefault(k, v)
        return cfg
    CONFIG_FILE.write_text(json.dumps(DEFAULT_CONFIG, indent=2, ensure_ascii=False))
    print(f"[設定] 已建立 {CONFIG_FILE}")
    sys.exit(1)


def telegram(token: str, chat_id: str, msg: str):
    if not token or not chat_id:
        return
    import requests
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": msg},
            timeout=10,
            verify=False,  # bypass macOS SSL cert issue
        )
    except Exception as e:
        print(f"  [Telegram 失敗] {e}")


# ── 可用性判斷 ────────────────────────────────────────────────────────────────

SOLD_OUT_SIGNALS = [
    "sold out",
    "currently unavailable",
    "check back soon",
    "tickets are not available",
    "no tickets available",
]

AVAILABLE_SIGNALS = [
    "find tickets",
    "buy tickets",
    "get tickets",
    "select tickets",
    "add to cart",
]

def check_page(page) -> dict:
    """
    回傳 {"available": bool, "reason": str, "price_info": str}
    """
    # 等頁面主要內容載入
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except PWTimeout:
        pass

    # 截取頁面文字（小寫）
    text = (page.inner_text("body") or "").lower()

    # 找票價資訊
    price_match = re.search(r"\$[\d,]+(?:\.\d{2})?", page.content())
    price_info  = price_match.group(0) if price_match else ""

    # 判斷「有票」的 button / link
    for sig in AVAILABLE_SIGNALS:
        # 找 button 或 a 帶有這些文字，且非 disabled
        elems = page.locator(
            f'button:visible:not([disabled]), a:visible, [role="button"]:visible'
        ).all_text_contents()
        for t in elems:
            if sig in t.lower():
                return {"available": True, "reason": f"button: {t.strip()[:60]}", "price_info": price_info}

    # 判斷「售完」
    for sig in SOLD_OUT_SIGNALS:
        if sig in text:
            return {"available": False, "reason": f"keyword: {sig}", "price_info": ""}

    # 找 schema.org availability
    content = page.content()
    ld = re.search(r'"availability"\s*:\s*"([^"]+)"', content)
    if ld:
        avail_val = ld.group(1)
        is_avail  = "InStock" in avail_val or "PreOrder" in avail_val
        return {"available": is_avail, "reason": f"json-ld: {avail_val}", "price_info": price_info}

    # 找「Find Tickets」相關按鈕（比對 aria-label / data-* 屬性）
    find_btn = page.locator('[data-testid*="ticket"], [aria-label*="ticket" i], [class*="find-ticket" i]')
    if find_btn.count() > 0:
        return {"available": True, "reason": "ticket widget found", "price_info": price_info}

    return {"available": False, "reason": "no signal", "price_info": ""}


# ── 主循環 ────────────────────────────────────────────────────────────────────

def run():
    cfg        = load_config()
    event_url  = cfg["event_url"]
    event_name = cfg["event_name"]
    interval   = cfg["interval_seconds"]
    tg_token   = cfg["telegram_bot_token"]
    tg_chat    = cfg["telegram_chat_id"]

    print("=" * 55)
    print("  Ticketmaster 掉落票監控")
    print(f"  場次：{event_name}")
    print(f"  間隔：{interval} 秒")
    print(f"  Telegram：{'✓' if tg_token else '✗ 未設定'}")
    print("=" * 55)

    telegram(tg_token, tg_chat,
             f"🔍 監控啟動\n{event_name}\n每 {interval} 秒檢查一次\n{event_url}")

    notified = False

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="en-US",
        )
        # 遮蔽 webdriver 特徵
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)
        page = context.new_page()

        while True:
            ts = datetime.now().strftime("%H:%M:%S")
            try:
                page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
                result  = check_page(page)
                avail   = result["available"]
                reason  = result["reason"]
                price   = result["price_info"]

                icon = "🟢" if avail else "🔴"
                price_str = f" ({price})" if price else ""
                print(f"[{ts}] {icon} {'有票！' if avail else '售完'}  [{reason}]{price_str}")

                if avail and not notified:
                    msg = (
                        f"🎟️ 有票掉落！快去搶！\n"
                        f"{event_name}\n"
                        f"{price_str.strip()}\n"
                        f"{event_url}"
                    )
                    telegram(tg_token, tg_chat, msg)
                    print("  → Telegram 通知已送出")
                    notified = True
                elif not avail and notified:
                    notified = False

            except PWTimeout:
                print(f"[{ts}] ⏳ 頁面超時，下次再試")
            except Exception as e:
                print(f"[{ts}] ❌ 錯誤: {e}")

            time.sleep(interval)


if __name__ == "__main__":
    run()
