/**
 * 請求隊列 (Request Queue)
 * 限制同時發出的非同步請求數量
 */

type Task<T> = () => Promise<T>;

class RequestQueue {
    private queue: { task: Task<any>; resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];
    private activeCount: number = 0;
    private concurrency: number;

    constructor(concurrency: number = 3) {
        this.concurrency = concurrency;
    }

    /**
     * 加入請求到隊列
     * @param task 回傳 Promise 的函式
     * @returns Promise
     */
    add<T>(task: Task<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processNext();
        });
    }

    private processNext() {
        if (this.activeCount >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        this.activeCount++;

        // 執行任務
        item.task()
            .then(item.resolve)
            .catch(item.reject)
            .finally(() => {
                this.activeCount--;
                this.processNext();
            });
    }

    /**
     * 獲取當前隊列長度 (除錯用)
     */
    get pendingCount() {
        return this.queue.length;
    }
}

// 建立全域單例，限制併發數為 3 (保守設定，避免後端壓力)
export const apiQueue = new RequestQueue(3);
