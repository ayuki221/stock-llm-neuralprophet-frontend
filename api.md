
---

你可以透過下列 HTTP API 來存取「Stock LLM NeuralProphet」後端服務。
你的任務是依照使用者需求，自行決定要呼叫哪一支 API、組好 URL 與參數、發送 HTTP 請求並解析回傳結果，再用自然語言回答使用者。

## 1. 連線與通用規格

* Base URL：`<BASE_URL>`
  （由人類使用者提供，例如 `https://homelab.xxx/api`，以下範例以 `<BASE_URL>` 代稱）
* API 版本前綴：所有股票相關路徑都在 `/api/v1`
* HTTP 方法：全部為 `GET`
* Request / Response Content-Type：

  * `Accept: application/json`
  * 你發送請求時不需要有 body
* 認證方式：目前無（如未來有 token，會由人類使用者補充）

若收到 `422 Unprocessable Entity`，代表你給的參數格式錯誤或缺少必填欄位，請檢查 URL path 和 query string。

---

## 2. 資料模型（Schemas）

### 2.1 Stock 物件

API `/api/v1/stocks` 與 `/api/v1/stocks/{symbol}` 皆會回傳「Stock 物件陣列」，每個元素格式如下：

```json
{
  "symbol": "string or number",   // 股票代號（Swagger 示例顯示為 0，實際會是代號）
  "stock_name": "string",         // 股票中文名稱
  "keywords": ["string"]          // 與該股票相關的關鍵字列表
}
```

實際回傳格式會是：

```json
[
  {
    "symbol": "2330",
    "stock_name": "台積電",
    "keywords": ["半導體", "晶圓代工"]
  },
  ...
]
```

（上例為說明用途，實際內容由後端決定）

### 2.2 Validation Error

當參數錯誤時，API 會回傳類似：

```json
{
  "detail": [
    {
      "loc": ["string", 0],
      "msg": "string",
      "type": "string"
    }
  ]
}
```

你只需要知道：422 代表輸入參數有問題，要提示使用者修正。

---

## 3. 各 API 說明

### 3.1 取得所有股票列表

* 方法：`GET`
* 路徑：`/api/v1/stocks`
* 完整 URL：`<BASE_URL>/api/v1/stocks`
* Request 參數：

  * 無 path 參數
  * 無 query 參數
* 成功回應 (`200 OK`)：`Stock` 物件陣列（JSON）

#### 範例請求

```bash
curl -X GET "<BASE_URL>/api/v1/stocks" -H "Accept: application/json"
```

#### 範例回應（示意）

```json
[
  {
    "symbol": "2330",
    "stock_name": "台積電",
    "keywords": ["半導體", "晶圓代工"]
  },
  {
    "symbol": "2317",
    "stock_name": "鴻海",
    "keywords": ["電子組裝", "EMS"]
  }
]
```

#### 你應如何使用

* 當使用者想「查有哪些股票可以預測」、「幫我列出全部標的」時，呼叫這支 API。
* 你可以先取得清單，再根據 `symbol` 幫使用者做進一步操作（例如去查單一股票或預測）。

---

### 3.2 取得單一股票資訊

* 方法：`GET`
* 路徑：`/api/v1/stocks/{symbol}`
* 完整 URL：`<BASE_URL>/api/v1/stocks/{symbol}`
* Path 參數：

  * `symbol`（string）：股票代號（例如 `"2330"`）
* 成功回應 (`200 OK`)：`Stock` 物件陣列（通常為單一元素）

#### 範例請求

```bash
curl -X GET "<BASE_URL>/api/v1/stocks/2330" -H "Accept: application/json"
```

#### 範例回應（示意）

```json
[
  {
    "symbol": "2330",
    "stock_name": "台積電",
    "keywords": ["半導體", "晶圓代工"]
  }
]
```

#### 錯誤情況

* 若 `symbol` 格式不正確或不存在，可能回傳 422 或其它錯誤碼（由後端實作決定）。
* 收到 422 時要提醒使用者檢查股票代號。

#### 你應如何使用

* 當使用者問「幫我看股票 2330 的基本資訊 / 關鍵字」時，呼叫這支 API。
* 可用 `keywords` 來做後續解讀或說明，例如將關鍵字整理成文字描述。

---

### 3.3 取得股票預測結果

* 方法：`GET`

* 路徑：`/api/v1/stocks/{symbol}/prediction`

* 完整 URL：`<BASE_URL>/api/v1/stocks/{symbol}/prediction`

* Path 參數：

  * `symbol`（string）：股票代號，如 `"2330"`

* Query 參數（必填）：

  * `method`（string）：預測方法

    * 可用值：`"llm"` 或 `"neuralprophet"`

* 成功回應 (`200 OK`)：字串（`string`）

  * Swagger schema 顯示為 `string`，實際內容可能是文字描述或序列化後的 JSON 字串。
  * 你收到後要先解析內容（若是 JSON 字串則先轉成結構化資料），再轉成自然語言解釋給使用者。

#### 範例請求

1. 使用 LLM 預測：

```bash
curl -X GET "<BASE_URL>/api/v1/stocks/2330/prediction?method=llm" \
  -H "Accept: application/json"
```

2. 使用 NeuralProphet 預測：

```bash
curl -X GET "<BASE_URL>/api/v1/stocks/2330/prediction?method=neuralprophet" \
  -H "Accept: application/json"
```

#### 範例回應（示意，實際格式由後端決定）

```json
"{
  \"symbol\": \"2330\",
  \"method\": \"neuralprophet\",
  \"horizon\": \"7d\",
  \"forecast\": [
    {\"date\": \"2025-11-25\", \"price\": 950.5},
    {\"date\": \"2025-11-26\", \"price\": 955.0}
  ]
}"
```

若回傳如上是一個 JSON 字串，你應該：

1. 先將字串內的 JSON 解析成結構化資料。
2. 把預測的關鍵資訊用自然語言整理，例如：

   * 預測區間
   * 每天預測價格
   * 趨勢方向（上升 / 下降 / 持平）

#### 錯誤情況

* 未提供 `method` 或 method 值不是 `llm` / `neuralprophet` 時，會得到 422 Validation Error。
* 收到 422 時，要檢查：

  * `symbol` 格式是否合理
  * `method` 是否為允許值之一

#### 你應如何使用

* 當使用者問：

  * 「幫我看 2330 用 NeuralProphet 預測未來走勢」
  * 「用 LLM 幫我預測這檔股票」
* 你要：

  1. 確認使用者提供的 symbol。
  2. 確認使用者想用 `llm` 還是 `neuralprophet`，若未指定，可先詢問或預設一種方法（例如 `neuralprophet`），並在回答中說明你用的是哪一種。
  3. 呼叫這支 API，解析結果，再以易懂的方式說明預測內容與可能的解讀。

---

## 4. Root API（健康檢查）

* 方法：`GET`
* 路徑：`/`
* 完整 URL：`<BASE_URL>/`
* 功能：讀取服務根路徑，通常用來確認服務是否運作正常。
* 回傳內容為簡單 JSON 或字串（由後端決定，你只需用來檢查「服務是否在線」即可）。

---

## 5. 你在對話中的行為規則（給 AI Agent）

1. 在使用者提到「股票列表」、「有那些標的」、「列出可預測股票」時，優先呼叫 `/api/v1/stocks`。
2. 在使用者指定某檔股票（例如 2330）並想看介紹或關鍵字時，呼叫 `/api/v1/stocks/{symbol}`。
3. 在使用者要求「預測」、「未來走勢」、「模型預測」時，呼叫 `/api/v1/stocks/{symbol}/prediction`，並依需求選擇 `method=llm` 或 `method=neuralprophet`。
4. 收到 API 回應後：

   * 先將 JSON/字串轉成結構化資訊。
   * 再用自然語言，清楚說明給使用者，不要只貼原始 JSON。
5. 若遇到錯誤（例如 422），要根據錯誤內容推測是哪個參數有問題，並引導使用者修正輸入（例如股票代號或方法名稱）。

---

你可以直接把以上整份貼給 AI Agent，並在前面再加一句，例如：
「以下是我自架股票預測後端的 API 規格，請依這份文件幫我呼叫 API 並回答問題。」
