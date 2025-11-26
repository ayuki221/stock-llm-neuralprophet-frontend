// 股票基本資料類型
export interface Stock {
  code: string;
  name: string;
  currentPrice: number;
  predictedPrice1: number; // 預測方法1
  predictedPrice2: number; // 預測方法2
  change1: number; // 方法1的變動
  changePercent1: number; // 方法1的變動百分比
  change2: number; // 方法2的變動
  changePercent2: number; // 方法2的變動百分比
  averageChange: number; // 平均變動
  averageChangePercent: number; // 平均變動百分比
}

// 股票詳細資料類型
export interface StockDetail extends Stock {
  volume?: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  dividend?: number;
  industry?: string;
  description?: string;
}

// 歷史數據類型
export interface HistoricalData {
  date: string;
  open: number; // 開盤價
  high: number; // 最高價
  low: number; // 最低價
  close: number; // 收盤價
  volume: number; // 成交量
  foreignInvestors: number; // 外資買賣超（千股）
  investmentTrust: number; // 投信買賣超（千股）
  dealers: number; // 自營商買賣超（千股）
}

// 歷史預測數據類型
export interface HistoricalPrediction {
  date: string;
  predictedPrice1: number; // 預計股價1
  predictedPrice2: number; // 預計股價2
}

// API 響應類型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

// 篩選參數類型
export interface StockFilterParams {
  upTrendEnabled: boolean;
  downTrendEnabled: boolean;
  upTrendThreshold: number;
  downTrendThreshold: number;
}

// 錯誤類型
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}