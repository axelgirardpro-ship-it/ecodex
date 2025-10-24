/**
 * Types pour les benchmarks
 */

export type DisplayMode = 25 | 50 | 'all';
export type SortOrder = 'asc' | 'desc';

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
  localisation?: string;
  sector?: string;
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
  Date: number | null;
  Localisation_fr?: string | null;
  Secteur_fr?: string | null;
  'Sous-secteur_fr'?: string | null;
  Description_fr?: string | null;
  Commentaires_fr?: string | null;
  Méthodologie?: string | null;
  Type_de_données?: string | null;
  Contributeur?: string | null;
}

export interface BenchmarkMetadata {
  query: string;
  unit: string;
  scope: string;
  sourcesCount: number;
  sources: string[];
  hasMultipleSources: boolean;
  hasMultipleYears: boolean;
  hasLargeSample: boolean;
  dateRange: {
    min: number;
    max: number;
  } | null;
}

export interface BenchmarkData {
  statistics: BenchmarkStatistics;
  chartData: BenchmarkChartDataPoint[];
  top10: BenchmarkEmissionFactor[];
  worst10: BenchmarkEmissionFactor[];
  metadata: BenchmarkMetadata;
  warnings: string[];
}
