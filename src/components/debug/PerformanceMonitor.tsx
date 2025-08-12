import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Clock, RefreshCw, Database, TrendingUp } from 'lucide-react';

interface PerformanceMonitorProps {
  getMetrics?: () => {
    lastLoadTime: number;
    averageLoadTime: number;
    favoriteCount: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

export const PerformanceMonitor = ({ getMetrics }: PerformanceMonitorProps) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development');
  }, []);

  const refreshMetrics = () => {
    if (getMetrics) {
      setMetrics(getMetrics());
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getPerformanceStatus = (loadTime: number) => {
    if (loadTime < 500) return { color: 'bg-green-500', label: 'Excellent' };
    if (loadTime < 1000) return { color: 'bg-yellow-500', label: 'Bon' };
    return { color: 'bg-red-500', label: 'Lent' };
  };

  if (!isVisible) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-80 border-2 border-blue-200 bg-blue-50/90 backdrop-blur z-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Performance Monitor
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={refreshMetrics}
            className="h-6 px-2"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {metrics ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Dernier chargement:</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge 
                  variant="outline" 
                  className={`${getPerformanceStatus(metrics.lastLoadTime).color} text-white border-none`}
                >
                  {formatTime(metrics.lastLoadTime)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {getPerformanceStatus(metrics.lastLoadTime).label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Temps moyen:</span>
              </div>
              <Badge variant="outline">
                {formatTime(metrics.averageLoadTime)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>Cache hit ratio:</span>
              </div>
              <Badge variant="outline">
                {metrics.cacheHits + metrics.cacheMisses > 0 
                  ? `${Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100)}%`
                  : 'N/A'
                }
              </Badge>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-2">
              <div>Favoris: {metrics.favoriteCount}</div>
              <div>Cache hits: {metrics.cacheHits} | Misses: {metrics.cacheMisses}</div>
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Cliquez sur Actualiser pour voir les métriques
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-2">
          <div className="font-medium text-blue-600">Optimisations actives:</div>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Cache intelligent avec TTL</li>
            <li>Requêtes optimisées</li>
            <li>Mémorisation des filtres</li>
            <li>Mise à jour optimiste</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};