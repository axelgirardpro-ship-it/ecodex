import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuotaIndicatorProps {
  compact?: boolean;
}

export const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({ compact = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  const { data: quota, isLoading, error } = useQuery({
    queryKey: ['my-chatbot-quota'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('get-my-chatbot-quota', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated, // Only run if authenticated
    refetchInterval: 30000, // Refresh toutes les 30s
    retry: 1
  });

  if (!isAuthenticated || isLoading || !quota) {
    if (compact) {
      return null; // Ne rien afficher en mode compact si pas de données
    }
    return (
      <div className="px-4 py-3 bg-muted/50 rounded-lg text-sm">
        <div className="text-muted-foreground">
          {error ? '⚠️ Impossible de charger les quotas' : 'Chargement des quotas...'}
        </div>
      </div>
    );
  }

  const percentage = (quota.used / quota.limit) * 100;
  const isNearLimit = percentage >= 80;
  const isExceeded = quota.used >= quota.limit;
  const remaining = quota.limit - quota.used;

  // Mode compact pour le header de la modale
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 max-w-fit">
        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          {quota.plan === 'freemium' 
            ? `${quota.used} / ${quota.limit}` 
            : `${quota.used} / ${quota.limit}`}
        </span>
        <span className="text-xs text-muted-foreground">
          {quota.plan === 'freemium' ? '(trial)' : ''}
        </span>
      </div>
    );
  }

  // Mode normal (full)
  return (
    <div className="px-4 py-3 bg-muted/50 rounded-lg text-sm space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">
          {quota.plan === 'freemium' 
            ? 'Questions restantes (trial)' 
            : 'Questions ce mois'}
        </span>
        <span className="font-medium">
          {quota.used} / {quota.limit}
        </span>
      </div>
      
      <Progress 
        value={Math.min(percentage, 100)} 
        className={isNearLimit ? 'bg-orange-200' : ''}
      />
      
      {isExceeded && quota.plan === 'freemium' && (
        <Button size="sm" className="w-full" asChild>
          <Link to="/settings?tab=billing">
            ⬆️ Passer à Pro (50 questions/mois)
          </Link>
        </Button>
      )}

      {isExceeded && quota.plan === 'pro' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Quota renouvelé le {new Date(quota.resetDate).toLocaleDateString('fr')}
        </p>
      )}

      {isNearLimit && !isExceeded && (
        <p className="text-xs text-orange-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {quota.limit - quota.used} question(s) restante(s)
        </p>
      )}
    </div>
  );
};

