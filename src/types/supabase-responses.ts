// ============================================
// SUPABASE EDGE FUNCTION RESPONSES
// ============================================

/**
 * Types pour les réponses des Edge Functions Supabase
 * Ces types sont utilisés côté frontend pour typer les réponses API
 */

// ============================================
// WORKSPACE & USER TYPES
// ============================================

export interface WorkspaceSourceAssignment {
  id: string;
  workspace_id: string;
  source_name: string;
  assigned_at: string;
  assigned_by?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  workspace_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  owner_id?: string;
  plan_tier?: string;
  trial_ends_at?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected';
  invited_by: string;
  created_at: string;
  expires_at?: string;
}

// ============================================
// QUOTA TYPES
// ============================================

export interface QuotaUsage {
  used: number;
  limit: number;
  period: 'day' | 'month' | 'year';
  reset_at?: string;
}

export interface QuotaDetails {
  searches: QuotaUsage;
  exports: QuotaUsage;
  api_calls?: QuotaUsage;
  benchmarks?: QuotaUsage;
}

export interface QuotaResponse {
  workspace_id: string;
  quotas: QuotaDetails;
  plan_tier: string;
  is_trial: boolean;
  trial_ends_at?: string;
}

// ============================================
// IMPORT / EXPORT TYPES
// ============================================

export interface CSVImportResult {
  success: boolean;
  rows_imported: number;
  rows_failed: number;
  errors?: Array<{
    row: number;
    message: string;
  }>;
  warnings?: string[];
}

export interface BenchmarkExportData {
  id: string;
  title: string;
  created_at: string;
  items: Array<{
    objectID: string;
    Source: string;
    FE?: number;
    [key: string]: unknown;
  }>;
}

// ============================================
// ADMIN API TYPES
// ============================================

export interface AdminContact {
  id: string;
  email: string;
  full_name?: string;
  workspace_id?: string;
  workspace_name?: string;
  role?: string;
  created_at: string;
  last_login?: string;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  owner_email?: string;
  plan_tier: string;
  users_count: number;
  created_at: string;
  is_trial: boolean;
  trial_ends_at?: string;
}

// ============================================
// ALGOLIA PROXY TYPES
// ============================================

export interface AlgoliaProxyRequest {
  query: string;
  origin: 'public' | 'private';
  filters?: string;
  facetFilters?: unknown;
  facets?: string[];
  hitsPerPage?: number;
  page?: number;
}

export interface AlgoliaProxyResponse<T = unknown> {
  hits: T[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS: number;
  query: string;
  facets?: Record<string, Record<string, number>>;
  serverTimeMS?: number;
}

// ============================================
// ERROR TYPES
// ============================================

export interface EdgeFunctionError {
  error: string;
  message?: string;
  code?: string;
  details?: unknown;
}

export type EdgeFunctionResponse<T> = 
  | { data: T; error: null }
  | { data: null; error: EdgeFunctionError };

// ============================================
// BENCHMARK TYPES
// ============================================

export interface BenchmarkItem {
  objectID: string;
  Source: string;
  FE?: number;
  Date?: number;
  Nom_fr?: string;
  Nom_en?: string;
  [key: string]: unknown;
}

export interface BenchmarkGenerationRequest {
  title: string;
  query?: string;
  filters?: string;
  facetFilters?: unknown;
  items?: BenchmarkItem[];
}

export interface BenchmarkGenerationResponse {
  benchmark_id: string;
  title: string;
  items_count: number;
  created_at: string;
}

// ============================================
// UPLOAD TYPES
// ============================================

export interface ChunkedUploadMetadata {
  file_name: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  upload_id: string;
}

export interface ChunkedUploadResponse {
  upload_id: string;
  chunk_index: number;
  status: 'pending' | 'complete';
  file_path?: string;
}

