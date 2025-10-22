import React, { useState, useMemo } from 'react';
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

  // State pour l'affichage
  const [displayMode, setDisplayMode] = useState<DisplayMode>(25);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Hook pour benchmark sauvegardé (si ID fourni)
  const { useBenchmarkDetail } = useBenchmarkStorage();
  const { data: savedBenchmarkRaw, isLoading: isLoadingSaved } = useBenchmarkDetail(id);

  // Hook pour génération (si pas d'ID)
  const {
    data: generatedBenchmark,
    isLoading: isGenerating,
    error: generationError,
  } = useBenchmarkGeneration(
    searchParams.query,
    searchParams.filters,
    searchParams.facetFilters,
    {
      enabled: !id && !!searchParams.query,
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

  // Sélectionner les points à afficher selon displayMode
  const displayedChartData = useMemo(() => {
    if (!benchmarkData?.chartData) return [];

    const sortedData = sortOrder === 'desc' 
      ? [...benchmarkData.chartData].reverse()
      : [...benchmarkData.chartData].sort((a, b) => a.fe - b.fe);

    const n = sortedData.length;

    if (displayMode === 25) {
      // Top 10 + Q1 + Médiane + Q3 + Worst 10 = 25 points environ
      if (n <= 25) return sortedData;

      const q1Index = Math.floor(n * 0.25);
      const medianIndex = Math.floor(n * 0.5);
      const q3Index = Math.floor(n * 0.75);

      const selected = [
        ...sortedData.slice(0, 10), // Top 10
      ];

      // Ajouter Q1, Médiane, Q3 si pas déjà présents
      if (!selected.find(p => p.objectID === sortedData[q1Index].objectID)) {
        selected.push(sortedData[q1Index]);
      }
      if (!selected.find(p => p.objectID === sortedData[medianIndex].objectID)) {
        selected.push(sortedData[medianIndex]);
      }
      if (!selected.find(p => p.objectID === sortedData[q3Index].objectID)) {
        selected.push(sortedData[q3Index]);
      }
      
      // Worst 10
      const worst10Start = Math.max(0, n - 10);
      for (let i = worst10Start; i < n; i++) {
        if (!selected.find(p => p.objectID === sortedData[i].objectID)) {
          selected.push(sortedData[i]);
        }
      }

      return selected.sort((a, b) => sortOrder === 'asc' ? a.fe - b.fe : b.fe - a.fe);
    }

    if (displayMode === 50) {
      // Échantillonnage stratifié pour 50 points
      if (n <= 50) return sortedData;

      const selected: typeof sortedData = [];
      const step = n / 50;

      for (let i = 0; i < 50; i++) {
        const index = Math.floor(i * step);
        selected.push(sortedData[index]);
      }

      return selected.sort((a, b) => sortOrder === 'asc' ? a.fe - b.fe : b.fe - a.fe);
    }

    if (displayMode === 100) {
      // Échantillonnage stratifié pour 100 points
      if (n <= 100) return sortedData;

      const selected: typeof sortedData = [];
      const step = n / 100;

      for (let i = 0; i < 100; i++) {
        const index = Math.floor(i * step);
        selected.push(sortedData[index]);
      }

      return selected.sort((a, b) => sortOrder === 'asc' ? a.fe - b.fe : b.fe - a.fe);
    }

    return sortedData;
  }, [benchmarkData, displayMode, sortOrder]);

  // Redirection si pas de query et pas d'ID avec useEffect pour éviter les erreurs
  React.useEffect(() => {
    if (!id && !searchParams.query) {
      navigate('/benchmark');
    }
  }, [id, searchParams.query, navigate]);

  // Si pas de query ni d'ID, afficher un message temporaire
  if (!id && !searchParams.query) {
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
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {isLoading ? (
          <BenchmarkSkeleton />
        ) : generationError ? (
          <BenchmarkValidationError error={generationError} />
        ) : benchmarkData ? (
          <>
            <BenchmarkHeader
              title={savedBenchmarkRaw?.title || `Benchmark : ${benchmarkData.metadata.query} - ${benchmarkData.metadata.unit} - ${benchmarkData.metadata.scope}`}
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              benchmarkData={benchmarkData}
              searchParams={searchParams}
              savedBenchmarkId={id}
              benchmarkContainerId="benchmark-content"
            />

            {benchmarkData.warnings.length > 0 && (
              <BenchmarkWarnings warnings={benchmarkData.warnings} />
            )}

            <div id="benchmark-content" className="space-y-8 mt-8">
              <BenchmarkChart
                data={displayedChartData}
                statistics={benchmarkData.statistics}
                displayMode={displayMode}
                totalCount={benchmarkData.chartData.length}
                allData={benchmarkData.chartData}
              />

              <BenchmarkStatistics statistics={benchmarkData.statistics} />

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
