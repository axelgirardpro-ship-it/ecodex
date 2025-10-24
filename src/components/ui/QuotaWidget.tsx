import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Zap, Crown, TrendingUp, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface QuotaWidgetProps {
  quotaData: Record<string, unknown>;
  isLoading: boolean;
}

export const QuotaWidget = ({ quotaData, isLoading }: QuotaWidgetProps) => {
  const { t } = useTranslation('quota');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quotaData) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {t('widget.error.badge')}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('widget.error.description')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Parse quota data (recherches illimitées pour tous)
  const exportsUsed = quotaData.exports_used || 0;
  const exportsLimit = quotaData.exports_limit;
  const clipboardCopiesUsed = quotaData.clipboard_copies_used || 0;
  const clipboardCopiesLimit = quotaData.clipboard_copies_limit;
  const favoritesUsed = quotaData.favorites_used || 0;
  const favoritesLimit = quotaData.favorites_limit;
  const planType = quotaData.plan_type || 'freemium';
  
  // Si les limites sont null, c'est illimité (pro/supra admin)
  const isUnlimited = exportsLimit === null && clipboardCopiesLimit === null && favoritesLimit === null;
  const canExport = isUnlimited || exportsUsed < (exportsLimit || 0);
  const canCopy = isUnlimited || clipboardCopiesUsed < (clipboardCopiesLimit || 0);
  const canAddFavorite = planType === 'pro' || isUnlimited;

  const exportProgress = (isUnlimited || exportsLimit === null) ? 0 : (exportsUsed / exportsLimit) * 100;
  const clipboardProgress = (isUnlimited || clipboardCopiesLimit === null) ? 0 : (clipboardCopiesUsed / clipboardCopiesLimit) * 100;
  const favoritesProgress = (isUnlimited || favoritesLimit === null) ? 0 : (favoritesUsed / favoritesLimit) * 100;

  const isNearLimit = !isUnlimited && (exportProgress > 80 || clipboardProgress > 80 || favoritesProgress > 80);
  const isAtLimit = !canExport || !canCopy || !canAddFavorite;

  // Gestion des supra admins et plans pro (affichage Pro pour Favoris)
  if (isUnlimited || planType === 'pro') {
    const isPro = planType === 'pro' || isUnlimited;
    
    return (
      <Card className={`bg-white border border-violet-200 ${isPro ? 'border-primary/20' : 'border-blue-500/20'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge className={isPro ? "bg-primary text-primary-foreground" : "bg-blue-600 text-white"}>
              {t(isUnlimited ? 'plan.supra' : 'plan.pro')}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {t(isUnlimited || isPro ? 'widget.pro.description_unlimited' : 'widget.pro.description_paid')}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('searches.label')}</span>
              <span className="text-primary font-medium">{t('limits.unlimited')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('exports.label')}</span>
              <span className="text-primary font-medium">
                {isUnlimited || isPro ? t('limits.unlimited') : `${exportsUsed} / ${exportsLimit}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('clipboard.label')}</span>
              <span className="text-primary font-medium">
                {isUnlimited || isPro ? t('limits.unlimited') : `${clipboardCopiesUsed} / ${clipboardCopiesLimit}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('favorites.label')}</span>
              <span className="text-primary font-medium">
                {isPro ? t('limits.unlimited') : t('favorites.pro_only')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border border-violet-200 ${isAtLimit ? "border-destructive/50" : isNearLimit ? "border-yellow-500/50" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={planType === 'pro' ? "default" : "secondary"}>
              {t(planType === 'pro' ? 'plan.pro' : 'plan.freemium')}
            </Badge>
            {isAtLimit && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {t('limits.reached')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('searches.label')}</span>
            <span className="text-primary font-medium">{t('limits.unlimited')}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('exports.label')}</span>
            <span className={!canExport ? "text-destructive font-medium" : ""}>
              {exportsUsed} / {(isUnlimited || exportsLimit === null) ? "∞" : exportsLimit || 0}
            </span>
          </div>
          {!isUnlimited && exportsLimit !== null && exportsLimit > 0 && (
            <Progress 
              value={exportProgress} 
              className={`h-2 ${exportProgress > 90 ? "bg-destructive/20" : exportProgress > 80 ? "bg-yellow-500/20" : ""}`}
            />
          )}
          {exportsLimit === 0 && (
            <div className="text-xs text-muted-foreground">{t('limits.messages.freemium_note')}</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('clipboard.label')}</span>
            <span className={clipboardCopiesLimit !== null && clipboardCopiesUsed >= clipboardCopiesLimit ? "text-destructive font-medium" : ""}>
              {clipboardCopiesLimit === null ? "Illimitées ∞" : `${clipboardCopiesUsed} / ${clipboardCopiesLimit}`}
            </span>
          </div>
          {clipboardCopiesLimit !== null && (
            <Progress 
              value={(clipboardCopiesUsed / clipboardCopiesLimit) * 100} 
              className={`h-2 ${(clipboardCopiesUsed / clipboardCopiesLimit) > 0.9 ? "bg-destructive/20" : (clipboardCopiesUsed / clipboardCopiesLimit) > 0.8 ? "bg-yellow-500/20" : ""}`}
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify_between text-sm">
            <span>{t('favorites.label')}</span>
            <span className="text-muted-foreground">{t('favorites.pro_only')}</span>
          </div>
        </div>

        {isAtLimit && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              {t('limits.messages.reached')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};