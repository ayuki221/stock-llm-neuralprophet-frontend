import { Card } from "./ui/card";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";

interface SettingsPanelProps {
  upTrendEnabled: boolean;
  downTrendEnabled: boolean;
  upTrendThreshold: number;
  downTrendThreshold: number;
  onUpTrendEnabledChange: (enabled: boolean) => void;
  onDownTrendEnabledChange: (enabled: boolean) => void;
  onUpTrendThresholdChange: (value: number) => void;
  onDownTrendThresholdChange: (value: number) => void;
  onApplySettings: () => void;
}

export function SettingsPanel({
  upTrendEnabled,
  downTrendEnabled,
  upTrendThreshold,
  downTrendThreshold,
  onUpTrendEnabledChange,
  onDownTrendEnabledChange,
  onUpTrendThresholdChange,
  onDownTrendThresholdChange,
  onApplySettings
}: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">滿足設定</h2>

      {/* 上漲滿足 */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">上漲滿足</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              超過 {upTrendThreshold}% 時滿足條件
            </span>
            <Switch
              checked={upTrendEnabled}
              onCheckedChange={onUpTrendEnabledChange}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>10%</span>
            </div>
            <Slider
              value={[upTrendThreshold]}
              onValueChange={(value) => onUpTrendThresholdChange(value[0])}
              min={0}
              max={10}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* 下跌滿足 */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">下跌滿足</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              低於 {downTrendThreshold}% 時滿足條件
            </span>
            <Switch
              checked={downTrendEnabled}
              onCheckedChange={onDownTrendEnabledChange}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-10%</span>
              <span>0%</span>
            </div>
            <Slider
              value={[downTrendThreshold]}
              onValueChange={(value) => onDownTrendThresholdChange(value[0])}
              min={-10}
              max={0}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      <Button onClick={onApplySettings} className="w-full bg-blue-500 hover:bg-blue-600">
        套用
      </Button>
    </div>
  );
}