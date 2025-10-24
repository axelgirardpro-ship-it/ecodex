import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { UnifiedNavbar } from '@/components/ui/UnifiedNavbar';
import { BenchmarkHeader } from '@/components/benchmark/BenchmarkHeader';
import { BenchmarkWarnings } from '@/components/benchmark/BenchmarkWarnings';
import { BenchmarkChart } from '@/components/benchmark/BenchmarkChart';
import { BenchmarkStatistics } from '@/components/benchmark/BenchmarkStatistics';
import { TopWorstTables } from '@/components/benchmark/TopWorstTables';
import { BenchmarkMetadata } from '@/components/benchmark/BenchmarkMetadata';
import { BenchmarkSkeleton } from '@/components/benchmark/BenchmarkSkeleton';
import { BenchmarkValidationError } from '@/components/benchmark/BenchmarkValidationError';
import { BenchmarkUnsavedWarning } from '@/components/benchmark/BenchmarkUnsavedWarning';
import { useBenchmarkGeneration } from '@/hooks/useBenchmarkGeneration';
import { useBenchmarkStorage } from '@/hooks/useBenchmarkStorage';
import type { DisplayMode, SortOrder } from '@/types/benchmark';

export const BenchmarkView = () => {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State pour les paramètres de recherche (depuis location.state ou query string)
  const searchParams = useMemo(() => {
    if (location.state) {
      return {
        query: location.state.query,
        filters: location.state.filters,
        facetFilters: location.state.facetFilters,
      };
    }
    // Parse query string si pas de state
    const params = new URLSearchParams(location.search);
    const filtersParam = params.get('filters');
    const facetFiltersParam = params.get('facetFilters');
    
    return {
      query: params.get('query') || '',
      filters: filtersParam ? JSON.parse(filtersParam) : undefined,
      facetFilters: facetFiltersParam ? JSON.parse(facetFiltersParam) : undefined,
    };
  }, [location]);

  // Redirection si route invalide (pas d'ID, pas de query, et pas de filtres)
  useEffect(() => {
    const hasQuery = searchParams.query && searchParams.query.trim();
    const hasFilters = (searchParams.filters && Object.keys(searchParams.filters).length > 0)
      || (searchParams.facetFilters && searchParams.facetFilters.length > 0);
    
    if (!id && !hasQuery && !hasFilters) {
      navigate('/search', { replace: true });
    }
  }, [id, searchParams, navigate]);

  // State pour l'affichage
  const [displayMode, setDisplayMode] = useState<DisplayMode>(25);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  // Hook pour benchmark sauvegardé (si ID fourni)
  const { useBenchmarkDetail, updateBenchmark } = useBenchmarkStorage();
  const { data: savedBenchmarkRaw, isLoading: isLoadingSaved } = useBenchmarkDetail(id);

  // Hook pour génération (si pas d'ID)
  // Activer la génération si query OU filtres présents
  const hasQuery = searchParams.query && searchParams.query.trim();
  const hasFilters = (searchParams.filters && Object.keys(searchParams.filters).length > 0)
    || (searchParams.facetFilters && searchParams.facetFilters.length > 0);
  
  const {
    data: generatedBenchmark,
    isLoading: isGenerating,
    error: generationError,
  } = useBenchmarkGeneration(
    searchParams.query || '',
    searchParams.filters,
    searchParams.facetFilters,
    {
      enabled: !id && (hasQuery || hasFilters),
    }
  );

  // Transformer SavedBenchmark en BenchmarkData si nécessaire
  const savedBenchmark = useMemo(() => {
    if (!savedBenchmarkRaw) return null;
    
    // Si c'est déjà au bon format (a chartData)
    if ('chartData' in savedBenchmarkRaw) {
      return savedBenchmarkRaw as any;
    }
    
    // Transformer snake_case en camelCase
    return {
      statistics: savedBenchmarkRaw.statistics,
      chartData: savedBenchmarkRaw.chart_data,
      top10: savedBenchmarkRaw.top10,
      worst10: savedBenchmarkRaw.worst10,
      metadata: savedBenchmarkRaw.metadata,
      warnings: [], // Pas de warnings dans les benchmarks sauvegardés
    };
  }, [savedBenchmarkRaw]);

  // Déterminer quelle source de données utiliser
  const benchmarkData = id ? savedBenchmark : generatedBenchmark;
  const isLoading = id ? isLoadingSaved : isGenerating;

  // Handler pour mise à jour du titre
  const handleTitleChange = async (newTitle: string) => {
    if (id) {
      // Benchmark sauvegardé : mettre à jour en base
      try {
        await updateBenchmark({ id, title: newTitle });
        setCustomTitle(newTitle);
      } catch (error) {
        console.error('Failed to update benchmark title:', error);
      }
    } else {
      // Benchmark non sauvegardé : mettre à jour le state local
      setCustomTitle(newTitle);
    }
  };

  // Calculer le titre affiché (customTitle > savedBenchmark.title > metadata.query + filtres)
  const displayTitle = useMemo(() => {
    if (customTitle) return customTitle;
    if (savedBenchmarkRaw?.title) return savedBenchmarkRaw.title;
    
    const parts: string[] = [];
    
    // 1. Ajouter la recherche si elle existe et n'est pas "Filtres uniquement"
    if (benchmarkData?.metadata.query && benchmarkData.metadata.query !== 'Filtres uniquement') {
      parts.push(benchmarkData.metadata.query);
    }
    
    // 2. Toujours afficher unité et périmètre
    if (benchmarkData?.metadata.unit && benchmarkData?.metadata.scope) {
      parts.push(`kgCO2eq/${benchmarkData.metadata.unit}`);
      parts.push(benchmarkData.metadata.scope);
    }
    
    // 3. Ajouter la source si une seule source active
    if (benchmarkData?.metadata.sources?.length === 1) {
      parts.push(benchmarkData.metadata.sources[0]);
    }
    
    return parts.join(' - ') || 'Benchmark';
  }, [customTitle, savedBenchmarkRaw, benchmarkData]);

  // Sélectionner les points à afficher selon displayMode
  const displayedChartData = useMemo(() => {
    if (!benchmarkData?.chartData) return [];

    const sortedData = sortOrder === 'desc' 
      ? [...benchmarkData.chartData].reverse()
      : [...benchmarkData.chartData].sort((a, b) => a.fe - b.fe);

    const n = sortedData.length;

    if (displayMode === 25) {
      // Top 10 + Q1±1 + Médiane±1 + Q3±1 + Worst 10 = ~25 points
      if (n <= 25) return sortedData;

      const q1Index = Math.floor(n * 0.25);
      const medianIndex = Math.floor(n * 0.5);
      const q3Index = Math.floor(n * 0.75);

      const selected = [
        ...sortedData.slice(0, 10), // Top 10 (contient min)
      ];

      // Ajouter 2 points autour de Q1
      for (let i = Math.max(10, q1Index - 1); i <= Math.min(n - 11, q1Index + 1); i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      // Ajouter 2 points autour de Médiane
      for (let i = medianIndex - 1; i <= medianIndex + 1; i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      // Ajouter 2 points autour de Q3
      for (let i = q3Index - 1; i <= Math.min(n - 11, q3Index + 1); i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      // Worst 10 (contient max)
      const worst10Start = Math.max(0, n - 10);
      for (let i = worst10Start; i < n; i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      return selected.sort((a, b) => sortOrder === 'asc' ? a.fe - b.fe : b.fe - a.fe);
    }

    if (displayMode === 50) {
      // Top 15 + Q1±2 + Médiane±2 + Q3±2 + Worst 15 = ~50 points
      if (n <= 50) return sortedData;

      const q1Index = Math.floor(n * 0.25);
      const medianIndex = Math.floor(n * 0.5);
      const q3Index = Math.floor(n * 0.75);

      const selected = [
        ...sortedData.slice(0, 15), // Top 15 (contient min)
      ];

      // 5 points autour de Q1
      for (let i = Math.max(15, q1Index - 2); i <= Math.min(n - 16, q1Index + 2); i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      // 5 points autour de Médiane
      for (let i = medianIndex - 2; i <= medianIndex + 2; i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      // 5 points autour de Q3
      for (let i = q3Index - 2; i <= Math.min(n - 16, q3Index + 2); i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      // Worst 15 (contient max)
      const worst15Start = Math.max(0, n - 15);
      for (let i = worst15Start; i < n; i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      return selected.sort((a, b) => sortOrder === 'asc' ? a.fe - b.fe : b.fe - a.fe);
    }

    return sortedData;
  }, [benchmarkData, displayMode, sortOrder]);

  // Si pas de query, pas de filtres et pas d'ID, afficher un message temporaire
  const hasQueryForDisplay = searchParams.query && searchParams.query.trim();
  const hasFiltersForDisplay = (searchParams.filters && Object.keys(searchParams.filters).length > 0)
    || (searchParams.facetFilters && searchParams.facetFilters.length > 0);
  
  if (!id && !hasQueryForDisplay && !hasFiltersForDisplay) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedNavbar />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Redirection vers le hub des benchmarks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      {/* Avertissement pour les benchmarks non sauvegardés */}
      <BenchmarkUnsavedWarning hasUnsavedChanges={!id && !!benchmarkData} />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {isLoading ? (
          <BenchmarkSkeleton />
        ) : generationError ? (
          <BenchmarkValidationError error={generationError} />
        ) : benchmarkData ? (
          <>
            <BenchmarkHeader
              title={displayTitle}
              benchmarkData={benchmarkData}
              searchParams={searchParams}
              savedBenchmarkId={id}
              benchmarkContainerId="benchmark-content"
              onTitleChange={handleTitleChange}
            />

            {benchmarkData.warnings.length > 0 && (
              <BenchmarkWarnings warnings={benchmarkData.warnings} />
            )}

            <div id="benchmark-content" className="space-y-8 mt-8">
              <BenchmarkChart
                data={displayedChartData}
                statistics={benchmarkData.statistics}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                totalCount={benchmarkData.chartData.length}
                unit={benchmarkData.metadata.unit}
                allData={benchmarkData.chartData}
              />

              <BenchmarkStatistics 
                statistics={benchmarkData.statistics}
                unit={benchmarkData.metadata.unit}
              />

              <TopWorstTables
                top10={benchmarkData.top10}
                worst10={benchmarkData.worst10}
              />

              <BenchmarkMetadata metadata={benchmarkData.metadata} />
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune donnée de benchmark disponible.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BenchmarkView;
