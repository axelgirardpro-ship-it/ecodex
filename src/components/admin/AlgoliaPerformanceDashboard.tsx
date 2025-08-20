// Dashboard de performance Algolia pour les administrateurs
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { performanceMonitor, PerformanceMetrics, OptimizationRecommendation } from '@/lib/algolia/performanceMonitor';
import { algoliaCache } from '@/lib/algolia/cacheManager';
import { smartRequestManager } from '@/lib/algolia/smartThrottling';
import { smartSuggestionManager } from '@/lib/algolia/smartSuggestions';
import { TrendingUp, TrendingDown, Zap, Clock, Target, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export const AlgoliaPerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [autoTuneEnabled, setAutoTuneEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger les données
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Récupérer les métriques
      const currentMetrics = performanceMonitor.getMetrics();
      setMetrics(currentMetrics);
      
      // Générer les recommandations
      const recs = performanceMonitor.generateRecommendations();
      setRecommendations(recs);
      
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Actualiser toutes les 30 secondes
    const interval = setInterval(loadData, 30000);
    
    // Écouter les alertes
    const handleAlert = (alert: any) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Garder les 10 dernières alertes
    };
    
    performanceMonitor.onAlert(handleAlert);
    
    return () => {
      clearInterval(interval);
      performanceMonitor.offAlert(handleAlert);
    };
  }, [loadData]);

  // Auto-tuning
  const handleAutoTune = useCallback(async () => {
    const adjustments = performanceMonitor.autoTune();
    
    // Appliquer les ajustements
    if (adjustments.cacheAdjustments.increaseTTL) {
      // Note: Dans une vraie implémentation, ces ajustements seraient appliqués
      console.log('Applying cache adjustments:', adjustments.cacheAdjustments);
    }
    
    if (adjustments.throttlingAdjustments.reduceMaxRequestsPerSecond) {
      console.log('Applying throttling adjustments:', adjustments.throttlingAdjustments);
    }
    
    if (adjustments.debounceAdjustments.increaseDelay) {
      console.log('Applying debounce adjustments:', adjustments.debounceAdjustments);
    }
    
    // Recharger les données
    await loadData();
  }, [loadData]);

  // Reset des métriques
  const handleReset = useCallback(() => {
    performanceMonitor.reset();
    algoliaCache.clear();
    smartSuggestionManager.clear();
    setAlerts([]);
    loadData();
  }, [loadData]);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Chargement des métriques...</span>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSuccessRate = () => {
    if (metrics.totalRequests === 0) return 100;
    return (metrics.successfulRequests / metrics.totalRequests) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Performance Algolia</h2>
          <p className="text-gray-600">Monitoring et optimisation en temps réel</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={handleAutoTune} variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Auto-tuning
          </Button>
          <Button onClick={handleReset} variant="destructive">
            Reset
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{alerts.length} alerte(s) active(s)</strong>
            <div className="mt-2 space-y-1">
              {alerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="text-sm">
                  • {alert.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requêtes totales</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.totalRequests)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(metrics.searchesPerMinute)} par minute
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de succès</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getSuccessRate().toFixed(1)}%</div>
            <Progress value={getSuccessRate()} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps de réponse</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              P95: {metrics.p95ResponseTime.toFixed(0)}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Économies</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(metrics.estimatedCostSavings)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(metrics.totalRequestsSaved)} requêtes économisées
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="recommendations">Recommandations</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Top Search Terms */}
            <Card>
              <CardHeader>
                <CardTitle>Termes de recherche populaires</CardTitle>
                <CardDescription>Les recherches les plus fréquentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.topSearchTerms.slice(0, 5).map((term, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm">{term}</span>
                      <Badge variant="secondary">#{index + 1}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Statistiques du cache</CardTitle>
              <CardDescription>Détails de performance du système de cache</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{metrics.cacheHitRate.toFixed(1)}%</div>
                  <p className="text-sm text-muted-foreground">Taux de hit</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatNumber(metrics.cacheSize)}</div>
                  <p className="text-sm text-muted-foreground">Entrées en cache</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatNumber(metrics.duplicateRequestsAvoided)}</div>
                  <p className="text-sm text-muted-foreground">Doublons évités</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatNumber(metrics.throttledRequests)}</div>
                  <p className="text-sm text-muted-foreground">Requêtes throttlées</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{rec.title}</CardTitle>
                    <Badge variant={getPriorityColor(rec.priority) as any}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <CardDescription>{rec.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <strong>Impact:</strong> {rec.impact}
                    </div>
                    <div>
                      <strong>Action recommandée:</strong> {rec.action}
                    </div>
                    {rec.estimatedSavings && rec.estimatedSavings > 0 && (
                      <div>
                        <strong>Économies estimées:</strong> {formatCurrency(rec.estimatedSavings)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {recommendations.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Système optimisé</h3>
                    <p className="text-muted-foreground">
                      Aucune recommandation d'optimisation pour le moment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métriques détaillées</CardTitle>
              <CardDescription>Données complètes de performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Requêtes réussies:</strong> {formatNumber(metrics.successfulRequests)}
                </div>
                <div>
                  <strong>Requêtes échouées:</strong> {formatNumber(metrics.failedRequests)}
                </div>
                <div>
                  <strong>P99 temps de réponse:</strong> {metrics.p99ResponseTime.toFixed(0)}ms
                </div>
                <div>
                  <strong>Utilisateurs uniques:</strong> {formatNumber(metrics.uniqueUsers)}
                </div>
                <div>
                  <strong>Requêtes debouncées:</strong> {formatNumber(metrics.debouncedRequests)}
                </div>
                <div>
                  <strong>Dernière MAJ:</strong> {new Date(metrics.lastUpdated).toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AlgoliaPerformanceDashboard;
