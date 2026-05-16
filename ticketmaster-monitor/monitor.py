#!/usr/bin/env python3
"""
Ticketmaster 掉落票監控 v2
- 三場次同時監控
- Network request 攔截（精準偵測，不靠關鍵字）
- 隨機間隔（反反爬蟲）
- 每小時心跳確認監控仍在線
- 有票時推送場次 + 價格區間
"""

import json
import time
import sys
import re
import random
from datetime import datetime, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
import requests
import warnings
warnings.filterwarnings("ignore")

BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "config.json"


# ── config ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        print(f"[錯誤] 找不到 {CONFIG_FILE}")
        sys.exit(1)
    return json.loads(CONFIG_FILE.read_text())


# ── 通知 ──────────────────────────────────────────────────────────────────────

def telegram(token: str, chat_id: str, msg: str):
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": msg},
            timeout=10, verify=False,
        )
    except Exception as e:
        print(f"  [Telegram 失敗] {e}")


def line_push(channel_token: str, user_id: str, msg: str):
    if not channel_token or not user_id:
        return
    try:
        r = requests.post(
            "https://api.line.me/v2/bot/message/push",
            headers={"Authorization": f"Bearer {channel_token}", "Content-Type": "application/json"},
            json={"to": user_id, "messages": [{"type": "text", "text": msg}]},
            timeout=10, verify=False,
        )
        if r.status_code != 200:
            print(f"  [LINE 失敗] {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"  [LINE 失敗] {e}")


def notify_all(cfg: dict, msg: str):
    telegram(cfg.get("telegram_bot_token", ""), cfg.get("telegram_chat_id", ""), msg)
    line_push(cfg.get("line_channel_access_token", ""), cfg.get("line_user_id", ""), msg)


# ── 偵測邏輯 ──────────────────────────────────────────────────────────────────

# 攔截這些 URL pattern 的 network response
INTERCEPT_PATTERNS = [
    "inventory", "availability", "offers", "seatmap",
    "pricing", "price", "seats", "ticket",
]

SOLD_OUT_KEYWORDS = [
    "sold out", "currently unavailable", "check back soon",
    "no tickets available", "tickets are not available",
]

AVAILABLE_KEYWORDS = [
    "find tickets", "buy tickets", "get tickets",
    "select tickets", "add to cart",
]


def parse_price_from_data(data: dict) -> str:
    """從 API response 撈價格區間"""
    prices = []

    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.lower() in ("price", "amount", "minprice", "maxprice", "listprice", "facevalue"):
                    try:
                        prices.append(float(v))
                    except (TypeError, ValueError):
                        pass
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    if prices:
        lo, hi = min(prices), max(prices)
        return f"${lo:.0f}" if lo == hi else f"${lo:.0f}–${hi:.0f}"
    return ""


def parse_available_from_data(data: dict) -> dict | None:
    """
    嘗試從攔截到的 JSON 判斷有無票。
    回傳 {"available": bool, "reason": str, "price": str} 或 None（無法判斷）
    """
    text = json.dumps(data).lower()

    # 明確售完訊號
    for sig in ["soldout", "sold_out", "not_available", "unavailable"]:
        if f'"{sig}": true' in text or f'"{sig}":true' in text:
            return {"available": False, "reason": f"api: {sig}=true", "price": ""}

    # 明確有票訊號
    avail_count = 0
    for k in ["availablecount", "available_count", "remainingtickets", "available"]:
        match = re.search(rf'"{k}"\s*:\s*(\d+)', text)
        if match:
            n = int(match.group(1))
            if n > 0:
                avail_count = n
                price = parse_price_from_data(data)
                return {"available": True, "reason": f"api: {k}={n}", "price": price}
            else:
                return {"available": False, "reason": f"api: {k}=0", "price": ""}

    # onsale / status 欄位
    for status_val in ['"onsale"', '"on_sale"', '"active"']:
        if status_val in text:
            price = parse_price_from_data(data)
            return {"available": True, "reason": f"api: status={status_val}", "price": price}

    return None


def check_event(page, event: dict) -> dict:
    """
    回傳 {"available": bool, "reason": str, "price": str}
    """
    captured: list[dict] = []

    def on_response(response):
        url = response.url.lower()
        if any(p in url for p in INTERCEPT_PATTERNS):
            try:
                data = response.json()
                captured.append(data)
            except Exception:
                pass

    page.on("response", on_response)
    try:
        page.goto(event["url"], wait_until="domcontentloaded", timeout=30000)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except PWTimeout:
            pass
    finally:
        page.remove_listener("response", on_response)

    # 優先用攔截到的 API response 判斷
    for data in captured:
        result = parse_available_from_data(data)
        if result is not None:
            return result

    # Fallback：HTML 關鍵字
    try:
        text = page.inner_text("body").lower()
        content = page.content()

        for sig in AVAILABLE_KEYWORDS:
            btns = page.locator(
                "button:visible:not([disabled]), [role='button']:visible, a:visible"
            ).all_text_contents()
            for b in btns:
                if sig in b.lower():
                    price_match = re.search(r"\$[\d,]+(?:\.\d{2})?", content)
                    price = price_match.group(0) if price_match else ""
                    return {"available": True, "reason": f"html-button: {b.strip()[:40]}", "price": price}

        for sig in SOLD_OUT_KEYWORDS:
            if sig in text:
                return {"available": False, "reason": f"html-keyword: {sig}", "price": ""}

        ld = re.search(r'"availability"\s*:\s*"([^"]+)"', content)
        if ld:
            val = ld.group(1)
            return {"available": "InStock" in val, "reason": f"json-ld: {val}", "price": ""}

    except Exception as e:
        return {"available": False, "reason": f"html-error: {e}", "price": ""}

    return {"available": False, "reason": "no signal", "price": ""}


# ── 主循環 ────────────────────────────────────────────────────────────────────

def run():
    cfg          = load_config()
    events       = cfg["events"]
    interval_min = cfg.get("interval_min", 25)
    interval_max = cfg.get("interval_max", 40)
    heartbeat_m  = cfg.get("heartbeat_minutes", 60)

    print("=" * 58)
    print("  Ticketmaster 掉落票監控 v2")
    for e in events:
        print(f"  📅 {e['name']}")
    print(f"  間隔：{interval_min}–{interval_max} 秒（隨機）")
    print(f"  心跳：每 {heartbeat_m} 分鐘")
    print(f"  Telegram：{'✓' if cfg.get('telegram_bot_token') else '✗'}")
    print(f"  LINE：     {'✓' if cfg.get('line_channel_access_token') else '✗'}")
    print("=" * 58)

    # 啟動通知
    event_list = "\n".join(f"  {e['name']}" for e in events)
    notify_all(cfg, f"🔍 監控啟動（3 場次）\n{event_list}\n間隔 {interval_min}–{interval_max}s 隨機")

    # 每個 event 的狀態
    notified  = {e["id"]: False for e in events}
    last_beat = datetime.now()

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
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        page = context.new_page()

        while True:
            ts = datetime.now().strftime("%H:%M:%S")

            # ── 心跳 ──────────────────────────────────────────────────────────
            if (datetime.now() - last_beat).total_seconds() >= heartbeat_m * 60:
                status_lines = []
                for e in events:
                    icon = "🟢" if notified[e["id"]] else "🔴"
                    status_lines.append(f"{icon} {e['name']}")
                heartbeat_msg = "💓 監控中\n" + "\n".join(status_lines)
                notify_all(cfg, heartbeat_msg)
                print(f"[{ts}] 💓 心跳推送")
                last_beat = datetime.now()

            # ── 逐一檢查每場 ──────────────────────────────────────────────────
            for event in events:
                ts = datetime.now().strftime("%H:%M:%S")
                eid = event["id"]
                try:
                    result = check_event(page, event)
                    avail  = result["available"]
                    reason = result["reason"]
                    price  = result["price"]

                    icon = "🟢" if avail else "🔴"
                    price_str = f" ({price})" if price else ""
                    print(f"[{ts}] {icon} {event['name']}{price_str}  [{reason}]")

                    if avail and not notified[eid]:
                        msg = (
                            f"🎟️ 有票掉落！快去搶！\n"
                            f"{event['name']}\n"
                            f"{price_str.strip()}\n"
                            f"{event['url']}"
                        )
                        notify_all(cfg, msg)
                        print(f"  → Telegram + LINE 通知已送出")
                        notified[eid] = True

                    elif not avail and notified[eid]:
                        notified[eid] = False  # 票沒了，重置，等下次掉票再通知

                except PWTimeout:
                    print(f"[{ts}] ⏳ {event['name']} 頁面超時，跳過")
                except Exception as e:
                    print(f"[{ts}] ❌ {event['name']} 錯誤: {e}")

                # 每場之間短暫停頓，避免連打太快
                time.sleep(random.uniform(3, 6))

            # ── 隨機等待再下一輪 ──────────────────────────────────────────────
            sleep_sec = random.uniform(interval_min, interval_max)
            print(f"  ↩ 等待 {sleep_sec:.0f}s 後下一輪...")
            time.sleep(sleep_sec)


if __name__ == "__main__":
    run()
