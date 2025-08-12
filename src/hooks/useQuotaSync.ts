import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'freemium' | 'standard' | 'premium';

// Règles de quotas par plan (recherches illimitées pour tous)
interface PlanQuotaRules {
  exports_limit: number | null;
  clipboard_copies_limit: number | null;
  favorites_limit: number | null;
}

const PLAN_QUOTA_RULES: Record<PlanType, PlanQuotaRules> = {
  freemium: {
    exports_limit: 10, // 10 exports par mois
    clipboard_copies_limit: 10,
    favorites_limit: 10,
  },
  standard: {
    exports_limit: 100, // 100 exports par mois
    clipboard_copies_limit: 100, // 100 copies par mois
    favorites_limit: 100, // 100 favoris max
  },
  premium: {
    exports_limit: 1000, // 1000 exports par mois
    clipboard_copies_limit: 1000, // 1000 copies par mois
    favorites_limit: null, // Illimité pour premium
  },
};

export const useQuotaSync = () => {
  const { user } = useAuth();
  const { planType, isSupraAdmin } = usePermissions();

  const syncUserQuotas = useCallback(async () => {
    if (!user) return;

    // Déterminer le plan effectif (supra_admin = premium)
    const effectivePlanType: PlanType = isSupraAdmin ? 'premium' : (planType as PlanType || 'freemium');
    const rules = PLAN_QUOTA_RULES[effectivePlanType];

    try {
      // Vérifier les quotas actuels
      const { data: existingQuota, error: fetchError } = await supabase
        .from('search_quotas')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Erreur lors de la récupération des quotas:', fetchError);
        return;
      }

      // Mettre à jour ou créer les quotas
      const { error: upsertError } = await supabase
        .from('search_quotas')
        .upsert({
          user_id: user.id,
          plan_type: effectivePlanType,
          exports_limit: rules.exports_limit,
          clipboard_copies_limit: rules.clipboard_copies_limit,
          favorites_limit: rules.favorites_limit,
          exports_used: existingQuota?.exports_used || 0,
          clipboard_copies_used: existingQuota?.clipboard_copies_used || 0,
          favorites_used: existingQuota?.favorites_used || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Erreur lors de la synchronisation des quotas:', upsertError);
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation des quotas:', error);
    }
  }, [user, planType, isSupraAdmin]);

  useEffect(() => {
    if (user && planType !== undefined) {
      syncUserQuotas();
    }
  }, [user, planType, isSupraAdmin, syncUserQuotas]);

  return { syncUserQuotas };
};

export { PLAN_QUOTA_RULES };