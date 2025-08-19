import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeSources } from '@/contexts/FeSourcesContext'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Shield, Crown, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface SourceAccessData {
  source: string;
  current_tier: 'standard' | 'premium';
  standard_count: number;
  premium_count: number;
  total_count: number;
}

interface UpdateState {
  [source: string]: {
    loading: boolean;
    success: boolean;
  };
}

export const EmissionFactorAccessManager = () => {
  const [sourceData, setSourceData] = useState<SourceAccessData[]>([]);
  const [updateStates, setUpdateStates] = useState<UpdateState>({});
  const { toast } = useToast();

  const { sources, refresh, loading: sourcesLoading } = useFeSources()

  // Derive table data from context sources; avoid extra timers/state
  useEffect(() => {
    const finalData: SourceAccessData[] = (sources || []).map((source: any) => ({
      source: source.source_name,
      current_tier: source.access_level as 'standard' | 'premium',
      standard_count: source.access_level === 'standard' ? 1 : 0,
      premium_count: source.access_level === 'premium' ? 1 : 0,
      total_count: 1,
    })) || [];
    setSourceData(finalData);
  }, [sources]);

  const updateSourceTier = useCallback(async (source: string, newTier: 'standard' | 'premium') => {
    // Set loading state for this specific source
    setUpdateStates(prev => ({
      ...prev,
      [source]: { loading: true, success: false }
    }));

    try {
      console.log(`🚀 Starting update for source: ${source} to tier: ${newTier}`);
      
      // Update the fe_sources table
      const { error } = await supabase
        .from('fe_sources')
        .update({ access_level: newTier })
        .eq('source_name', source);

      if (error) throw error;

      console.log(`✅ Successfully updated source ${source} to ${newTier}`);

      // Déclencher une synchronisation Algolia optimisée pour cette source
      try {
        const { error: syncError } = await supabase.functions.invoke('db-webhooks-optimized', {
          body: [
            { type: 'UPDATE', table: 'public:fe_sources', record: { source_name: source } }
          ]
        });
        if (syncError) console.warn('db-webhooks-optimized sync failed:', syncError);
      } catch (e) {
        console.warn('db-webhooks-optimized sync failed (tier updated in DB):', e);
      }

      // Mark as successful
      setUpdateStates(prev => ({
        ...prev,
        [source]: { loading: false, success: true }
      }));

      // Refresh sources in context; derived table will update automatically
      await refresh();

      toast({
        title: "Succès",
        description: `Source "${source}" mise à jour vers ${newTier}`,
      });

      // Clear success state after 3 seconds
      setTimeout(() => {
        setUpdateStates(prev => ({
          ...prev,
          [source]: { loading: false, success: false }
        }));
      }, 3000);

    } catch (error) {
      console.error('💥 Error updating source tier:', error);
      
      setUpdateStates(prev => ({
        ...prev,
        [source]: { loading: false, success: false }
      }));

      toast({
        title: "Erreur de mise à jour",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour le niveau d'accès",
        variant: "destructive",
      });
    }
  }, [toast, refresh]);

  // Loading reflects context state
  const loading = sourcesLoading;

  const getTierBadgeVariant = (tier: string) => {
    return tier === 'premium' ? 'default' : 'secondary';
  };

  const getTierIcon = (tier: string) => {
    return tier === 'premium' ? Crown : Shield;
  };

  const getButtonContent = (source: SourceAccessData) => {
    const updateState = updateStates[source.source];
    
    if (updateState?.loading) {
      return (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Mise à jour...
        </>
      );
    }
    
    if (updateState?.success) {
      return (
        <>
          <CheckCircle className="h-3 w-3 mr-1" />
          Terminé
        </>
      );
    }
    
    if (source.current_tier === 'standard') {
      return (
        <>
          <Crown className="h-3 w-3 mr-1" />
          Passer en Premium
        </>
      );
    } else {
      return (
        <>
          <Shield className="h-3 w-3 mr-1" />
          Passer en Standard
        </>
      );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Gestion des Accès aux Sources de Données
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Gestion des Accès aux Sources de Données
          <Button
            size="sm"
            variant="outline"
            onClick={() => refresh()}
            className="ml-auto"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Actualiser
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Gérez les niveaux d'accès des sources de facteurs d'émission.
          <br />
          <span className="font-medium">Standard</span> : accessible à tous les utilisateurs
          <br />
          <span className="font-medium">Premium</span> : accessible uniquement aux utilisateurs premium
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Niveau actuel</TableHead>
              <TableHead>Facteurs Standard</TableHead>
              <TableHead>Facteurs Premium</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sourceData.map((source) => {
              const TierIcon = getTierIcon(source.current_tier);
              const updateState = updateStates[source.source];
              
              return (
                <TableRow key={source.source}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[200px]" title={source.source}>
                        {source.source}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTierBadgeVariant(source.current_tier)}>
                      <TierIcon className="h-3 w-3 mr-1" />
                      {source.current_tier === 'premium' ? 'Premium' : 'Standard'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{source.standard_count}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{source.premium_count}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{source.total_count}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={updateState?.success ? "default" : "outline"}
                      onClick={() => updateSourceTier(
                        source.source, 
                        source.current_tier === 'standard' ? 'premium' : 'standard'
                      )}
                      disabled={updateState?.loading}
                    >
                      {getButtonContent(source)}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {sourceData.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune source de données trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};