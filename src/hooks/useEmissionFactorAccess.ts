import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SourceMetadata {
  access_level: 'free' | 'paid';
  is_global: boolean;
}

export const useEmissionFactorAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [assignedSources, setAssignedSources] = useState<string[]>([]);
  const [freeSources, setFreeSources] = useState<string[]>([]);
  const [sourcesMetadata, setSourcesMetadata] = useState<Map<string, SourceMetadata>>(new Map());

  useEffect(() => {
    const fetchSources = async () => {
      if (!user || !currentWorkspace) return;

      try {
        // Récupérer toutes les sources avec leurs métadonnées (free/paid)
        const { data: allSourcesData } = await supabase
          .from('fe_sources')
          .select('source_name, access_level, is_global')
          .eq('is_global', true);

        if (allSourcesData) {
          // Créer la map des métadonnées
          const metadataMap = new Map<string, SourceMetadata>();
          const freeSourcesList: string[] = [];

          allSourcesData.forEach(source => {
            metadataMap.set(source.source_name, {
              access_level: source.access_level as 'free' | 'paid',
              is_global: source.is_global
            });

            if (source.access_level === 'free') {
              freeSourcesList.push(source.source_name);
            }
          });

          setSourcesMetadata(metadataMap);
          setFreeSources(freeSourcesList);
        }

        // Récupérer les sources assignées au workspace
        const { data: assignedSourcesData } = await supabase
          .from('fe_source_workspace_assignments')
          .select('source_name')
          .eq('workspace_id', currentWorkspace.id);

        if (assignedSourcesData) {
          setAssignedSources(assignedSourcesData.map(s => s.source_name));
        }
      } catch (error) {
        console.error('Error fetching source data:', error);
      }
    };

    fetchSources();
  }, [user, currentWorkspace]);

  const hasAccess = useCallback((source: string) => {
    if (!user) return false;
    return true;
  }, [user]);

  const shouldBlurPaidContent = useCallback((source: string) => {
    // Nouvelle règle unique: full seulement si la source est assignée au workspace
    return !assignedSources.includes(source);
  }, [assignedSources]);

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