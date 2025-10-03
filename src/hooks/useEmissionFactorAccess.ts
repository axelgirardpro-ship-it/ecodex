import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEmissionFactorAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [assignedSources, setAssignedSources] = useState<string[]>([]);
  const [freeSources, setFreeSources] = useState<string[]>([]);

  useEffect(() => {
    const fetchSources = async () => {
      if (!user || !currentWorkspace) return;

      try {
        const { data: freeData } = await supabase
          .from('fe_sources')
          .select('source_name')
          .eq('access_level', 'free')
          .eq('is_global', true);
        if (freeData) setFreeSources(freeData.map(s => s.source_name));

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
    if (!user || !currentWorkspace) return false;
    return currentWorkspace.plan_type === 'pro';
  }, [user, currentWorkspace?.id, currentWorkspace?.plan_type]);

  const getSourceLabel = useCallback((isWorkspaceSpecific: boolean, source: string) => {
    if (isWorkspaceSpecific) return { variant: "secondary" as const, label: "Workspace" };
    // Facultatif: pas de label paid/free désormais
    return null;
  }, []);

  return {
    hasAccess,
    shouldBlurPaidContent,
    getSourceLabel,
    canUseFavorites,
    user,
    currentWorkspace,
    freeSources,
    assignedSources,
  };
};