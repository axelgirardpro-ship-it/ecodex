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
      
      // Les politiques ne sont pas accessibles via l'API REST
      // On va juste indiquer qu'elles doivent être créées via migration
      setPolicies([]);

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
      
      toast({
        variant: "destructive",
        title: "Création bucket impossible",
        description: "La création de bucket nécessite des permissions élevées. Le bucket doit être créé via la migration SQL ou le dashboard Supabase."
      });

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

        <div className="text-xs text-muted-foreground space-y-2">
          <div><strong>Diagnostic de l'erreur 400 Bad Request:</strong></div>
          
          {buckets.find(b => b.id === 'imports') ? (
            <div className="bg-green-50 p-2 rounded text-green-700">
              ✅ Bucket 'imports' trouvé ! Le problème vient d'ailleurs.
            </div>
          ) : (
            <div className="bg-red-50 p-2 rounded text-red-700">
              ❌ Bucket 'imports' manquant ! C'est la cause du problème.
            </div>
          )}

          <div><strong>Solutions pour créer le bucket 'imports':</strong></div>
          <div className="bg-blue-50 p-3 rounded space-y-2">
            <div><strong>Option 1: Via Supabase Dashboard</strong></div>
            <ol className="list-decimal list-inside text-xs space-y-1 ml-2">
              <li>Aller sur <a href="https://supabase.com/dashboard/project/wrodvaatdujbpfpvrzge/storage/buckets" target="_blank" className="text-blue-600 underline">dashboard.supabase.com</a></li>
              <li>Section Storage → Buckets</li>
              <li>Cliquer "New bucket"</li>
              <li>Nom: <code className="bg-gray-200 px-1 rounded">imports</code></li>
              <li>Public: <code className="bg-gray-200 px-1 rounded">Non</code></li>
              <li>File size limit: <code className="bg-gray-200 px-1 rounded">50MB</code></li>
              <li>Allowed MIME types: <code className="bg-gray-200 px-1 rounded">text/csv</code></li>
            </ol>
            
            <div className="mt-2"><strong>Option 2: Via SQL (recommandé)</strong></div>
            <div className="bg-gray-800 text-gray-100 p-2 rounded text-xs font-mono">
              {`-- Créer le bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('imports', 'imports', false);

-- Créer les politiques pour supra admins
CREATE POLICY "Supra admins can manage imports" 
ON storage.objects FOR ALL 
USING (bucket_id = 'imports' AND is_supra_admin());`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
