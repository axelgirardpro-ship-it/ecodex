import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface WorkspaceTrial {
  id: string;
  workspace_id: string;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useWorkspaceTrial = () => {
  const { currentWorkspace } = useWorkspace();

  const { data: trial, isLoading, error } = useQuery({
    queryKey: ['workspace_trial', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('workspace_trials')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (error) {
        // Si aucun trial n'existe (PGRST116), retourner null sans erreur
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as WorkspaceTrial;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60000, // 1 minute
  });

  const isTrialActive = trial?.is_active && new Date(trial.expires_at) > new Date();
  const isTrialExpired = trial && (!trial.is_active || new Date(trial.expires_at) <= new Date());

  return {
    trial,
    isTrialActive,
    isTrialExpired,
    isLoading,
    error,
  };
};

