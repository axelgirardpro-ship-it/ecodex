import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useCallback, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from '@/lib/queryKeys';

interface SourceMetadata {
  access_level: 'free' | 'paid';
  is_global: boolean;
}

// Fonctions de fetch isolées pour React Query
const fetchGlobalSources = async () => {
  const { data, error } = await supabase
    .from('fe_sources')
    .select('source_name, access_level, is_global')
    .eq('is_global', true);
  if (error) throw error;
  return data;
};

const fetchWorkspaceAssignments = async (workspaceId: string) => {
  const { data, error } = await supabase
    .from('fe_source_workspace_assignments')
    .select('source_name')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return data;
};

export const useEmissionFactorAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  // Query pour sources globales (cache long car données statiques)
  const { data: globalSourcesData } = useQuery({
    queryKey: queryKeys.sources.global,
    queryFn: fetchGlobalSources,
    staleTime: 300000, // 5 minutes (données statiques)
    gcTime: 600000, // 10 minutes
  });

  // Query pour assignments workspace
  const { data: assignmentsData } = useQuery({
    queryKey: queryKeys.sources.workspace(currentWorkspace?.id || ''),
    queryFn: () => fetchWorkspaceAssignments(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
    staleTime: 60000, // 1 minute
    gcTime: 120000,
  });

  // Calcul des états dérivés (identique à l'original)
  const sourcesMetadata = useMemo(() => {
    const map = new Map<string, SourceMetadata>();
    globalSourcesData?.forEach(source => {
      map.set(source.source_name, {
        access_level: source.access_level as 'free' | 'paid',
        is_global: source.is_global
      });
    });
    return map;
  }, [globalSourcesData]);

  const freeSources = useMemo(() => {
    return globalSourcesData
      ?.filter(s => s.access_level === 'free')
      .map(s => s.source_name) || [];
  }, [globalSourcesData]);

  const assignedSources = useMemo(() => {
    return assignmentsData?.map(s => s.source_name) || [];
  }, [assignmentsData]);

  const hasAccess = useCallback((source: string) => {
    if (!user) return false;
    return true;
  }, [user]);

  const shouldBlurPaidContent = useCallback((source: string) => {
    const metadata = sourcesMetadata.get(source);
    if (!metadata) return false; // Source inconnue = pas de blur par défaut
    
    // Si la source est 'free', jamais de blur (accessible à tous)
    if (metadata.access_level === 'free') return false;
    
    // Si 'paid', blur uniquement si non-assignée au workspace
    return !assignedSources.includes(source);
  }, [sourcesMetadata, assignedSources]);

  const canUseFavorites = useCallback(() => {
    // Les favoris sont disponibles pour tous les plans (Freemium et Pro)
    // La limite de quotas est gérée par useQuotas
    if (!user || !currentWorkspace) return false;
    return true; // Tous les plans ont accès aux favoris
  }, [user, currentWorkspace]);

  const getSourceLabel = useCallback((isWorkspaceSpecific: boolean, source: string) => {
    if (isWorkspaceSpecific) return { variant: "secondary" as const, label: "Workspace" };
    return null;
  }, []);

  // Nouvelle fonction pour vérifier si une source est verrouillée (payante et non assignée)
  const isSourceLocked = useCallback((sourceName: string): boolean => {
    const metadata = sourcesMetadata.get(sourceName);
    if (!metadata) return false; // Source inconnue = non verrouillée par défaut

    const isPaid = metadata.access_level === 'paid';
    const isAssigned = assignedSources.includes(sourceName);

    return isPaid && !isAssigned;
  }, [sourcesMetadata, assignedSources]);

  return {
    hasAccess,
    shouldBlurPaidContent,
    getSourceLabel,
    canUseFavorites,
    isSourceLocked,
    user,
    currentWorkspace,
    freeSources,
    assignedSources,
    sourcesMetadata,
  };
};