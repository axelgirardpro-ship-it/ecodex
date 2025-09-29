import React, { useState } from 'react';
import { ChevronDown, Crown, Zap, AlertCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PlanType } from '@/hooks/useQuotaSync';
import { TrialWidget } from './TrialWidget';
import { useTranslation } from 'react-i18next';

interface QuotaData {
  plan_type: PlanType;
  exports_used: number;
  exports_limit: number | null;
  clipboard_copies_used: number;
  clipboard_copies_limit: number | null;
  favorites_used: number;
}

interface NavbarQuotaWidgetProps {
  quotaData: QuotaData | null;
  isLoading: boolean;
  isAtLimit?: boolean;
}

export const NavbarQuotaWidget: React.FC<NavbarQuotaWidgetProps> = ({ quotaData, isLoading, isAtLimit = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation('quota' as any);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2" aria-live="polite">
        <div className="h-6 w-20 bg-primary/20 rounded animate-pulse" />
        <span className="sr-only">{(t as any)('loading')}</span>
      </div>
    );
  }

  if (!quotaData) {
    return (
      <div className="flex items-center space-x-2 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{(t as any)('errors.generic')}</span>
      </div>
    );
  }

  const planType = quotaData.plan_type;
  const exportsUsed = quotaData.exports_used;
  const exportsLimit = quotaData.exports_limit;
  const clipboardCopiesUsed = quotaData.clipboard_copies_used;
  const clipboardCopiesLimit = quotaData.clipboard_copies_limit;

  const exportProgress = exportsLimit === null ? 0 : (exportsUsed / exportsLimit) * 100;
  const clipboardProgress = clipboardCopiesLimit === null ? 0 : (clipboardCopiesUsed / clipboardCopiesLimit) * 100;

  const getPlanIcon = () => {
    if (planType === 'premium') return <Crown className="h-4 w-4" />;
    if (planType === 'standard') return <Zap className="h-4 w-4" />;
    return null;
  };

  const getPlanLabel = () => {
    if (planType === 'premium') return (t as any)('plan.premium');
    if (planType === 'standard') return (t as any)('plan.standard');
    return (t as any)('plan.freemium');
  };

  const getExportDisplay = () => {
    if (exportsLimit === null) return (t as any)('limits.unlimited');
    if (exportsLimit === 0) return (t as any)('limits.not_available');
    return (t as any)('limits.used_over_total', { used: exportsUsed, total: exportsLimit });
  };

  const getClipboardDisplay = () => {
    if (clipboardCopiesLimit === null) return (t as any)('limits.unlimited');
    return (t as any)('limits.used_over_total', { used: clipboardCopiesUsed, total: clipboardCopiesLimit ?? 0 });
  };

  const getFavoritesDisplay = () => {
    if (planType !== 'premium') return (t as any)('favorites.premium_only');
    return (t as any)('limits.unlimited');
  };

  // Pour premium et standard, affichage simplifié
  const isPremiumOrStandard = planType === 'premium' || planType === 'standard';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 ${isAtLimit ? 'bg-destructive hover:bg-destructive/90' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={(t as any)('plan.title', { plan: getPlanLabel() })}
      >
        {getPlanIcon()}
        <span className="whitespace-nowrap">{getPlanLabel()}</span>
        {isAtLimit && (
          <AlertTriangle className="h-3 w-3 text-destructive" />
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-72 bg-popover rounded-lg shadow-lg border border-border z-20">
            <div className="p-4">
              <div className="mb-4">
                <TrialWidget />
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-foreground">{(t as any)('plan.title', { plan: getPlanLabel() })}</h3>
                  {getPlanIcon()}
                </div>
                {isAtLimit && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {(t as any)('limits.reached')}
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{(t as any)('searches.label')}</span>
                    <span className="text-sm font-medium text-success">{(t as any)('limits.unlimited')}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{(t as any)('exports.label')}</span>
                    <span className={`text-sm font-medium ${exportProgress >= 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {getExportDisplay()}
                    </span>
                  </div>
                  {!isPremiumOrStandard && exportsLimit !== null && exportsLimit > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          exportProgress >= 100 ? 'bg-destructive' :
                          exportProgress > 80 ? 'bg-amber-500' : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(exportProgress, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{(t as any)('clipboard.label')}</span>
                    <span className={`text-sm font-medium ${clipboardProgress >= 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {getClipboardDisplay()}
                    </span>
                  </div>
                  {!isPremiumOrStandard && clipboardCopiesLimit !== null && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          clipboardProgress >= 100 ? 'bg-destructive' :
                          clipboardProgress > 80 ? 'bg-amber-500' : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(clipboardProgress, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{(t as any)('favorites.label')}</span>
                    <span className={`text-sm font-medium ${planType === 'premium' ? 'text-success' : 'text-muted-foreground'}`}>
                      {getFavoritesDisplay()}
                    </span>
                  </div>
                </div>

                {isAtLimit && planType === 'freemium' && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                    <p className="text-xs text-destructive leading-relaxed">
                      {(t as any)('limits.messages.reached')}
                    </p>
                  </div>
                )}

                {!isAtLimit && planType === 'freemium' && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {(t as any)('limits.messages.contact_admin')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};