/**
 * Types pour les composants Admin
 */

export interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  workspace_id: string;
  workspace_name?: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Workspace {
  id: string;
  name: string;
  plan_type: 'freemium' | 'starter' | 'pro' | 'enterprise';
  created_at: string;
  updated_at?: string;
  user_count?: number;
  [key: string]: unknown;
}

export interface SourceAssignment {
  id: string;
  source_name: string;
  workspace_id: string;
  assigned_at: string;
  assigned_by?: string;
  [key: string]: unknown;
}

export interface EmissionFactorSource {
  name: string;
  access_level: 'public' | 'premium' | 'paid';
  description?: string;
  record_count?: number;
  [key: string]: unknown;
}

export interface FreemiumCompany {
  id: string;
  name: string;
  workspace_id: string;
  plan_type: string;
  user_count: number;
  created_at: string;
  [key: string]: unknown;
}

