import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEmissionFactorAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [assignedSources, setAssignedSources] = useState<string[]>([]);
  const [standardSources, setStandardSources] = useState<string[]>([]);

  useEffect(() => {
    const fetchSources = async () => {
      if (!user || !currentWorkspace) return;

      try {
        const { data: stdData } = await supabase
          .from('fe_sources')
          .select('source_name')
          .eq('access_level', 'standard')
          .eq('is_global', true);
        if (stdData) setStandardSources(stdData.map(s => s.source_name));

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

  const shouldBlurPremiumContent = useCallback((source: string) => {
    // Nouvelle règle unique: full seulement si la source est assignée au workspace
    return !assignedSources.includes(source);
  }, [assignedSources]);

  const canUseFavorites = useCallback(() => {
    if (!user || !currentWorkspace) return false;
    return currentWorkspace.plan_type === 'premium';
  }, [user, currentWorkspace?.id, currentWorkspace?.plan_type]);

  const getSourceLabel = useCallback((isWorkspaceSpecific: boolean, source: string) => {
    if (isWorkspaceSpecific) return { variant: "secondary" as const, label: "Workspace" };
    // Facultatif: pas de label premium/standard désormais
    return null;
  }, []);

  return {
    hasAccess,
    shouldBlurPremiumContent,
    getSourceLabel,
    canUseFavorites,
    user,
    currentWorkspace,
    standardSources,
    assignedSources,
  };
};