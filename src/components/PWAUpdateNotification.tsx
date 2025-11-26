import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { RefreshCw } from 'lucide-react';

export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新的 Service Worker 已安裝並等待激活
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });
      });

      // 檢查是否已有等待中的 Service Worker
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // 監聽 controllerchange 事件來重新載入頁面
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="p-4 shadow-lg bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-medium mb-1">有新版本可用</h3>
            <p className="text-sm text-muted-foreground mb-3">
              發現新版本，點擊更新以獲得最新功能
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleUpdate}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
                size="sm"
              >
                立即更新
              </Button>
              <Button 
                onClick={() => setShowUpdate(false)}
                variant="outline"
                size="sm"
              >
                稍後
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
