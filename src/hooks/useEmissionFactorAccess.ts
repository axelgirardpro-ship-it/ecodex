import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useEffect } from "react";
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
        // Fetch premium sources
        const { data: premiumSourcesData } = await supabase
          .from('fe_sources')
          .select('source_name')
          .eq('access_level', 'premium')
          .eq('is_global', true);

        if (premiumSourcesData) {
          setPremiumSources(premiumSourcesData.map(s => s.source_name));
        }

        // Fetch assigned sources for current workspace
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

  const hasAccess = (source: string) => {
    if (!user) return false;
    return true; // Basic access for authenticated users
  };

  const shouldBlurPremiumContent = (source: string, isPremiumSource?: boolean) => {
    // If it's explicitly marked as premium source, check access
    if (isPremiumSource) {
      return currentWorkspace?.plan_type !== 'premium';
    }
    
    // Check if source is in premium sources list
    const isSourcePremium = premiumSources.includes(source);
    if (!isSourcePremium) {
      return false; // Not a premium source, no blurring needed
    }

    // It's a premium source - check if it's assigned to the workspace or if workspace has premium plan
    const isAssignedToWorkspace = assignedSources.includes(source);
    const hasPremiumPlan = currentWorkspace?.plan_type === 'premium';
    
    // Blur if it's premium and neither assigned nor premium plan
    return !isAssignedToWorkspace && !hasPremiumPlan;
  };

  const canUseFavorites = () => {
    if (!user || !currentWorkspace) return false;
    return currentWorkspace.plan_type === 'premium';
  };

  const getSourceLabel = (isWorkspaceSpecific: boolean, source: string, isPremiumSource?: boolean) => {
    if (isWorkspaceSpecific) {
      return {
        variant: "secondary" as const,
        label: "Workspace"
      };
    }
    
    // Check if source is premium (either explicitly marked or in premium sources list)
    const isSourcePremium = isPremiumSource || premiumSources.includes(source);
    if (isSourcePremium) {
      return {
        variant: "default" as const,
        label: "Premium"
      };
    }
    return null;
  };

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