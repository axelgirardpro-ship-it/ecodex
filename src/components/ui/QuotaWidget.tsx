import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Zap, Crown, TrendingUp, AlertTriangle } from "lucide-react";

interface QuotaWidgetProps {
  quotaData: any;
  isLoading: boolean;
}

export const QuotaWidget = ({ quotaData, isLoading }: QuotaWidgetProps) => {
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
            Erreur
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Impossible de charger les informations de quota.
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
  
  // Si les limites sont null, c'est illimité (premium/supra admin)
  const isUnlimited = exportsLimit === null && clipboardCopiesLimit === null && favoritesLimit === null;
  const canExport = isUnlimited || exportsUsed < (exportsLimit || 0);
  const canCopy = isUnlimited || clipboardCopiesUsed < (clipboardCopiesLimit || 0);
  const canAddFavorite = planType === 'premium' || isUnlimited;

  const exportProgress = (isUnlimited || exportsLimit === null) ? 0 : (exportsUsed / exportsLimit) * 100;
  const clipboardProgress = (isUnlimited || clipboardCopiesLimit === null) ? 0 : (clipboardCopiesUsed / clipboardCopiesLimit) * 100;
  const favoritesProgress = (isUnlimited || favoritesLimit === null) ? 0 : (favoritesUsed / favoritesLimit) * 100;

  const isNearLimit = !isUnlimited && (exportProgress > 80 || clipboardProgress > 80 || favoritesProgress > 80);
  const isAtLimit = !canExport || !canCopy || !canAddFavorite;

  // Gestion des supra admins et plans premium/standard (affichage Premium pour Favoris)
  if (isUnlimited || planType === 'premium' || planType === 'standard') {
    const isPremium = planType === 'premium' || isUnlimited;
    
    return (
      <Card className={`bg-white border border-violet-200 ${isPremium ? 'border-primary/20' : 'border-blue-500/20'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge className={isPremium ? "bg-primary text-primary-foreground" : "bg-blue-600 text-white"}>
              {isPremium ? <Crown className="w-4 h-4 mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
              {isUnlimited ? 'Supra Admin' : isPremium ? 'Premium' : 'Standard'}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {isUnlimited || isPremium ? 'Illimité' : 'Plan payant'}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Recherches</span>
              <span className="text-primary font-medium">Illimitées ∞</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Exports</span>
              <span className="text-primary font-medium">
                {isUnlimited || isPremium ? 'Illimités ∞' : `${exportsUsed} / ${exportsLimit}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Copies presse-papiers</span>
              <span className="text-primary font-medium">
                {isUnlimited || isPremium ? 'Illimitées ∞' : `${clipboardCopiesUsed} / ${clipboardCopiesLimit}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Favoris</span>
              <span className="text-primary font-medium">
                {isPremium ? 'Illimités ∞' : 'Premium'}
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
            <Badge variant={planType === 'premium' ? "default" : planType === 'standard' ? "default" : "secondary"}>
              {planType === 'premium' ? 'Premium' : 
               planType === 'standard' ? 'Standard' :
               "Freemium"}
            </Badge>
            {isAtLimit && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Limite atteinte
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Recherches</span>
            <span className="text-primary font-medium">Illimitées ∞</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Exports Excel</span>
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
            <div className="text-xs text-muted-foreground">Non disponible en Freemium</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Copies presse-papiers</span>
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
          <div className="flex justify-between text-sm">
            <span>Favoris</span>
            <span className="text-muted-foreground">Premium</span>
          </div>
        </div>

        {isAtLimit && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Vous avez atteint vos limites mensuelles. Contactez l'administrateur pour augmenter votre plan.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};