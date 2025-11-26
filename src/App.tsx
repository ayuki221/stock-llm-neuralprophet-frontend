import { useState, useEffect } from "react";
import { SettingsPanel } from "./components/SettingsPanel";
import { StockList } from "./components/StockList";
import { StockDetail } from "./components/StockDetail";
import { Card } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { Stock, ApiError } from "./types/stock";
import { fetchStocks, fetchFilteredStocks, refreshStocksData } from "./services/api";
import { RefreshCw, AlertCircle, Moon, Sun } from "lucide-react";
import { toast } from "sonner@2.0.3";

export default function App() {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [upTrendEnabled, setUpTrendEnabled] = useState(true);
  const [downTrendEnabled, setDownTrendEnabled] = useState(true);
  const [upTrendThreshold, setUpTrendThreshold] = useState(5);
  const [downTrendThreshold, setDownTrendThreshold] = useState(-5);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 從 localStorage 讀取主題設定
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  // 初始化載入股票資料
  useEffect(() => {
    loadStocks();
  }, []);

  // 主題切換效果
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // 註冊 Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker 註冊成功:', registration.scope);
          })
          .catch((error) => {
            console.log('Service Worker 註冊失敗:', error);
          });
      });
    }
  }, []);

  // 載入股票資料
  const loadStocks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchStocks();
      setFilteredStocks(response.data);
      toast.success('股票資料載入成功');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
      toast.error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新股票資料
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const response = await refreshStocksData();
      setFilteredStocks(response.data);
      toast.success(response.message || '資料已更新');
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStockClick = (stock: Stock) => {
    setSelectedStock(stock);
  };

  const handleBack = () => {
    setSelectedStock(null);
  };

  const handleApplySettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetchFilteredStocks({
        upTrendEnabled,
        downTrendEnabled,
        upTrendThreshold,
        downTrendThreshold
      });
      
      setFilteredStocks(response.data);
      toast.success(`找到 ${response.data.length} 支符合條件的股票`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
      toast.error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedStock) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] p-6 transition-colors">
          <div className="max-w-4xl mx-auto">
            {/* Theme Toggle Button */}
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="flex items-center gap-2"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4" />
                    淺色模式
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    深色模式
                  </>
                )}
              </Button>
            </div>
            <StockDetail stock={selectedStock} onBack={handleBack} />
          </div>
        </div>
        <Toaster />
        <PWAInstallPrompt />
        <PWAUpdateNotification />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] p-6 transition-colors">
        <div className="max-w-7xl mx-auto">
          {/* Theme Toggle Button */}
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex items-center gap-2"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4" />
                  淺色模式
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  深色模式
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Settings Panel */}
            <div className="lg:col-span-1">
              <SettingsPanel
                upTrendEnabled={upTrendEnabled}
                downTrendEnabled={downTrendEnabled}
                upTrendThreshold={upTrendThreshold}
                downTrendThreshold={downTrendThreshold}
                onUpTrendEnabledChange={setUpTrendEnabled}
                onDownTrendEnabledChange={setDownTrendEnabled}
                onUpTrendThresholdChange={setUpTrendThreshold}
                onDownTrendThresholdChange={setDownTrendThreshold}
                onApplySettings={handleApplySettings}
              />
            </div>

            {/* Stock List */}
            <div className="lg:col-span-3">
              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-medium mb-2">所有股票</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>股票市場本日異動 {new Date().toLocaleDateString()}</span>
                      <span>共 {filteredStocks.length} 支股票</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium">載入失敗</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadStocks}
                        className="mt-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        重試
                      </Button>
                    </div>
                  </div>
                )}
                
                <StockList 
                  stocks={filteredStocks} 
                  onStockClick={handleStockClick}
                  isLoading={isLoading}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
      <PWAInstallPrompt />
      <PWAUpdateNotification />
    </>
  );
}