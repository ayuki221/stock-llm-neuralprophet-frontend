# API 接入說明文件

## 概述

此專案已建立完整的 API 服務層，方便未來接入真實後端 API。所有 API 相關的邏輯都集中在 `/services/api.ts` 文件中。

## 檔案結構

```
/types/stock.ts          # 型別定義
/services/api.ts         # API 服務層（需要修改以接入真實 API）
```

## 如何接入真實 API

### 步驟 1: 設定 API 基礎 URL

在 `/services/api.ts` 文件中，修改 `API_BASE_URL` 常數：

```typescript
// 開發環境
const API_BASE_URL = 'http://localhost:8000/api';

// 或使用環境變數
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://your-api.com/api';
```

### 步驟 2: 替換 Mock 實現

每個 API 函數都有標註 `TODO` 的註解，顯示如何替換為真實 API 調用。

#### 範例：獲取股票列表

**目前（Mock 實現）：**
```typescript
export async function fetchStocks(): Promise<ApiResponse<Stock[]>> {
  try {
    // TODO: 替換為真實 API 調用
    await simulateDelay(800);
    
    return {
      success: true,
      data: mockStocksData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // ...錯誤處理
  }
}
```

**接入真實 API 後：**
```typescript
export async function fetchStocks(): Promise<ApiResponse<Stock[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 如需認證，添加 token
        // 'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    throw {
      code: 'FETCH_STOCKS_ERROR',
      message: error instanceof Error ? error.message : '獲取股票列表失敗',
      details: error
    } as ApiError;
  }
}
```

## 可用的 API 函數

### 1. `fetchStocks()`
獲取所有股票列表

**返回類型:** `Promise<ApiResponse<Stock[]>>`

**後端 API 端點建議:** `GET /api/stocks`

### 2. `fetchStockDetail(code: string)`
根據股票代碼獲取詳細資訊

**參數:**
- `code`: 股票代碼（例如 "2330"）

**返回類型:** `Promise<ApiResponse<StockDetail>>`

**後端 API 端點建議:** `GET /api/stocks/{code}`

### 3. `fetchFilteredStocks(filters: StockFilterParams)`
根據篩選條件獲取股票列表

**參數:**
```typescript
{
  upTrendEnabled: boolean;
  downTrendEnabled: boolean;
  upTrendThreshold: number;
  downTrendThreshold: number;
}
```

**返回類型:** `Promise<ApiResponse<Stock[]>>`

**後端 API 端點建議:** `POST /api/stocks/filter`

**請求體範例:**
```json
{
  "upTrendEnabled": true,
  "downTrendEnabled": true,
  "upTrendThreshold": 5,
  "downTrendThreshold": -5
}
```

### 4. `fetchStockPrediction(code: string)`
獲取股票預測資料

**參數:**
- `code`: 股票代碼

**返回類型:** `Promise<ApiResponse<any>>`

**後端 API 端點建議:** `GET /api/predictions/{code}`

### 5. `refreshStocksData()`
刷新所有股票數據

**返回類型:** `Promise<ApiResponse<Stock[]>>`

**後端 API 端點建議:** `POST /api/stocks/refresh`

## 資料型別定義

### Stock
```typescript
interface Stock {
  code: string;           // 股票代碼
  name: string;           // 股票名稱
  currentPrice: number;   // 當前價格
  predictedPrice: number; // 預測價格
  change: number;         // 價格變動
  changePercent: number;  // 變動百分比
}
```

### StockDetail
```typescript
interface StockDetail extends Stock {
  volume?: number;        // 成交量
  marketCap?: number;     // 市值
  pe?: number;            // 本益比
  eps?: number;           // 每股盈餘
  dividend?: number;      // 股息
  industry?: string;      // 產業類別
  description?: string;   // 描述
}
```

### ApiResponse
```typescript
interface ApiResponse<T> {
  success: boolean;       // 請求是否成功
  data: T;               // 返回的資料
  message?: string;      // 可選的訊息
  timestamp: string;     // 時間戳記
}
```

### ApiError
```typescript
interface ApiError {
  code: string;          // 錯誤代碼
  message: string;       // 錯誤訊息
  details?: unknown;     // 錯誤詳情
}
```

## 後端 API 預期響應格式

### 成功響應
```json
{
  "success": true,
  "data": [
    {
      "code": "2330",
      "name": "台積電",
      "currentPrice": 1400,
      "predictedPrice": 1470,
      "change": 70,
      "changePercent": 5
    }
  ],
  "timestamp": "2025-10-23T12:00:00.000Z"
}
```

### 錯誤響應
```json
{
  "success": false,
  "message": "找不到股票資料",
  "timestamp": "2025-10-23T12:00:00.000Z"
}
```

## 環境變數設定

在專案根目錄創建 `.env` 文件：

```env
# API 基礎 URL
REACT_APP_API_BASE_URL=https://your-api-domain.com/api

# 如果需要 API 金鑰
REACT_APP_API_KEY=your_api_key_here
```

## 認證處理（如需要）

如果後端 API 需要認證，可以添加以下輔助函數：

```typescript
// 在 /services/api.ts 中添加

// 獲取認證 token
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

// 設定預設請求標頭
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// 在所有 fetch 調用中使用
const response = await fetch(`${API_BASE_URL}/stocks`, {
  headers: getHeaders()
});
```

## 測試建議

1. **開發階段**: 保持使用 Mock 數據進行開發和測試
2. **整合階段**: 逐個替換 API 函數，確保每個都能正常工作
3. **生產階段**: 移除所有 Mock 數據和 `simulateDelay` 調用

## 錯誤處理

所有 API 函數都已包含錯誤處理邏輯，並會：
- 拋出標準化的 `ApiError` 物件
- 在 UI 中顯示 toast 通知
- 提供重試機制

## 注意事項

1. 確保後端 API 返回的資料格式與 TypeScript 型別定義匹配
2. 處理 CORS 問題（如果前後端不在同一域名）
3. 考慮添加請求快取以提升性能
4. 實現請求重試邏輯處理網路不穩定情況
5. 添加請求超時處理

## 聯絡支援

如有問題或需要協助，請查閱專案文件或聯繫開發團隊。
