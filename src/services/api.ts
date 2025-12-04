import { Stock, StockDetail, ApiResponse, StockFilterParams, ApiError, HistoricalData, HistoricalPrediction } from '../types/stock';
import { storage } from '../utils/storage';
import { apiQueue } from '../utils/requestQueue';

// API 基礎 URL
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_BASE_URL;

// 定義後端回傳的 Stock 格式
interface BackendStock {
  symbol: string | number;
  stock_name: string;
  keywords: string[];
}

// 輔助函式：將 BackendStock 轉換為前端 Stock 格式 (初始狀態)
const mapToFrontendStock = (item: BackendStock): Stock => ({
  code: String(item.symbol),
  name: item.stock_name,
  currentPrice: 10, // Mock 值，稍後更新
  predictedPrice1: 0,
  predictedPrice2: 0,
  change1: 0,
  changePercent1: 0,
  change2: 0,
  changePercent2: 0,
  averageChange: 0,
  averageChangePercent: 0
});

/**
 * 核心請求函式 (包含快取與佇列邏輯)
 * @param key 快取鍵值
 * @param fetcher 實際請求函式
 * @param forceRefresh 是否強制刷新 (忽略快取)
 */
async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  forceRefresh: boolean = false
): Promise<T> {
  // 1. 嘗試讀取快取
  const cached = storage.get<T>(key);

  // 若有快取且未過期，且不強制刷新 -> 直接回傳
  if (cached && !cached.isExpired && !forceRefresh) {
    return cached.value;
  }

  try {
    // 2. 透過 Queue 執行請求
    const data = await apiQueue.add(fetcher);

    // 3. 請求成功，寫入快取
    storage.set(key, data);
    return data;
  } catch (error) {
    console.warn(`Fetch failed for ${key}, trying fallback...`, error);

    // 4. 請求失敗 (後端當機)，嘗試回傳過期快取
    if (cached) {
      console.info(`Returning stale cache for ${key}`);
      return cached.value;
    }

    // 若無任何快取，則拋出錯誤
    throw error;
  }
}

/**
 * 獲取所有股票列表
 * @returns Promise<ApiResponse<Stock[]>>
 */
export async function fetchStocks(): Promise<ApiResponse<Stock[]>> {
  const cacheKey = 'stocks_list';

  try {
    // 定義實際獲取邏輯
    const fetchLogic = async () => {
      // 1. 獲取股票列表
      const response = await fetch(`${API_BASE_URL}/api/v1/stocks`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data: BackendStock[] = await response.json();

      // 2. 轉換為前端格式
      const stocks: Stock[] = data.map(mapToFrontendStock);

      // 3. 為每支股票獲取預測價格 (使用 Queue 限制併發)
      // 注意：這裡我們不使用 fetchWithCache 包裹內部的單一請求，避免過度複雜，
      // 而是讓 fetchStocks 整體作為一個快取單位，或者內部細粒度快取。
      // 考量效能，我們讓 fetchStocks 快取最終結果。

      const stocksWithPrices = await Promise.all(stocks.map(async (stock) => {
        try {
          // 使用 apiQueue 限制併發請求
          return await apiQueue.add(async () => {
            const [llmRes, neuralRes, priceRes] = await Promise.allSettled([
              fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prediction?method=llm`),
              fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prediction?method=neuralprophet`),
              fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prices?limit=1`)
            ]);

            let price1 = 0;
            let price2 = 0;
            let currentPrice = stock.currentPrice;

            // 解析現價
            if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
              try {
                const json = await priceRes.value.json();
                const data = typeof json === 'string' ? JSON.parse(json) : json;
                if (Array.isArray(data) && data.length > 0) {
                  currentPrice = data[0].close_price;
                }
              } catch (e) { /* ignore */ }
            }

            // 解析 NeuralProphet
            if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
              try {
                const json = await neuralRes.value.json();
                const val = typeof json === 'string' ? JSON.parse(json) : json;
                const items = val?.neuralprophet;
                if (Array.isArray(items) && items.length > 0) price1 = items[0].price;
                else if (items?.price) price1 = items.price;
              } catch (e) { /* ignore */ }
            }

            // 解析 LLM
            if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
              try {
                const json = await llmRes.value.json();
                const val = typeof json === 'string' ? JSON.parse(json) : json;
                const items = val?.llm;
                if (Array.isArray(items) && items.length > 0) price2 = items[0].price;
                else if (items?.price) price2 = items.price;
              } catch (e) { /* ignore */ }
            }

            const change1 = price1 - currentPrice;
            const change2 = price2 - currentPrice;
            const averageChange = (change1 + change2) / 2;

            return {
              ...stock,
              currentPrice,
              predictedPrice1: price1,
              predictedPrice2: price2,
              change1,
              changePercent1: currentPrice !== 0 ? Number(((change1 / currentPrice) * 100).toFixed(2)) : 0,
              change2,
              changePercent2: currentPrice !== 0 ? Number(((change2 / currentPrice) * 100).toFixed(2)) : 0,
              averageChange,
              averageChangePercent: currentPrice !== 0 ? Number(((averageChange / currentPrice) * 100).toFixed(2)) : 0
            };
          });
        } catch (e) {
          console.warn(`Failed to fetch prices for ${stock.code}`, e);
          return stock;
        }
      }));

      return {
        success: true,
        data: stocksWithPrices,
        timestamp: new Date().toISOString()
      };
    };

    // 使用 fetchWithCache 包裹整個列表獲取
    const result = await fetchWithCache<ApiResponse<Stock[]>>(cacheKey, fetchLogic);

    // [NEW] 觸發背景預載 (不等待完成)
    prefetchAllStocksDetails(result.data).catch(err => console.error('Prefetch error:', err));

    return result;

  } catch (error) {
    console.error('Fetch stocks error:', error);
    throw {
      code: 'FETCH_STOCKS_ERROR',
      message: error instanceof Error ? error.message : '獲取股票列表失敗',
      details: error
    } as ApiError;
  }
}

/**
 * 背景預載所有股票的詳細資料與歷史數據
 * @param stocks 股票列表
 */
async function prefetchAllStocksDetails(stocks: Stock[]) {
  console.log('Starting background prefetch for', stocks.length, 'stocks...');

  for (const stock of stocks) {
    // 檢查是否已有快取，若有則跳過 (避免重複請求)
    // 注意：這裡我們只檢查 storage 是否存在，不管是否過期，
    // 因為如果剛載入頁面，通常是空的；如果是重新整理，可能有舊的。
    // 為了確保資料最新，我們可以檢查 isExpired。
    // 但為了避免過多請求，如果已有未過期快取，就跳過。

    const detailKey = `stock_detail_${stock.code}`;
    const historyKey = `stock_history_${stock.code}_30`; // 假設預設 30 天
    const predictionKey = `stock_prediction_${stock.code}`;

    const hasDetail = storage.get(detailKey)?.isExpired === false;
    const hasHistory = storage.get(historyKey)?.isExpired === false;
    const hasPrediction = storage.get(predictionKey)?.isExpired === false;

    if (!hasDetail) {
      // 加入 Queue (低優先級? 目前 Queue 是 FIFO，但因為是背景執行，沒關係)
      // 我們不 await 結果，而是讓它在 Queue 中排隊
      fetchStockDetail(stock.code).catch(() => { });
    }
    if (!hasHistory) {
      fetchHistoricalData(stock.code).catch(() => { });
    }
    if (!hasPrediction) {
      fetchStockPrediction(stock.code).catch(() => { });
    }
  }
}

/**
 * 根據股票代碼獲取詳細資訊
 * @param code 股票代碼
 * @returns Promise<ApiResponse<StockDetail>>
 */
export async function fetchStockDetail(code: string): Promise<ApiResponse<StockDetail>> {
  const cacheKey = `stock_detail_${code}`;

  const fetchLogic = async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/stocks/${code}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const dataArray: BackendStock[] = await response.json();
    const data = dataArray[0];

    if (!data) throw new Error(`找不到股票代碼: ${code}`);

    // 重用 fetchStocks 的邏輯或直接呼叫 API
    // 這裡為了完整性，重新呼叫一次 (或可優化為從列表快取中拿?)
    // 為了確保資料最新，我們還是呼叫 API

    let currentPrice = 10;
    let price1 = 0;
    let price2 = 0;

    try {
      const [llmRes, neuralRes, priceRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=llm`),
        fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=neuralprophet`),
        fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prices?limit=1`)
      ]);

      if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
        const json = await neuralRes.value.json();
        const val = typeof json === 'string' ? JSON.parse(json) : json;
        const items = val?.neuralprophet;
        if (Array.isArray(items) && items.length > 0) price1 = items[0].price;
        else if (items?.price) price1 = items.price;
      }
      if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
        const json = await llmRes.value.json();
        const val = typeof json === 'string' ? JSON.parse(json) : json;
        const items = val?.llm;
        if (Array.isArray(items) && items.length > 0) price2 = items[0].price;
        else if (items?.price) price2 = items.price;
      }
      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const json = await priceRes.value.json();
        const d = typeof json === 'string' ? JSON.parse(json) : json;
        if (Array.isArray(d) && d.length > 0) currentPrice = d[0].close_price;
      }
    } catch (e) {
      console.warn(`Failed to fetch prediction prices for detail ${code}`, e);
    }

    const change1 = price1 - currentPrice;
    const change2 = price2 - currentPrice;
    const averageChange = (change1 + change2) / 2;

    const stockDetail: StockDetail = {
      ...mapToFrontendStock(data),
      currentPrice,
      predictedPrice1: price1,
      predictedPrice2: price2,
      change1,
      changePercent1: currentPrice !== 0 ? Number(((change1 / currentPrice) * 100).toFixed(2)) : 0,
      change2,
      changePercent2: currentPrice !== 0 ? Number(((change2 / currentPrice) * 100).toFixed(2)) : 0,
      averageChange,
      averageChangePercent: currentPrice !== 0 ? Number(((averageChange / currentPrice) * 100).toFixed(2)) : 0,
      volume: 0,
      marketCap: 0,
      pe: 0,
      eps: 0,
      dividend: 0,
      industry: data.keywords?.[0] || "未知產業",
      description: `股票 ${data.stock_name} 的詳細資訊`
    };

    return {
      success: true,
      data: stockDetail,
      timestamp: new Date().toISOString()
    };
  };

  return fetchWithCache(cacheKey, fetchLogic);
}

/**
 * 根據篩選條件獲取股票列表
 * @param filters 篩選參數
 * @returns Promise<ApiResponse<Stock[]>>
 */
export async function fetchFilteredStocks(filters: StockFilterParams): Promise<ApiResponse<Stock[]>> {
  // 篩選通常依賴最新的列表數據，所以我們先呼叫 fetchStocks (它有快取)
  const response = await fetchStocks();
  let filtered = response.data;

  if (filters.upTrendEnabled || filters.downTrendEnabled) {
    filtered = filtered.filter(stock => {
      const method1Match =
        (filters.upTrendEnabled && stock.changePercent1 >= filters.upTrendThreshold) ||
        (filters.downTrendEnabled && stock.changePercent1 <= filters.downTrendThreshold);

      const method2Match =
        (filters.upTrendEnabled && stock.changePercent2 >= filters.upTrendThreshold) ||
        (filters.downTrendEnabled && stock.changePercent2 <= filters.downTrendThreshold);

      return method1Match || method2Match;
    });
  }

  return {
    success: true,
    data: filtered,
    timestamp: new Date().toISOString()
  };
}

/**
 * 獲取股票預測資料 (圖表用)
 * @param code 股票代碼
 * @returns Promise<ApiResponse<any>>
 */
export async function fetchStockPrediction(code: string): Promise<ApiResponse<any>> {
  const cacheKey = `stock_prediction_${code}`;

  const fetchLogic = async () => {
    const [llmResponse, neuralResponse] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=llm`),
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=neuralprophet`)
    ]);

    let llmData = null;
    let neuralData = null;

    if (llmResponse.status === 'fulfilled' && llmResponse.value.ok) {
      const jsonString = await llmResponse.value.json();
      try { llmData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString; } catch (e) { }
    }

    if (neuralResponse.status === 'fulfilled' && neuralResponse.value.ok) {
      const jsonString = await neuralResponse.value.json();
      try { neuralData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString; } catch (e) { }
    }

    const predictions: any[] = [];
    const neuralItems = neuralData?.neuralprophet;
    const llmItems = llmData?.llm;

    // 優先使用 NeuralProphet，如果沒有則使用 LLM
    const targetItems = Array.isArray(neuralItems) && neuralItems.length > 0 ? neuralItems :
      (Array.isArray(llmItems) && llmItems.length > 0 ? llmItems : []);

    if (targetItems.length === 0) {
      if (neuralItems?.price) {
        predictions.push({ date: neuralItems.next_day, predictedPrice: neuralItems.price, confidence: 0.8 });
      } else if (llmItems?.price) {
        predictions.push({ date: llmItems.next_day, predictedPrice: llmItems.price, confidence: 0.8 });
      }
    } else {
      targetItems.forEach((item: any) => {
        predictions.push({ date: item.next_day, predictedPrice: item.price, confidence: 0.8 });
      });
    }

    // Mock if empty
    if (predictions.length === 0) {
      const today = new Date();
      for (let i = 1; i <= 5; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        predictions.push({ date: d.toISOString().split('T')[0], predictedPrice: 0, confidence: 0.99 });
      }
    }

    return {
      success: true,
      data: {
        code,
        predictions,
        model: neuralData ? 'NeuralProphet' : (llmData ? 'LLM' : 'Unknown'),
        lastUpdated: new Date().toISOString(),
        rawLlm: llmData,
        rawNeural: neuralData
      },
      timestamp: new Date().toISOString()
    };
  };

  return fetchWithCache(cacheKey, fetchLogic);
}

/**
 * 刷新所有股票數據
 * @returns Promise<ApiResponse<Stock[]>>
 */
export async function refreshStocksData(): Promise<ApiResponse<Stock[]>> {
  // 清除所有快取
  storage.clearAll();
  // 重新呼叫 fetchStocks (會自動觸發新的 API 請求與預載)
  return fetchStocks();
}

/**
 * 獲取股票歷史數據
 * @param code 股票代碼
 * @param days 獲取天數（預設30天）
 * @returns Promise<ApiResponse<HistoricalData[]>>
 */
export async function fetchHistoricalData(code: string, days: number = 30): Promise<ApiResponse<HistoricalData[]>> {
  const cacheKey = `stock_history_${code}_${days}`;

  const fetchLogic = async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prices?limit=${days}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const json = await response.json();
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    const historicalData: HistoricalData[] = [];

    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        historicalData.push({
          date: item.trade_date,
          open: item.close_price,
          high: item.close_price,
          low: item.close_price,
          close: item.close_price,
          volume: 0,
          foreignInvestors: 0,
          investmentTrust: 0,
          dealers: 0
        });
      });
    }

    historicalData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: historicalData,
      timestamp: new Date().toISOString()
    };
  };

  return fetchWithCache(cacheKey, fetchLogic);
}

/**
 * 獲取股票歷史預測數據
 * @param code 股票代碼
 * @param days 獲取天數（預設20天）
 * @returns Promise<ApiResponse<HistoricalPrediction[]>>
 */
export async function fetchHistoricalPredictions(code: string, days: number = 20): Promise<ApiResponse<HistoricalPrediction[]>> {
  const cacheKey = `stock_history_pred_${code}_${days}`;

  const fetchLogic = async () => {
    const [llmRes, neuralRes] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=llm&limit=${days}`),
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=neuralprophet&limit=${days}`)
    ]);

    const predictionMap = new Map<string, HistoricalPrediction>();

    if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
      const json = await neuralRes.value.json();
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const items = data?.neuralprophet || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.next_day && item.price !== undefined) {
            const date = item.next_day;
            if (!predictionMap.has(date)) predictionMap.set(date, { date, predictedPrice1: 0, predictedPrice2: 0 });
            predictionMap.get(date)!.predictedPrice1 = item.price;
          }
        });
      }
    }

    if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
      const json = await llmRes.value.json();
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const items = data?.llm || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.next_day && item.price !== undefined) {
            const date = item.next_day;
            if (!predictionMap.has(date)) predictionMap.set(date, { date, predictedPrice1: 0, predictedPrice2: 0 });
            predictionMap.get(date)!.predictedPrice2 = item.price;
          }
        });
      }
    }

    const historicalPredictions = Array.from(predictionMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: historicalPredictions,
      timestamp: new Date().toISOString()
    };
  };

  return fetchWithCache(cacheKey, fetchLogic);
}