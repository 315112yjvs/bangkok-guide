#!/usr/bin/env python3
"""
Ticketmaster 掉落票監控 v3
- 三場次同時並行（asyncio）
- Network request 攔截（精準偵測）
- 隨機間隔（反反爬蟲）
- 每小時心跳
- 有票時推 Telegram + LINE（含價格）
"""

import asyncio
import json
import re
import random
import sys
import time
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import requests as req_sync
warnings.filterwarnings("ignore")

from playwright.async_api import async_playwright, TimeoutError as PWTimeout

BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "config.json"


# ── config ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        print(f"[錯誤] 找不到 {CONFIG_FILE}")
        sys.exit(1)
    return json.loads(CONFIG_FILE.read_text())


# ── 通知 ──────────────────────────────────────────────────────────────────────

def notify_all(cfg: dict, msg: str):
    tg_token = cfg.get("telegram_bot_token", "")
    tg_chat  = cfg.get("telegram_chat_id", "")
    ln_token = cfg.get("line_channel_access_token", "")
    ln_uid   = cfg.get("line_user_id", "")

    if tg_token and tg_chat:
        try:
            req_sync.post(
                f"https://api.telegram.org/bot{tg_token}/sendMessage",
                json={"chat_id": tg_chat, "text": msg},
                timeout=10, verify=False,
            )
        except Exception as e:
            print(f"  [Telegram 失敗] {e}")

    if ln_token and ln_uid:
        try:
            r = req_sync.post(
                "https://api.line.me/v2/bot/message/push",
                headers={"Authorization": f"Bearer {ln_token}", "Content-Type": "application/json"},
                json={"to": ln_uid, "messages": [{"type": "text", "text": msg}]},
                timeout=10, verify=False,
            )
            if r.status_code != 200:
                print(f"  [LINE 失敗] {r.status_code}: {r.text[:80]}")
        except Exception as e:
            print(f"  [LINE 失敗] {e}")


# ── 偵測邏輯 ──────────────────────────────────────────────────────────────────

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


def parse_price(data: dict) -> str:
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


def parse_api_response(data: dict) -> dict | None:
    text = json.dumps(data).lower()
    for sig in ["soldout", "sold_out", "not_available"]:
        if f'"{sig}": true' in text or f'"{sig}":true' in text:
            return {"available": False, "reason": f"api:{sig}=true", "price": ""}
    for k in ["availablecount", "available_count", "remainingtickets"]:
        m = re.search(rf'"{k}"\s*:\s*(\d+)', text)
        if m:
            n = int(m.group(1))
            return {"available": n > 0, "reason": f"api:{k}={n}", "price": parse_price(data) if n > 0 else ""}
    for val in ['"onsale"', '"on_sale"', '"active"']:
        if val in text:
            return {"available": True, "reason": f"api:status={val}", "price": parse_price(data)}
    return None


async def check_event(context, event: dict) -> dict:
    page = await context.new_page()
    captured: list[dict] = []

    async def on_response(response):
        if any(p in response.url.lower() for p in INTERCEPT_PATTERNS):
            try:
                captured.append(await response.json())
            except Exception:
                pass

    page.on("response", on_response)
    try:
        await page.goto(event["url"], wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except PWTimeout:
            pass
    except Exception as e:
        await page.close()
        return {"available": False, "reason": f"goto-error: {e}", "price": ""}
    finally:
        page.remove_listener("response", on_response)

    # API response 優先
    for data in captured:
        result = parse_api_response(data)
        if result is not None:
            await page.close()
            return result

    # HTML fallback
    try:
        text    = (await page.inner_text("body")).lower()
        content = await page.content()

        btns = await page.locator(
            "button:visible:not([disabled]), [role='button']:visible, a:visible"
        ).all_text_contents()
        for b in btns:
            for sig in AVAILABLE_KEYWORDS:
                if sig in b.lower():
                    pm = re.search(r"\$[\d,]+(?:\.\d{2})?", content)
                    await page.close()
                    return {"available": True, "reason": f"html-btn:{b.strip()[:40]}", "price": pm.group(0) if pm else ""}

        for sig in SOLD_OUT_KEYWORDS:
            if sig in text:
                await page.close()
                return {"available": False, "reason": f"html:{sig}", "price": ""}

        ld = re.search(r'"availability"\s*:\s*"([^"]+)"', content)
        if ld:
            val = ld.group(1)
            await page.close()
            return {"available": "InStock" in val, "reason": f"json-ld:{val}", "price": ""}
    except Exception as e:
        await page.close()
        return {"available": False, "reason": f"html-error:{e}", "price": ""}

    await page.close()
    return {"available": False, "reason": "no signal", "price": ""}


# ── 主循環 ────────────────────────────────────────────────────────────────────

async def main():
    cfg          = load_config()
    events       = cfg["events"]
    interval_min = cfg.get("interval_min", 25)
    interval_max = cfg.get("interval_max", 40)
    heartbeat_m  = cfg.get("heartbeat_minutes", 60)

    print("=" * 58)
    print("  Ticketmaster 掉落票監控 v3（並行）")
    for e in events:
        print(f"  📅 {e['name']}")
    print(f"  間隔：{interval_min}–{interval_max} 秒（隨機）")
    print(f"  心跳：每 {heartbeat_m} 分鐘")
    print(f"  Telegram：{'✓' if cfg.get('telegram_bot_token') else '✗'}")
    print(f"  LINE：     {'✓' if cfg.get('line_channel_access_token') else '✗'}")
    print("=" * 58)

    event_list = "\n".join(f"  {e['name']}" for e in events)
    notify_all(cfg, f"🔍 監控啟動（3 場次同時並行）\n{event_list}\n間隔 {interval_min}–{interval_max}s 隨機")

    notified   = {e["id"]: False for e in events}
    last_beat  = datetime.now()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="en-US",
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )

        while True:
            ts = datetime.now().strftime("%H:%M:%S")

            # 心跳
            if (datetime.now() - last_beat).total_seconds() >= heartbeat_m * 60:
                lines = []
                for e in events:
                    icon = "🟢" if notified[e["id"]] else "🔴"
                    lines.append(f"{icon} {e['name']}")
                notify_all(cfg, "💓 監控中\n" + "\n".join(lines))
                print(f"[{ts}] 💓 心跳推送")
                last_beat = datetime.now()

            # 三場同時並行
            print(f"[{ts}] 🔄 同時檢查 {len(events)} 場...")
            results = await asyncio.gather(
                *[check_event(context, e) for e in events],
                return_exceptions=True,
            )

            for event, result in zip(events, results):
                ts2  = datetime.now().strftime("%H:%M:%S")
                eid  = event["id"]

                if isinstance(result, Exception):
                    print(f"[{ts2}] ❌ {event['name']}: {result}")
                    continue

                avail     = result["available"]
                reason    = result["reason"]
                price     = result["price"]
                price_str = f" ({price})" if price else ""
                icon      = "🟢" if avail else "🔴"

                print(f"  {icon} {event['name']}{price_str}  [{reason}]")

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
                    notified[eid] = False

            sleep_sec = random.uniform(interval_min, interval_max)
            print(f"  ↩ 等待 {sleep_sec:.0f}s 後下一輪...\n")
            await asyncio.sleep(sleep_sec)


if __name__ == "__main__":
    asyncio.run(main())
