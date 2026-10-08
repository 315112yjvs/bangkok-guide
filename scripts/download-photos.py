#!/usr/bin/env python3
"""把店家照片從 Google 下載成網站自己的檔案（public/photos/<地點 id>/<n>.jpg）。

下載之後網站直接讀這些檔案，不再向 Google 要照片，也就不再有照片費用。
每張照片只在下載當下向 Google 計費一次（約 US$0.007）。

    python3 scripts/download-photos.py            下載還沒有檔案的照片
    python3 scripts/download-photos.py --dry-run  只列出會下載幾張，不實際下載

爬蟲跑完和後台按「存檔並上傳」時會自動執行，平常不用手動跑。

- 已上架的店下載前 PHOTOS_PER_PLACE 張（第一張是封面）；待審的店只先下載封面。
- 可以中斷後重跑：已存在的檔案會跳過。
- 碰到 Google 配額上限（429）會自己停，隔天再跑即可。
- 下載完會把資料檔裡該店的 photos 改成本機路徑，
  原本的 Google 照片 ref 留在 photo_refs（日後要重抓新照片時用）。

注意：Google 的使用條款不允許長期儲存它的照片。這是站主評估風險後的決定。

需要 Pillow（pip3 install pillow）。
"""
import io
import json
import os
import re
import shutil
import sys
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

PHOTOS_PER_PLACE = 4
FULL_WIDTH = 800     # 地點頁主圖、分享圖
THUMB_WIDTH = 480    # 卡片封面
JPEG_QUALITY = 76
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {
    'approved': os.path.join(ROOT, 'data', 'locations.json'),
    'pending': os.path.join(ROOT, 'data', 'pending.json'),
}
OUT = os.path.join(ROOT, 'public', 'photos')

dry_run = '--dry-run' in sys.argv

env = open(os.path.join(ROOT, '.env.local'), encoding='utf-8').read()
m = re.search(r'^GOOGLE_MAPS_API_KEY=(.*)$', env, re.M)
if not m:
    sys.exit('找不到 GOOGLE_MAPS_API_KEY')
KEY = m.group(1).strip().strip('"\'')

quota_hit = False


def refs_of(loc):
    """這家店的 Google 照片 ref（已切到本機檔的店，ref 存在 photo_refs）"""
    src = loc.get('photo_refs') or loc.get('photos') or []
    return [p for p in src if isinstance(p, str) and p.startswith('places/')]


def save_jpeg(img, width, path):
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(path, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)


def download(task):
    """回傳 'ok' / 'skip' / 'expired' / 'quota' / 'error'"""
    global quota_hit
    loc_id, index, ref = task
    folder = os.path.join(OUT, loc_id)
    full = os.path.join(folder, f'{index}.jpg')
    if os.path.exists(full):
        return 'skip'
    if quota_hit:
        return 'quota'
    url = f'https://places.googleapis.com/v1/{ref}/media?maxWidthPx=1000&key={KEY}'
    # 用系統的 curl 下載：macOS 內建的 Python 常缺根憑證，urllib 會連不上
    # Google 對照片有「每分鐘」的頻率限制，429 多半只是抓太快：等一下再試。
    # 連續重試都還是 429 才當成當日配額用完，整批停下來。
    code, body = '', b''
    for attempt in range(6):
        if quota_hit:
            return 'quota'
        try:
            res = subprocess.run(
                ['curl', '-sS', '-L', '--max-time', '40', '-H', 'Referer: https://www.bkk-local.com/',
                 '-o', '-', '-w', '\n%{http_code}', url],
                capture_output=True, timeout=60)
        except Exception:
            return 'error'
        body, _, raw = res.stdout.rpartition(b'\n')
        code = raw.decode('ascii', 'ignore').strip()
        if code != '429':
            break
        time.sleep(15 * (attempt + 1))
    if code == '429':
        quota_hit = True
        return 'quota'
    if code in ('400', '403', '404'):
        # 照片 ref 過期，要先跑 refresh-photo-refs.mjs 換新 ref
        return 'expired'
    if code != '200':
        return 'error'
    data = body
    try:
        img = Image.open(io.BytesIO(data)).convert('RGB')
    except Exception:
        return 'error'
    os.makedirs(folder, exist_ok=True)
    save_jpeg(img, FULL_WIDTH, full)
    if index == 0:
        save_jpeg(img, THUMB_WIDTH, os.path.join(folder, '0-480.jpg'))
    return 'ok'


# 已上架的店下載前 PHOTOS_PER_PLACE 張；待審的店只先下載封面（審核時要看，被駁回也只花一張的錢），
# 上架後再補齊其餘幾張。這樣每張照片從頭到尾只向 Google 付一次費。
def wanted(kind):
    return PHOTOS_PER_PLACE if kind == 'approved' else 1


def load(path):
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else []


tasks = []
seen = set()
for kind, path in FILES.items():
    for loc in load(path):
        for i, ref in enumerate(refs_of(loc)[:wanted(kind)]):
            key = (loc['id'], i)
            if key in seen or os.path.exists(os.path.join(OUT, loc['id'], f'{i}.jpg')):
                continue
            seen.add(key)
            tasks.append((loc['id'], i, ref))

# 先下載封面，再下載其餘照片：中途停下來時，至少每家店的卡片都有圖
tasks.sort(key=lambda t: t[1])

print(f'這次要下載 {len(tasks)} 張（約 US${len(tasks) * 0.007:.2f}）')

stats = {}
if tasks and not dry_run:
    with ThreadPoolExecutor(max_workers=3) as pool:
        for n, result in enumerate(pool.map(download, tasks), 1):
            stats[result] = stats.get(result, 0) + 1
            if n % 100 == 0:
                print(f'  {n}/{len(tasks)} …')
    print('結果：', json.dumps(stats, ensure_ascii=False))

if not dry_run:
    # 把已經有檔案的店切換成本機路徑。寫檔前重新讀一次資料檔、只改照片欄位，
    # 盡量不蓋掉後台在下載期間做的其他修改。
    switched = 0
    live_ids = set()
    for kind, path in FILES.items():
        if not os.path.exists(path):
            continue
        fresh = load(path)
        changed = False
        for loc in fresh:
            live_ids.add(loc['id'])
            local = []
            for i in range(PHOTOS_PER_PLACE):
                if os.path.exists(os.path.join(OUT, loc['id'], f'{i}.jpg')):
                    local.append(f"/photos/{loc['id']}/{i}.jpg")
                else:
                    break
            if not local:
                continue
            refs = refs_of(loc)
            if refs and loc.get('photo_refs') != refs:
                loc['photo_refs'] = refs
                changed = True
            if loc.get('photos') != local:
                loc['photos'] = local
                switched += 1
                changed = True
        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(fresh, f, ensure_ascii=False, indent=2)
    print(f'已切換成本機照片的店：這次 {switched} 家')

    # 被駁回或下架的店，照片資料夾一併清掉
    removed = 0
    if live_ids and os.path.isdir(OUT):
        for name in os.listdir(OUT):
            folder = os.path.join(OUT, name)
            if os.path.isdir(folder) and re.fullmatch(r'[0-9a-f-]{36}', name) and name not in live_ids:
                shutil.rmtree(folder)
                removed += 1
    if removed:
        print(f'清掉已不存在的店的照片資料夾：{removed} 個')

    if quota_hit:
        print('Google 當日照片配額已用完，剩下的明天再跑一次即可（已下載的都保留）。')
    if stats.get('expired'):
        print('有照片 ref 過期：先跑 node scripts/refresh-photo-refs.mjs 再重跑這支。')
