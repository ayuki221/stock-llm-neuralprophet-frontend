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
        // 平行呼叫兩種預測方法
        const [llmRes, neuralRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prediction?method=llm`),
          fetch(`${API_BASE_URL}/api/v1/stocks/${stock.code}/prediction?method=neuralprophet`)
        ]);

        let price1 = 0; // neuralprophet (predictedPrice1)
        let price2 = 0; // llm (predictedPrice2)

        // 解析 NeuralProphet (對應 predictedPrice1)
        if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
          const json = await neuralRes.value.json();
          const val = typeof json === 'string' ? JSON.parse(json) : json;
          if (val?.neuralprophet?.price) {
            price1 = val.neuralprophet.price;
          }
        }

        // 解析 LLM (對應 predictedPrice2)
        if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
          const json = await llmRes.value.json();
          const val = typeof json === 'string' ? JSON.parse(json) : json;
          if (val?.llm?.price) {
            price2 = val.llm.price;
          }
        }

        // 計算變動與百分比
        const currentPrice = stock.currentPrice; // 10

        // 變動值
        const change1 = price1 - currentPrice;
        const change2 = price2 - currentPrice;
        const averageChange = (change1 + change2) / 2;

        // 百分比計算 (避免除以 0)
        const changePercent1 = currentPrice !== 0 ? ((change1 / currentPrice) * 100).toFixed(2) : 0;
        const changePercent2 = currentPrice !== 0 ? ((change2 / currentPrice) * 100).toFixed(2) : 0;
        const averageChangePercent = currentPrice !== 0 ? ((averageChange / currentPrice) * 100).toFixed(2) : 0;

        return {
          ...stock,
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

    // 獲取預測價格以填充詳細資訊中的價格欄位
    let price1 = 0; // neuralprophet
    let price2 = 0; // llm
    try {
      const [llmRes, neuralRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=llm`),
        fetch(`${API_BASE_URL}/api/v1/stocks/${code}/prediction?method=neuralprophet`)
      ]);

      if (neuralRes.status === 'fulfilled' && neuralRes.value.ok) {
        const json = await neuralRes.value.json();
        const val = typeof json === 'string' ? JSON.parse(json) : json;
        if (val?.neuralprophet?.price) price1 = val.neuralprophet.price;
      }
      if (llmRes.status === 'fulfilled' && llmRes.value.ok) {
        const json = await llmRes.value.json();
        const val = typeof json === 'string' ? JSON.parse(json) : json;
        if (val?.llm?.price) price2 = val.llm.price;
      }
    } catch (e) {
      console.warn(`Failed to fetch prediction prices for detail ${code}`, e);
    }

    // 計算變動與百分比
    const currentPrice = 10; // Mock 值
    const change1 = price1 - currentPrice;
    const change2 = price2 - currentPrice;
    const averageChange = (change1 + change2) / 2;

    // 百分比計算
    const changePercent1 = currentPrice !== 0 ? (change1 / currentPrice) * 100 : 0;
    const changePercent2 = currentPrice !== 0 ? (change2 / currentPrice) * 100 : 0;
    const averageChangePercent = currentPrice !== 0 ? (averageChange / currentPrice) * 100 : 0;

    const stockDetail: StockDetail = {
      ...mapToFrontendStock(data),
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
    const predictions = [];

    if (neuralData?.neuralprophet) {
      predictions.push({
        date: neuralData.neuralprophet.next_day,
        predictedPrice: neuralData.neuralprophet.price,
        confidence: 0.8 // Mock
      });
    } else if (llmData?.llm) {
      predictions.push({
        date: llmData.llm.next_day,
        predictedPrice: llmData.llm.price,
        confidence: 0.8 // Mock
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
    await simulateDelay(300);

    // 註解掉量價資料與三大法人資料，回傳空陣列
    const historicalData: HistoricalData[] = [];

    return {
      success: true,
      data: historicalData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
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
    await simulateDelay(300);

    // 生成全為 0 的歷史預測數據
    const historicalPredictions: HistoricalPrediction[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      historicalPredictions.push({
        date: date.toISOString().split('T')[0],
        predictedPrice1: 0,
        predictedPrice2: 0
      });
    }

    return {
      success: true,
      data: historicalPredictions,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw {
      code: 'FETCH_HISTORICAL_PREDICTIONS_ERROR',
      message: error instanceof Error ? error.message : '獲取歷史預測數據失敗',
      details: error
    } as ApiError;
  }
}