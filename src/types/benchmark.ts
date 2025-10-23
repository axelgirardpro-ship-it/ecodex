// Types pour la fonctionnalité Benchmark

export interface BenchmarkStatistics {
  sampleSize: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  mean: number;
  standardDeviation: number;
  iqr: number;
  percentRange: number;
}

export interface BenchmarkChartDataPoint {
  objectID: string;
  name: string;
  fe: number;
  unit: string;
  scope: string;
  source: string;
  date: number | null;
  localisation: string;
  sector: string;
  description?: string;
  comments?: string;
}

export interface BenchmarkEmissionFactor {
  objectID: string;
  Nom_fr: string;
  FE: number;
  Unite_fr: string;
  Périmètre_fr: string;
  Source: string;
  Date?: number;
  Localisation_fr?: string;
  Secteur_fr?: string;
  'Sous-secteur_fr'?: string;
  Description_fr?: string;
  Commentaires_fr?: string;
  Méthodologie?: string;
  Type_de_données?: string;
  Contributeur?: string;
}

export interface BenchmarkMetadata {
  query: string;
  unit: string;
  scope: string;
  sourcesCount: number;
  sources: string[];
  hasMultipleSources: boolean;
  hasMultipleYears: boolean;
  dateRange: {
    min: number;
    max: number;
  } | null;
  hasLargeSample: boolean;
}

export interface BenchmarkData {
  statistics: BenchmarkStatistics;
  chartData: BenchmarkChartDataPoint[];
  top10: BenchmarkEmissionFactor[];
  worst10: BenchmarkEmissionFactor[];
  metadata: BenchmarkMetadata;
  warnings: string[];
}

export interface BenchmarkRequest {
  query: string;
  filters?: Record<string, any>;
  facetFilters?: string[][];
  workspaceId: string;
  userId: string;
}

export interface SavedBenchmark {
  id: string;
  workspace_id: string;
  created_by: string;
  search_query: string;
  search_filters: Record<string, any> | null;
  facet_filters: string[][] | null;
  title: string;
  description: string | null;
  unit: string;
  scope: string;
  sample_size: number;
  sources: string[];
  statistics: BenchmarkStatistics;
  chart_data: BenchmarkChartDataPoint[];
  top10: BenchmarkEmissionFactor[];
  worst10: BenchmarkEmissionFactor[];
  metadata: BenchmarkMetadata;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BenchmarkHistoryItem {
  id: string;
  title: string;
  created_at: string;
  sample_size: number;
  unit: string;
}

export type DisplayMode = 25 | 50;
export type SortOrder = 'asc' | 'desc';

