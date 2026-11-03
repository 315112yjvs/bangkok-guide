// 客製行程服務的聯絡連結（LINE、IG 私訊或表單網址）。
// 留空時，全站的「客製行程」按鈕和 /trip 頁都不會出現；填好推上去就會自動顯示。
export const TRIP_CONTACT_URL: string = ''

export const tripEnabled = TRIP_CONTACT_URL !== ''

// 暫時隱藏的分類（店太少或還沒整理好）：首頁頁籤、全部列表、分類頁、區域頁、主題頁、sitemap 都不出現。
// 這些店的單店頁面還在（舊連結不會壞），但標成不給搜尋引擎收錄。拿掉陣列裡的名字就恢復。
export const HIDDEN_CATEGORIES: readonly string[] = ['shopping', 'nightlife', 'hotel']
export const isHiddenCategory = (c: string) => HIDDEN_CATEGORIES.includes(c)
