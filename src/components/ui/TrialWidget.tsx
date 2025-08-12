import React from 'react';
import { useTrialAccess } from '@/hooks/useTrialAccess';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle } from 'lucide-react';

export const TrialWidget: React.FC = () => {
  const { trialData, isLoading, isFreemium, hasAccess, daysRemaining } = useTrialAccess();

  if (isLoading || !isFreemium) {
    return null;
  }

  if (!trialData || !hasAccess) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm font-medium text-destructive">
          Période d'essai expirée
        </span>
      </div>
    );
  }

  const progressValue = Math.max(0, (daysRemaining / 7) * 100);
  const isNearExpiry = daysRemaining <= 2;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 border">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Période d'essai</span>
          <Badge variant={isNearExpiry ? "destructive" : "secondary"} className="text-xs">
            {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
          </Badge>
        </div>
        <Progress 
          value={progressValue} 
          className="h-2" 
        />
      </div>
    </div>
  );
};