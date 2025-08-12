import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useEmissionFactorAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [premiumSources, setPremiumSources] = useState<string[]>([]);
  const [assignedSources, setAssignedSources] = useState<string[]>([]);

  useEffect(() => {
    const fetchSources = async () => {
      if (!user || !currentWorkspace) return;

      try {
        const { data: premiumSourcesData } = await supabase
          .from('fe_sources')
          .select('source_name')
          .eq('access_level', 'premium')
          .eq('is_global', true);

        if (premiumSourcesData) {
          setPremiumSources(premiumSourcesData.map(s => s.source_name));
        }

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

  const shouldBlurPremiumContent = useCallback((source: string, isPremiumSource?: boolean) => {
    if (isPremiumSource) {
      return currentWorkspace?.plan_type !== 'premium';
    }

    const isSourcePremium = premiumSources.includes(source);
    if (!isSourcePremium) return false;

    const isAssignedToWorkspace = assignedSources.includes(source);
    const hasPremiumPlan = currentWorkspace?.plan_type === 'premium';
    return !isAssignedToWorkspace && !hasPremiumPlan;
  }, [premiumSources, assignedSources, currentWorkspace?.plan_type]);

  const canUseFavorites = useCallback(() => {
    if (!user || !currentWorkspace) return false;
    return currentWorkspace.plan_type === 'premium';
  }, [user, currentWorkspace?.id, currentWorkspace?.plan_type]);

  const getSourceLabel = useCallback((isWorkspaceSpecific: boolean, source: string, isPremiumSource?: boolean) => {
    if (isWorkspaceSpecific) {
      return { variant: "secondary" as const, label: "Workspace" };
    }

    const isSourcePremium = isPremiumSource || premiumSources.includes(source);
    if (isSourcePremium) {
      return { variant: "default" as const, label: "Premium" };
    }
    return null;
  }, [premiumSources]);

  return {
    hasAccess,
    shouldBlurPremiumContent,
    getSourceLabel,
    canUseFavorites,
    user,
    currentWorkspace,
    premiumSources,
    assignedSources,
  };
};