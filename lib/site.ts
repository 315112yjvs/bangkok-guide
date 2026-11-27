// 客製行程服務的聯絡連結（LINE、IG 私訊或表單網址）。
// 留空時，全站的「客製行程」按鈕和 /trip 頁都不會出現；填好推上去就會自動顯示。
export const TRIP_CONTACT_URL: string = ''

export const tripEnabled = TRIP_CONTACT_URL !== ''

// 暫時隱藏的分類（店太少或還沒整理好）：首頁頁籤、全部列表、分類頁、區域頁、主題頁、sitemap 都不出現。
// 這些店的單店頁面還在（舊連結不會壞），但標成不給搜尋引擎收錄。拿掉陣列裡的名字就恢復。
export const HIDDEN_CATEGORIES: readonly string[] = ['shopping', 'nightlife', 'hotel']
export const isHiddenCategory = (c: string) => HIDDEN_CATEGORIES.includes(c)
// 站主勾了「曼谷人帶你去」的店不受隱藏限制（例如拍了 Jellycat 這種購物類的店）
export const isListed = (l: { category: string; featured?: boolean }) => !isHiddenCategory(l.category) || !!l.featured

// 站主 IG：首頁、店家頁、/ig 頁的追蹤按鈕都用這裡
export const INSTAGRAM_HANDLE = 'bkklocal555'
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`
