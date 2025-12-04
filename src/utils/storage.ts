/**
 * 持久化快取工具 (Persistent Storage)
 * 使用 localStorage 儲存資料，支援過期時間 (TTL)
 */

interface CacheItem<T> {
    value: T;
    timestamp: number;
    expiry: number; // 過期時間戳記
}

class PersistentStorage {
    private prefix: string = 'stock_app_cache_';
    private defaultTTL: number = 24 * 60 * 60 * 1000; // 預設 24 小時

    /**
     * 儲存資料
     * @param key 鍵名
     * @param value 資料
     * @param ttl 有效期 (毫秒)，預設 24 小時
     */
    set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
        const now = Date.now();
        const item: CacheItem<T> = {
            value,
            timestamp: now,
            expiry: now + ttl,
        };

        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(item));
        } catch (e) {
            console.warn('Storage quota exceeded or error', e);
            // 如果空間不足，可以考慮清除舊的快取 (這裡暫時簡單處理)
            this.clearExpired();
        }
    }

    /**
     * 獲取資料
     * @param key 鍵名
     * @returns 資料或 null (若不存在)
     * 注意：即使過期也會回傳 (為了支援離線/後端當機模式)，
     * 呼叫者應自行檢查 isExpired 來決定是否重新抓取。
     */
    get<T>(key: string): { value: T; isExpired: boolean; timestamp: number } | null {
        const itemStr = localStorage.getItem(this.prefix + key);
        if (!itemStr) return null;

        try {
            const item: CacheItem<T> = JSON.parse(itemStr);
            const now = Date.now();
            return {
                value: item.value,
                isExpired: now > item.expiry,
                timestamp: item.timestamp
            };
        } catch (e) {
            console.error('Parse storage item error', e);
            return null;
        }
    }

    /**
     * 移除資料
     * @param key 鍵名
     */
    remove(key: string): void {
        localStorage.removeItem(this.prefix + key);
    }

    /**
     * 清除所有相關快取
     */
    clearAll(): void {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * 清除已過期的快取 (釋放空間用)
     */
    clearExpired(): void {
        const now = Date.now();
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.prefix)) {
                try {
                    const itemStr = localStorage.getItem(key);
                    if (itemStr) {
                        const item: CacheItem<any> = JSON.parse(itemStr);
                        if (now > item.expiry) {
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }
        });
    }
}

export const storage = new PersistentStorage();
