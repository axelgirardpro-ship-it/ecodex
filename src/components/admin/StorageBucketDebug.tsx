import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupraAdmin } from '@/hooks/useSupraAdmin';

export const StorageBucketDebug: React.FC = () => {
  const { toast } = useToast();
  const { isSupraAdmin } = useSupraAdmin();
  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  const checkBuckets = async () => {
    try {
      setLoading(true);
      
      // Vérifier les buckets existants
      const { data: bucketsData, error: bucketsError } = await supabase
        .storage
        .listBuckets();

      if (bucketsError) {
        throw new Error(`Erreur buckets: ${bucketsError.message}`);
      }

      setBuckets(bucketsData || []);
      
      // Vérifier les politiques storage
      const { data: policiesData, error: policiesError } = await supabase
        .from('pg_policies')
        .select('*')
        .like('tablename', 'objects')
        .like('policyname', '%imports%');

      if (!policiesError) {
        setPolicies(policiesData || []);
      }

      toast({
        title: "Diagnostic terminé",
        description: `${bucketsData?.length || 0} buckets trouvés`
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur diagnostic",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const createImportsBucket = async () => {
    try {
      setLoading(true);
      
      // Créer le bucket imports via l'API Storage
      const { data, error } = await supabase
        .storage
        .createBucket('imports', { 
          public: false,
          allowedMimeTypes: ['text/csv', 'application/csv'],
          fileSizeLimit: 52428800 // 50MB
        });

      if (error) {
        // Si le bucket existe déjà, ce n'est pas grave
        if (error.message.includes('already exists')) {
          toast({
            title: "Bucket existe déjà",
            description: "Le bucket 'imports' existe déjà en production"
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Bucket créé !",
          description: "Le bucket 'imports' a été créé avec succès"
        });
      }

      // Recharger la liste des buckets
      await checkBuckets();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur création bucket",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testUpload = async () => {
    try {
      setLoading(true);
      
      // Créer un fichier de test
      const testContent = 'test,upload\n1,working';
      const testFile = new Blob([testContent], { type: 'text/csv' });
      const fileName = `test_${Date.now()}.csv`;

      const { data, error } = await supabase.storage
        .from('imports')
        .upload(fileName, testFile);

      if (error) {
        throw error;
      }

      toast({
        title: "Test upload réussi !",
        description: `Fichier ${fileName} uploadé avec succès`
      });

      // Nettoyer le fichier de test
      await supabase.storage.from('imports').remove([fileName]);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Test upload échoué",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isSupraAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔧 Diagnostic Storage - Bucket Imports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkBuckets} disabled={loading}>
            {loading ? "Diagnostic..." : "Vérifier Buckets"}
          </Button>
          <Button onClick={createImportsBucket} disabled={loading} variant="secondary">
            Créer Bucket Imports
          </Button>
          <Button onClick={testUpload} disabled={loading} variant="outline">
            Test Upload
          </Button>
        </div>

        {buckets.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Buckets Storage:</h3>
            <div className="flex gap-2 flex-wrap">
              {buckets.map((bucket) => (
                <Badge key={bucket.id} variant={bucket.id === 'imports' ? 'default' : 'secondary'}>
                  {bucket.id} {bucket.public ? '(public)' : '(privé)'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {policies.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Politiques Storage Imports:</h3>
            <div className="text-sm space-y-1">
              {policies.map((policy, idx) => (
                <div key={idx} className="p-2 bg-muted rounded">
                  <strong>{policy.policyname}</strong>: {policy.cmd}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>URL d'erreur analysée:</strong></div>
          <div className="font-mono bg-red-50 p-2 rounded text-red-700">
            POST /storage/v1/object/imports/1755363317664_export_algolia_COMBINED_2025-08-14_20-07-_export_algolia_COMBINED_2025-08.csv
          </div>
          <div><strong>Problèmes identifiés:</strong></div>
          <ul className="list-disc list-inside space-y-1">
            <li>Le bucket 'imports' pourrait ne pas exister</li>
            <li>Les politiques RLS pourraient être manquantes</li>
            <li>Le nom de fichier contient encore des caractères problématiques</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
