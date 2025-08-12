import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';

interface TrialData {
  started_at: string;
  expires_at: string;
  is_active: boolean;
  days_remaining: number;
  has_access: boolean;
}

export const useTrialAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [trialData, setTrialData] = useState<TrialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTrialData = async () => {
      if (!user || !currentWorkspace) {
        setIsLoading(false);
        return;
      }

      // Si le workspace n'est pas freemium, pas besoin de vérifier la période d'essai
      if (currentWorkspace.plan_type !== 'freemium') {
        setTrialData({
          started_at: '',
          expires_at: '',
          is_active: true,
          days_remaining: -1, // -1 = illimité
          has_access: true
        });
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('workspace_trials')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Erreur lors du chargement de la période d\'essai:', error);
          setIsLoading(false);
          return;
        }

        let finalData = data;
        
        if (!data) {
          // Pas de période d'essai trouvée, créer une nouvelle
          const { data: newTrial, error: insertError } = await supabase
            .from('workspace_trials')
            .insert({
              workspace_id: currentWorkspace.id,
              started_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              is_active: true
            })
            .select()
            .single();

          if (insertError) {
            console.error('Erreur lors de la création de la période d\'essai:', insertError);
            setIsLoading(false);
            return;
          }

          finalData = newTrial;
        }
        const expiresAt = new Date(finalData.expires_at);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const hasAccess = expiresAt > now;

        setTrialData({
          started_at: finalData.started_at,
          expires_at: finalData.expires_at,
          is_active: finalData.is_active,
          days_remaining: daysRemaining,
          has_access: hasAccess
        });
      } catch (error) {
        console.error('Erreur lors du chargement de la période d\'essai:', error);
      }

      setIsLoading(false);
    };

    loadTrialData();
  }, [user, currentWorkspace]);

  return {
    trialData,
    isLoading,
    isFreemium: currentWorkspace?.plan_type === 'freemium',
    hasAccess: trialData?.has_access ?? false,
    daysRemaining: trialData?.days_remaining ?? 0
  };
};