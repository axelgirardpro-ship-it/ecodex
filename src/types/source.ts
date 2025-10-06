/**
 * Type de niveau d'accès pour les sources de données
 * - free: Source gratuite, accessible par tous les workspaces
 * - paid: Source payante, accessible uniquement si assignée manuellement au workspace
 */
export type SourceAccessLevel = 'free' | 'paid';

export interface FeSource {
  id: string;
  source_name: string;
  access_level: SourceAccessLevel;
  is_global: boolean;
  auto_detected: boolean;
  created_at: string;
  updated_at: string;
}

