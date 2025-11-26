import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ChevronRight } from "lucide-react";
import { Stock } from "../types/stock";

interface StockListProps {
  stocks: Stock[];
  onStockClick: (stock: Stock) => void;
  isLoading?: boolean;
}

export function StockList({ stocks, onStockClick, isLoading = false }: StockListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 bg-muted rounded w-12"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded w-20 ml-auto"></div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-5 bg-muted rounded w-12"></div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-6 bg-muted rounded w-24"></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">沒有符合條件的股票</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stocks.map((stock) => (
        <Card
          key={stock.code}
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onStockClick(stock)}
        >
          {/* 桌面版佈局 */}
          <div className="hidden md:flex items-center justify-between gap-4">
            {/* 股票名稱和代碼 */}
            <div className="min-w-[120px]">
              <div className="text-sm text-muted-foreground mb-1">股票</div>
              <div>
                <div>{stock.name}</div>
                <div className="text-sm text-muted-foreground">{stock.code}</div>
              </div>
            </div>

            {/* 目前股價 */}
            <div className="min-w-[100px]">
              <div className="text-sm text-muted-foreground mb-1">目前股價</div>
              <div>{stock.currentPrice.toLocaleString()}</div>
            </div>

            {/* NeuralProphet預測 */}
            <div className="min-w-[140px]">
              <div className="text-sm text-muted-foreground mb-1">NeuralProphet預測</div>
              <div className="flex items-center gap-2">
                <span>{stock.predictedPrice1.toLocaleString()}</span>
                <Badge
                  variant={stock.change1 >= 0 ? "default" : "secondary"}
                  className={`text-xs whitespace-nowrap ${stock.change1 >= 0
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                >
                  {stock.change1 >= 0 ? "▲" : "▼"} {stock.changePercent1 >= 0 ? "+" : ""}{stock.changePercent1}%
                </Badge>
              </div>
            </div>

            {/* LLM預測 */}
            <div className="min-w-[140px]">
              <div className="text-sm text-muted-foreground mb-1">LLM預測</div>
              <div className="flex items-center gap-2">
                <span>{stock.predictedPrice2.toLocaleString()}</span>
                <Badge
                  variant={stock.change2 >= 0 ? "default" : "secondary"}
                  className={`text-xs whitespace-nowrap ${stock.change2 >= 0
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                >
                  {stock.change2 >= 0 ? "▲" : "▼"} {stock.changePercent2 >= 0 ? "+" : ""}{stock.changePercent2}%
                </Badge>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>

          {/* 手機版佈局 */}
          <div className="md:hidden">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span>{stock.name}</span>
                  <span className="text-sm text-muted-foreground">{stock.code}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  目前股價
                </div>
                <div className="mt-1">{stock.currentPrice.toLocaleString()}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">NeuralProphet預測</div>
                <div className="mb-1">{stock.predictedPrice1.toLocaleString()}</div>
                <Badge
                  variant={stock.change1 >= 0 ? "default" : "secondary"}
                  className={`text-xs whitespace-nowrap ${stock.change1 >= 0
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                >
                  {stock.change1 >= 0 ? "▲" : "▼"} {stock.changePercent1 >= 0 ? "+" : ""}{stock.changePercent1}%
                </Badge>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">LLM預測</div>
                <div className="mb-1">{stock.predictedPrice2.toLocaleString()}</div>
                <Badge
                  variant={stock.change2 >= 0 ? "default" : "secondary"}
                  className={`text-xs whitespace-nowrap ${stock.change2 >= 0
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                >
                  {stock.change2 >= 0 ? "▲" : "▼"} {stock.changePercent2 >= 0 ? "+" : ""}{stock.changePercent2}%
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
