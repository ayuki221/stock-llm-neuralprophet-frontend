import { useState, useEffect, useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Stock, HistoricalData, HistoricalPrediction, ApiError } from "../types/stock";
import { fetchHistoricalData, fetchHistoricalPredictions } from "../services/api";
import { toast } from "sonner@2.0.3";

interface StockDetailProps {
  stock: Stock;
  onBack: () => void;
}

export function StockDetail({ stock, onBack }: StockDetailProps) {
  const isPositive1 = stock.change1 >= 0;
  const isPositive2 = stock.change2 >= 0;
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [historicalPredictions, setHistoricalPredictions] = useState<HistoricalPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPredictionsLoading, setIsPredictionsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("predictions");

  // 每個標籤頁獨立的顯示數量
  const [predictionsDisplayCount, setPredictionsDisplayCount] = useState(5);
  const [priceDisplayCount, setPriceDisplayCount] = useState(5);
  const [investorsDisplayCount, setInvestorsDisplayCount] = useState(5);

  // 追踪是否正在加載更多，防止重複觸發
  const isLoadingMorePredictions = useRef(false);
  const isLoadingMorePrice = useRef(false);
  const isLoadingMoreInvestors = useRef(false);

  // 觀察器引用
  const predictionsObserverTarget = useRef<HTMLDivElement>(null);
  const priceObserverTarget = useRef<HTMLDivElement>(null);
  const investorsObserverTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistoricalData();
    loadHistoricalPredictions(); // 預設加載歷史預測
  }, [stock.code]);

  // 通用 IntersectionObserver 設置函數
  const setupObserver = (
    target: HTMLDivElement | null,
    currentCount: number,
    setCount: React.Dispatch<React.SetStateAction<number>>,
    maxLength: number,
    isLoadingRef: React.MutableRefObject<boolean>
  ) => {
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && currentCount < maxLength && !isLoadingRef.current) {
          isLoadingRef.current = true;

          // 模擬加載延遲
          setTimeout(() => {
            setCount((prev) => Math.min(prev + 5, maxLength)); // 每次增加 5 筆

            // 延遲重置加載狀態
            setTimeout(() => {
              isLoadingRef.current = false;
            }, 300);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  };

  // 監聽預測列表滾動
  useEffect(() => {
    return setupObserver(
      predictionsObserverTarget.current,
      predictionsDisplayCount,
      setPredictionsDisplayCount,
      historicalPredictions.length,
      isLoadingMorePredictions
    );
  }, [predictionsDisplayCount, historicalPredictions.length, isPredictionsLoading, activeTab]);

  // 監聽量價列表滾動
  useEffect(() => {
    return setupObserver(
      priceObserverTarget.current,
      priceDisplayCount,
      setPriceDisplayCount,
      historicalData.length,
      isLoadingMorePrice
    );
  }, [priceDisplayCount, historicalData.length, isLoading, activeTab]);

  // 監聽法人列表滾動
  useEffect(() => {
    return setupObserver(
      investorsObserverTarget.current,
      investorsDisplayCount,
      setInvestorsDisplayCount,
      historicalData.length,
      isLoadingMoreInvestors
    );
  }, [investorsDisplayCount, historicalData.length, isLoading, activeTab]);

  const loadHistoricalData = async () => {
    try {
      setIsLoading(true);
      const response = await fetchHistoricalData(stock.code, 20); // 獲取20天數據以支持懶加載
      setHistoricalData(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoricalPredictions = async () => {
    if (historicalPredictions.length > 0) return; // 已加載過則跳過

    try {
      setIsPredictionsLoading(true);
      const response = await fetchHistoricalPredictions(stock.code, 20); // 獲取最近20天預測數據
      setHistoricalPredictions(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError.message);
    } finally {
      setIsPredictionsLoading(false);
    }
  };

  // 當切換標籤時重置對應的顯示數量和加載狀態
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "predictions") {
      setPredictionsDisplayCount(5);
      isLoadingMorePredictions.current = false;
    } else if (value === "price") {
      setPriceDisplayCount(5);
      isLoadingMorePrice.current = false;
    } else if (value === "investors") {
      setInvestorsDisplayCount(5);
      isLoadingMoreInvestors.current = false;
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatInvestorData = (num: number) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${formatNumber(num)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Button>
        <h1 className="text-2xl truncate">{stock.name} 詳細資料</h1>
      </div>

      {/* Basic Info */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl">{stock.name}</h2>
              <p className="text-muted-foreground">股票代碼: {stock.code}</p>
            </div>
          </div>

          {/* 桌面版：4欄佈局 */}
          <div className="hidden md:grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">目前股價</p>
              <p className="text-2xl">${stock.currentPrice.toLocaleString()}</p>
            </div>

            <div className="text-center">
              {isPositive1 ? (
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-red-500" />
              ) : (
                <TrendingDown className="w-8 h-8 mx-auto mb-2 text-green-500" />
              )}
              <p className="text-sm text-muted-foreground">NeuralProphet預測</p>
              <p className="text-2xl">${stock.predictedPrice1.toLocaleString()}</p>
              <Badge
                variant={isPositive1 ? "default" : "secondary"}
                className={`mt-2 ${isPositive1
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
                  }`}
              >
                {isPositive1 ? "▲" : "▼"} {stock.changePercent1 >= 0 ? "+" : ""}{stock.changePercent1}%
              </Badge>
            </div>

            <div className="text-center">
              {isPositive2 ? (
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-red-500" />
              ) : (
                <TrendingDown className="w-8 h-8 mx-auto mb-2 text-green-500" />
              )}
              <p className="text-sm text-muted-foreground">LLM預測</p>
              <p className="text-2xl">${stock.predictedPrice2.toLocaleString()}</p>
              <Badge
                variant={isPositive2 ? "default" : "secondary"}
                className={`mt-2 ${isPositive2
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
                  }`}
              >
                {isPositive2 ? "▲" : "▼"} {stock.changePercent2 >= 0 ? "+" : ""}{stock.changePercent2}%
              </Badge>
            </div>

            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-2 bg-muted rounded-full flex items-center justify-center">
                <span className="text-sm">±</span>
              </div>
              <p className="text-sm text-muted-foreground">平均變動</p>
              <p className={`text-2xl ${((stock.change1 + stock.change2) / 2) >= 0 ? "text-red-500" : "text-green-500"}`}>
                {((stock.change1 + stock.change2) / 2) >= 0 ? "+" : ""}{Math.round((stock.change1 + stock.change2) / 2)}
              </p>
            </div>
          </div>

          {/* 手機版：2欄佈局 */}
          <div className="md:hidden grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <DollarSign className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground mb-1">目前股價</p>
              <p className="text-lg">${stock.currentPrice.toLocaleString()}</p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="w-6 h-6 mx-auto mb-2 bg-muted rounded-full flex items-center justify-center">
                <span className="text-xs">±</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">平均變動</p>
              <p className={`text-lg ${((stock.change1 + stock.change2) / 2) >= 0 ? "text-red-500" : "text-green-500"}`}>
                {((stock.change1 + stock.change2) / 2) >= 0 ? "+" : ""}{Math.round((stock.change1 + stock.change2) / 2)}
              </p>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              {isPositive1 ? (
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-red-500" />
              ) : (
                <TrendingDown className="w-6 h-6 mx-auto mb-2 text-green-500" />
              )}
              <p className="text-xs text-muted-foreground mb-1">NeuralProphet預測</p>
              <p className="text-lg mb-1">${stock.predictedPrice1.toLocaleString()}</p>
              <Badge
                variant={isPositive1 ? "default" : "secondary"}
                className={`text-xs ${isPositive1
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
                  }`}
              >
                {isPositive1 ? "▲" : "▼"} {stock.changePercent1 >= 0 ? "+" : ""}{stock.changePercent1}%
              </Badge>
            </div>

            <div className="text-center p-4 bg-muted/50 rounded-lg">
              {isPositive2 ? (
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-red-500" />
              ) : (
                <TrendingDown className="w-6 h-6 mx-auto mb-2 text-green-500" />
              )}
              <p className="text-xs text-muted-foreground mb-1">LLM預測</p>
              <p className="text-lg mb-1">${stock.predictedPrice2.toLocaleString()}</p>
              <Badge
                variant={isPositive2 ? "default" : "secondary"}
                className={`text-xs ${isPositive2
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
                  }`}
              >
                {isPositive2 ? "▲" : "▼"} {stock.changePercent2 >= 0 ? "+" : ""}{stock.changePercent2}%
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Historical Data with Tabs */}
      <Card className="p-6">
        <h3 className="text-lg mb-4">歷史數據</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="predictions" className="w-full" onValueChange={handleTabChange}>
            {/* <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="predictions">歷史預測</TabsTrigger>
              <TabsTrigger value="price">量價資料</TabsTrigger>
              <TabsTrigger value="investors">三大法人</TabsTrigger>
            </TabsList> */}

            {/* 歷史預測標籤頁 */}
            <TabsContent value="predictions" className="mt-4">
              {isPredictionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[400px] border rounded-md">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b">
                          <th className="text-left p-3 bg-muted">日期</th>
                          <th className="text-right p-3 bg-muted">NeuralProphet預測</th>
                          <th className="text-right p-3 bg-muted">LLM預測</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalPredictions.slice(0, predictionsDisplayCount).map((data, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="p-3 whitespace-nowrap">{data.date}</td>
                            <td className="p-3 text-right">${formatNumber(data.predictedPrice1)}</td>
                            <td className="p-3 text-right">${formatNumber(data.predictedPrice2)}</td>
                          </tr>
                        ))}
                        {/* 哨兵元素 */}
                        <tr ref={predictionsObserverTarget}>
                          <td colSpan={3} className="p-0 h-1"></td>
                        </tr>
                        {predictionsDisplayCount < historicalPredictions.length && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-sm text-muted-foreground bg-muted/30">
                              <div className="flex items-center justify-center gap-2">
                                <span>↓</span>
                                <span>正在加載更多...</span>
                                <span>↓</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 量價資料標籤頁 */}
            <TabsContent value="price" className="mt-4">
              <div className="overflow-y-auto max-h-[400px] border rounded-md">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b">
                        <th className="text-left p-3 bg-muted">日期</th>
                        <th className="text-right p-3 bg-muted">開盤價</th>
                        <th className="text-right p-3 bg-muted">最高價</th>
                        <th className="text-right p-3 bg-muted">最低價</th>
                        <th className="text-right p-3 bg-muted">收盤價</th>
                        <th className="text-right p-3 bg-muted">成交量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalData.slice(0, priceDisplayCount).map((data, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap">{data.date}</td>
                          <td className="p-3 text-right">{formatNumber(data.open)}</td>
                          <td className="p-3 text-right">{formatNumber(data.high)}</td>
                          <td className="p-3 text-right">{formatNumber(data.low)}</td>
                          <td className="p-3 text-right">{formatNumber(data.close)}</td>
                          <td className="p-3 text-right">{formatNumber(data.volume)}</td>
                        </tr>
                      ))}
                      {/* 哨兵元素 */}
                      <tr ref={priceObserverTarget}>
                        <td colSpan={6} className="p-0 h-1"></td>
                      </tr>
                      {priceDisplayCount < historicalData.length && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-sm text-muted-foreground bg-muted/30">
                            <div className="flex items-center justify-center gap-2">
                              <span>↓</span>
                              <span>正在加載更多...</span>
                              <span>↓</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* 三大法人標籤頁 */}
            <TabsContent value="investors" className="mt-4">
              <div className="overflow-y-auto max-h-[400px] border rounded-md">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b">
                        <th className="text-left p-3 bg-muted">日期</th>
                        <th className="text-right p-3 bg-muted">外資買賣超<br /><span className="text-xs">(千股)</span></th>
                        <th className="text-right p-3 bg-muted">投信買賣超<br /><span className="text-xs">(千股)</span></th>
                        <th className="text-right p-3 bg-muted">自營商買賣超<br /><span className="text-xs">(千股)</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalData.slice(0, investorsDisplayCount).map((data, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap">{data.date}</td>
                          <td className={`p-3 text-right ${data.foreignInvestors >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatInvestorData(data.foreignInvestors)}
                          </td>
                          <td className={`p-3 text-right ${data.investmentTrust >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatInvestorData(data.investmentTrust)}
                          </td>
                          <td className={`p-3 text-right ${data.dealers >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatInvestorData(data.dealers)}
                          </td>
                        </tr>
                      ))}
                      {/* 哨兵元素 */}
                      <tr ref={investorsObserverTarget}>
                        <td colSpan={4} className="p-0 h-1"></td>
                      </tr>
                      {investorsDisplayCount < historicalData.length && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-sm text-muted-foreground bg-muted/30">
                            <div className="flex items-center justify-center gap-2">
                              <span>↓</span>
                              <span>正在加載更多...</span>
                              <span>↓</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
}
