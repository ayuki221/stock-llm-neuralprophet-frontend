import { Stock, StockDetail, ApiResponse, StockFilterParams, ApiError, HistoricalData, HistoricalPrediction } from '../types/stock';

// API 基礎 URL
// 開發模式下使用 Proxy (空字串 -> 相對路徑 /api...)
// 生產模式下使用環境變數或預設 URL
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_BASE_URL;

// 模擬延遲（模擬網路請求）
const simulateDelay = (ms: number = 500) =>
  new Promise(resolve => setTimeout(resolve, ms));

// 定義後端回傳的 Stock 格式
interface BackendStock {
  symbol: string | number;
  stock_name: string;
  keywords: string[];
}

// 定義預測 API 回傳格式
interface PredictionResponse {
  [key: string]: {
    next_day: string;
    price: number;
    prediction_calculated_time: string;
  }
}

// 輔助函式：將 BackendStock 轉換為前端 Stock 格式 (初始狀態)
const mapToFrontendStock = (item: BackendStock): Stock => ({
  code: String(item.symbol),
  name: item.stock_name,
  currentPrice: 600, // Mock 值改為 10 (使用者設定)
  predictedPrice1: 0, // 稍後透過 API 獲取，預設 0
  predictedPrice2: 0, // 稍後透過 API 獲取，預設 0
  change1: 0,
  changePercent1: 0,
  change2: 0,
  changePercent2: 0,
  averageChange: 0,
  averageChangePercent: 0
});

/**
 * 獲取所有股票列表
 * @returns Promise<ApiResponse<Stock[]>>
 */
export async function fetchStocks(): Promise<ApiResponse<Stock[]>> {
  try {
    // 1. 獲取股票列表
    const response = await fetch(`${API_BASE_URL}/api/v1/stocks`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    const data: BackendStock[] = await response.json();

    // 2. 轉換為前端格式
    const stocks: Stock[] = data.map(mapToFrontendStock);

    // 3. 為每支股票獲取預測價格 (平行處理)
    const stocksWithPrices = await Promise.all(stocks.map(async (stock) => {
      try {
        // 平行呼叫兩種預測方法與現價
        const [llmRes, neuralRes, priceRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prediction?method=llm`),
          fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prediction?method=neuralprophet`),
          fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prices?limit=1`)
        ]);

        let price1 = 0; // neuralprophet (predictedPrice1)
        let price2 = 0; // llm (predictedPrice2)
        let currentPrice = stock.currentPrice; // Default from mapToFrontendStock (10)

        // 解析現價
        if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
          try {
            const json = await priceRes.value.json();
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            if (Array.isArray(data) && data.length > 0) {
              currentPrice = data[0].close_price;
            }
          } catch (e) {
            console.warn(`Failed to parse price for ${stock.code}`, e);
          }
        }

        // 解析 NeuralProphet (對應 predictedPrice1)
        if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
          const json = await neuralRes.value.json();
          const val = typeof json === 'string' ? JSON.parse(json) : json;
          const items = val?.neuralprophet;
          if (Array.isArray(items) && items.length > 0) {
            price1 = items[0].price;
          } else if (items?.price) {
            price1 = items.price;
          }
        }

        // 解析 LLM (對應 predictedPrice2)
        if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
          const json = await llmRes.value.json();
          const val = typeof json === 'string' ? JSON.parse(json) : json;
          const items = val?.llm;
          if (Array.isArray(items) && items.length > 0) {
            price2 = items[0].price;
          } else if (items?.price) {
            price2 = items.price;
          }
        }

        // 計算變動與百分比
        // currentPrice 已經在上面更新為 API 獲取的值

        // 變動值
        const change1 = price1 - currentPrice;
        const change2 = price2 - currentPrice;
        const averageChange = (change1 + change2) / 2;

        // 百分比計算 (避免除以 0)
        const changePercent1 = currentPrice !== 0 ? Number(((change1 / currentPrice) * 100).toFixed(2)) : 0;
        const changePercent2 = currentPrice !== 0 ? Number(((change2 / currentPrice) * 100).toFixed(2)) : 0;
        const averageChangePercent = currentPrice !== 0 ? Number(((averageChange / currentPrice) * 100).toFixed(2)) : 0;

        return {
          ...stock,
          currentPrice, // 更新現價
          predictedPrice1: price1,
          predictedPrice2: price2,
          change1,
          changePercent1,
          change2,
          changePercent2,
          averageChange,
          averageChangePercent
        };
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
 * 根據股票代碼獲取詳細資訊
 * @param code 股票代碼
 * @returns Promise<ApiResponse<StockDetail>>
 */
export async function fetchStockDetail(code: string): Promise<ApiResponse<StockDetail>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/stocks/${code}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    const dataArray: BackendStock[] = await response.json();
    const data = dataArray[0];

    if (!data) {
      throw new Error(`找不到股票代碼: ${code}`);
    }

    let currentPrice = 10; // Mock 值作為 fallback
    let price1 = 0; // neuralprophet
    let price2 = 0; // llm
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
        if (Array.isArray(items) && items.length > 0) {
          price1 = items[0].price;
        } else if (items?.price) {
          price1 = items.price;
        }
      }
      if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
        const json = await llmRes.value.json();
        const val = typeof json === 'string' ? JSON.parse(json) : json;
        const items = val?.llm;
        if (Array.isArray(items) && items.length > 0) {
          price2 = items[0].price;
        } else if (items?.price) {
          price2 = items.price;
        }
      }

      // 解析現價
      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        try {
          const json = await priceRes.value.json();
          const data = typeof json === 'string' ? JSON.parse(json) : json;
          if (Array.isArray(data) && data.length > 0) {
            currentPrice = data[0].close_price;
          }
        } catch (e) {
          console.warn(`Failed to parse price for detail ${code}`, e);
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch prediction prices for detail ${code}`, e);
    }

    // 計算變動與百分比
    // currentPrice 已在上方更新
    const change1 = price1 - currentPrice;
    const change2 = price2 - currentPrice;
    const averageChange = (change1 + change2) / 2;

    // 百分比計算
    const changePercent1 = currentPrice !== 0 ? Number(((change1 / currentPrice) * 100).toFixed(2)) : 0;
    const changePercent2 = currentPrice !== 0 ? Number(((change2 / currentPrice) * 100).toFixed(2)) : 0;
    const averageChangePercent = currentPrice !== 0 ? Number(((averageChange / currentPrice) * 100).toFixed(2)) : 0;

    const stockDetail: StockDetail = {
      ...mapToFrontendStock(data),
      currentPrice, // 更新現價
      predictedPrice1: price1,
      predictedPrice2: price2,
      change1,
      changePercent1,
      change2,
      changePercent2,
      averageChange,
      averageChangePercent,
      // 詳細資訊缺失，填入 0
      volume: 0,
      marketCap: 0,
      pe: 0,
      eps: 0,
      dividend: 0,
      industry: data.keywords?.[0] || "未知產業",
      description: `股票 ${data.stock_name} 的詳細資訊 (Mock)`
    };

    return {
      success: true,
      data: stockDetail,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Fetch stock detail error:', error);
    throw {
      code: 'FETCH_STOCK_DETAIL_ERROR',
      message: error instanceof Error ? error.message : '獲取股票詳情失敗',
      details: error
    } as ApiError;
  }
}

/**
 * 根據篩選條件獲取股票列表
 * @param filters 篩選參數
 * @returns Promise<ApiResponse<Stock[]>>
 */
export async function fetchFilteredStocks(filters: StockFilterParams): Promise<ApiResponse<Stock[]>> {
  try {
    // 呼叫 fetchStocks (已包含價格獲取邏輯)
    const response = await fetchStocks();
    let filtered = response.data;

    // 前端篩選
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
  } catch (error) {
    throw {
      code: 'FETCH_FILTERED_STOCKS_ERROR',
      message: error instanceof Error ? error.message : '篩選股票失敗',
      details: error
    } as ApiError;
  }
}

/**
 * 獲取股票預測資料 (圖表用)
 * @param code 股票代碼
 * @returns Promise<ApiResponse<any>>
 */
export async function fetchStockPrediction(code: string): Promise<ApiResponse<any>> {
  try {
    // 平行呼叫兩種預測方法
    const [llmResponse, neuralResponse] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=llm`),
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=neuralprophet`)
    ]);

    let llmData = null;
    let neuralData = null;

    // 處理 LLM 回應
    if (llmResponse.status === 'fulfilled' && llmResponse.value.ok) {
      const jsonString = await llmResponse.value.json();
      try {
        llmData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      } catch (e) {
        console.error('Parse LLM JSON error', e);
      }
    }

    // 處理 NeuralProphet 回應
    if (neuralResponse.status === 'fulfilled' && neuralResponse.value.ok) {
      const jsonString = await neuralResponse.value.json();
      try {
        neuralData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      } catch (e) {
        console.error('Parse NeuralProphet JSON error', e);
      }
    }

    // 整合預測數據
    const predictions: any[] = [];

    // 處理 NeuralProphet 數據
    const neuralItems = neuralData?.neuralprophet;
    if (Array.isArray(neuralItems)) {
      neuralItems.forEach((item: any) => {
        predictions.push({
          date: item.next_day,
          predictedPrice: item.price,
          confidence: 0.8, // Mock
          model: 'NeuralProphet'
        });
      });
    } else if (neuralItems?.price) {
      predictions.push({
        date: neuralItems.next_day,
        predictedPrice: neuralItems.price,
        confidence: 0.8, // Mock
        model: 'NeuralProphet'
      });
    }

    // 處理 LLM 數據
    const llmItems = llmData?.llm;
    if (Array.isArray(llmItems)) {
      llmItems.forEach((item: any) => {
        // 避免重複日期 (如果需要合併顯示，這裡可能需要調整邏輯，目前假設是混合顯示或由前端過濾)
        // 但 fetchStockPrediction 回傳結構看起來是單一列表
        // 為了簡單起見，我們將所有預測都加進去，前端可能需要根據模型篩選
        // 或者這裡只回傳其中一種模型的數據作為主要顯示?
        // 原本邏輯是 if neural else if llm，代表只顯示一種

        // 為了保持相容性，我們先只取一種模型，或者合併
        // 但原有的前端可能只預期單一序列? 
        // 讓我們檢查一下原有的回傳結構: predictions: [{date, predictedPrice, confidence}]
        // 如果同時有兩個模型，日期會重複。

        // 暫時策略：如果 neural 有值就用 neural，否則用 llm (維持原有優先順序邏輯)
        // 但現在是陣列，所以我們把整個陣列轉過去
      });
    }

    // 重寫整合邏輯：優先使用 NeuralProphet，如果沒有則使用 LLM
    // 這是為了維持與舊邏輯 (if neural ... else if llm ...) 的行為一致性，避免前端圖表爆炸
    const targetItems = Array.isArray(neuralItems) && neuralItems.length > 0 ? neuralItems :
      (Array.isArray(llmItems) && llmItems.length > 0 ? llmItems : []);

    // 如果不是陣列但有單一物件 (舊格式相容)
    if (targetItems.length === 0) {
      if (neuralItems?.price) {
        predictions.push({
          date: neuralItems.next_day,
          predictedPrice: neuralItems.price,
          confidence: 0.8
        });
      } else if (llmItems?.price) {
        predictions.push({
          date: llmItems.next_day,
          predictedPrice: llmItems.price,
          confidence: 0.8
        });
      }
    } else {
      targetItems.forEach((item: any) => {
        predictions.push({
          date: item.next_day,
          predictedPrice: item.price,
          confidence: 0.8
        });
      });
    }

    // 如果都沒有數據，回傳 Mock (但數值為 0)
    if (predictions.length === 0) {
      const today = new Date();
      for (let i = 1; i <= 5; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        predictions.push({
          date: d.toISOString().split('T')[0],
          predictedPrice: 0,
          confidence: 0.99
        });
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
  } catch (error) {
    console.error('Fetch prediction error:', error);
    throw {
      code: 'FETCH_PREDICTION_ERROR',
      message: error instanceof Error ? error.message : '獲取預測資料失敗',
      details: error
    } as ApiError;
  }
}

/**
 * 刷新所有股票數據
 * @returns Promise<ApiResponse<Stock[]>>
 */
export async function refreshStocksData(): Promise<ApiResponse<Stock[]>> {
  // 重新呼叫 fetchStocks
  return fetchStocks();
}

/**
 * 獲取股票歷史數據
 * @param code 股票代碼
 * @param days 獲取天數（預設30天）
 * @returns Promise<ApiResponse<HistoricalData[]>>
 */
export async function fetchHistoricalData(code: string, days: number = 30): Promise<ApiResponse<HistoricalData[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prices?limit=${days}`);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const json = await response.json();
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    const historicalData: HistoricalData[] = [];

    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        // API 只有 close_price，其他欄位暫時使用 close_price 填充
        historicalData.push({
          date: item.trade_date,
          open: item.close_price,
          high: item.close_price,
          low: item.close_price,
          close: item.close_price,
          volume: 0, // API 無成交量
          foreignInvestors: 0,
          investmentTrust: 0,
          dealers: 0
        });
      });
    }

    // 確保按日期降序排列 (如果 API 未排序)
    historicalData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: historicalData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Fetch historical data error:', error);
    throw {
      code: 'FETCH_HISTORICAL_DATA_ERROR',
      message: error instanceof Error ? error.message : '獲取歷史數據失敗',
      details: error
    } as ApiError;
  }
}

/**
 * 獲取股票歷史預測數據
 * @param code 股票代碼
 * @param days 獲取天數（預設20天）
 * @returns Promise<ApiResponse<HistoricalPrediction[]>>
 */
export async function fetchHistoricalPredictions(code: string, days: number = 20): Promise<ApiResponse<HistoricalPrediction[]>> {
  try {
    // 平行呼叫兩種預測方法
    // 注意：這裡假設後端 API 支援 limit 參數來控制天數，或者後端預設回傳足夠的資料
    // 根據截圖，API 支援 offset 和 limit
    const [llmRes, neuralRes] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=llm&limit=${days}`),
      fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=neuralprophet&limit=${days}`)
    ]);

    const predictionMap = new Map<string, HistoricalPrediction>();

    // 處理 NeuralProphet 回應 (predictedPrice1)
    if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
      const json = await neuralRes.value.json();
      const data = typeof json === 'string' ? JSON.parse(json) : json;

      // 假設回傳格式為 { "neuralprophet": [ { "next_day": "...", "price": ... }, ... ] }
      // 或是根據截圖，可能是 { "neuralprophet": [ ... ] }
      const items = data?.neuralprophet || [];

      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.next_day && item.price !== undefined) {
            const date = item.next_day;
            if (!predictionMap.has(date)) {
              predictionMap.set(date, { date, predictedPrice1: 0, predictedPrice2: 0 });
            }
            const pred = predictionMap.get(date)!;
            pred.predictedPrice1 = item.price;
          }
        });
      }
    }

    // 處理 LLM 回應 (predictedPrice2)
    if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
      const json = await llmRes.value.json();
      const data = typeof json === 'string' ? JSON.parse(json) : json;

      const items = data?.llm || [];

      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.next_day && item.price !== undefined) {
            const date = item.next_day;
            if (!predictionMap.has(date)) {
              predictionMap.set(date, { date, predictedPrice1: 0, predictedPrice2: 0 });
            }
            const pred = predictionMap.get(date)!;
            pred.predictedPrice2 = item.price;
          }
        });
      }
    }

    // 轉換 Map 為 Array 並排序 (日期降序)
    const historicalPredictions = Array.from(predictionMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: historicalPredictions,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Fetch historical predictions error:', error);
    throw {
      code: 'FETCH_HISTORICAL_PREDICTIONS_ERROR',
      message: error instanceof Error ? error.message : '獲取歷史預測數據失敗',
      details: error
    } as ApiError;
  }
}