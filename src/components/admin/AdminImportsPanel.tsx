import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupraAdmin } from '@/hooks/useSupraAdmin';

interface ImportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'analyzing' | 'analyzed' | 'rebuilding' | string | null;
  processed: number | null;
  failed: number | null;
  started_at: string;
}

type AccessLevel = 'standard' | 'premium';
interface MappingRow { name: string; count: number; access_level: AccessLevel; is_global: boolean }

export const AdminImportsPanel: React.FC = () => {
  const { toast } = useToast();
  const { isSupraAdmin } = useSupraAdmin();

  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [filePath, setFilePath] = React.useState<string | null>(null);

  const [mappingRows, setMappingRows] = React.useState<MappingRow[]>([]);
  const [analysisDone, setAnalysisDone] = React.useState(false);

  const [jobs, setJobs] = React.useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  const [importStatus, setImportStatus] = React.useState<'idle'|'importing'|'success'|'error'>('idle');
  const [importMessage, setImportMessage] = React.useState<string | null>(null);
  const [replaceAll, setReplaceAll] = React.useState(true);

  const downloadTemplate = () => {
    const headers = [
      'ID','Nom','Nom_en','Description','Description_en','FE','Unité donnée d\'activité','Unite_en','Source','Secteur','Secteur_en','Sous-secteur','Sous-secteur_en','Localisation','Localisation_en','Date','Incertitude','Périmètre','Périmètre_en','Contributeur','Commentaires','Commentaires_en'
    ];
    const example = [
      '',
      'Transport routier de marchandises','Freight transportation',
      '','',
      '0.123','kgCO2e/t.km','kgCO2e/t.km',
      'Base Carbone v23.6',
      'Transport','Transportation',
      'Fret','Freight',
      'France','France',
      '2025','',
      'Well-to-Wheel','Well-to-Wheel',
      '',''
    ];
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_emission_factors_bilingue.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fonction de compression côté client
  const compressFileToGzip = async (file: File): Promise<Blob> => {
    const stream = file.stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const response = new Response(compressedStream);
    return await response.blob();
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Aucun fichier', description: 'Sélectionnez un fichier CSV.' });
      return;
    }
    try {
      setUploading(true);
      setProgress(0);
      
      // 1. Compresser le fichier automatiquement
      setProgress(25);
      const originalSize = file.size;
      const compressedFile = await compressFileToGzip(file);
      const compressedSize = compressedFile.size;
      const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);
      
      console.log('🗜️ Compression terminée:', {
        originalSize: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
        compressedSize: `${(compressedSize / 1024 / 1024).toFixed(2)} MB`,
        ratio: `${compressionRatio}%`
      });

      setProgress(50);

      // 2. Générer le nom de fichier compressé
      let cleanFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);

      // Toujours ajouter .gz pour les fichiers compressés
      const baseFileName = cleanFileName.replace(/\.(csv|xlsx)$/i, '');
      const finalPath = `${Date.now()}_${baseFileName}.csv.gz`;
      
      setProgress(75);
      
      // 3. Upload du fichier compressé
      const { error } = await supabase.storage.from('imports').upload(finalPath, compressedFile, { upsert: true });
      if (error) throw error;
      setFilePath(finalPath);
      setProgress(100);
      setAnalysisDone(false);
      setMappingRows([]);
      toast({ 
        title: 'Upload terminé', 
        description: `${finalPath} (${compressionRatio}% de compression)` 
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur upload', description: e.message || String(e) });
    } finally {
      setUploading(false);
    }
  };

  const analyzeThenImport = async () => {
    if (!filePath) {
      toast({ variant: 'destructive', title: 'Fichier manquant', description: 'Veuillez uploader un fichier.' });
      return;
    }
    try {
      // 1) Analyse (dry run)
      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: { file_path: filePath, language: 'fr', dry_run: true }
      });
      if (error) throw error;
      const rows: MappingRow[] = (data?.sources || []).map((s: any) => ({
        name: s.name,
        count: s.count,
        access_level: s.access_level || 'standard',
        is_global: typeof s.is_global === 'boolean' ? s.is_global : true,
      }));
      setMappingRows(rows);
      setAnalysisDone(true);
      toast({ title: 'Analyse terminée', description: `${data?.processed || 0} lignes valides; ${rows.length} sources détectées` });

      // 2) Confirmation d'import
      const total = Number(data?.processed) || rows.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
      const ok = window.confirm(`Lancer l'import maintenant ?\nSources: ${rows.length} — Lignes valides: ${total}`);
      if (!ok) return;

      // 3) Import
      const mapping: Record<string, { access_level: AccessLevel; is_global: boolean }> = {};
      rows.forEach((r) => { mapping[r.name] = { access_level: r.access_level, is_global: r.is_global }; });
      setImportStatus('importing');
      setImportMessage('Import en cours… (la synchronisation Algolia par source s’effectue automatiquement)');
      const { data: importData, error: importErr } = await supabase.functions.invoke('import-csv', {
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping, replace_all: replaceAll }
      });
      if (importErr) throw importErr;
      toast({ title: 'Import lancé', description: `Job: ${importData?.import_id || 'en file'}` });
      // Reindex atomique complet après import admin
      try {
        const { data: reindexRes, error: reindexErr } = await supabase.functions.invoke('reindex-ef-all-atomic', { body: {} })
        if (reindexErr) throw reindexErr
        setImportStatus('success');
        setImportMessage('Import terminé. Reindex Algolia atomique effectué.');
      } catch (e: any) {
        setImportStatus('error');
        setImportMessage(`Import OK mais reindex Algolia a échoué: ${e?.message || String(e)}`);
      }
      await loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur import', description: e.message || String(e) });
      setImportStatus('error');
      setImportMessage(e?.message ? String(e.message) : 'Erreur lors de l\'import.');
    }
  };

  const launchImportWithCurrentMapping = async () => {
    if (!filePath) {
      toast({ variant: 'destructive', title: 'Fichier manquant', description: 'Veuillez uploader un fichier avant de lancer l\'import.' });
      return;
    }
    if (!analysisDone || mappingRows.length === 0) {
      toast({ variant: 'destructive', title: 'Analyse requise', description: 'Cliquez d\'abord sur Analyser puis Importer.' });
      return;
    }
    try {
      const mapping: Record<string, { access_level: AccessLevel; is_global: boolean }> = {};
      mappingRows.forEach((r) => { mapping[r.name] = { access_level: r.access_level, is_global: r.is_global }; });
      setImportStatus('importing');
      setImportMessage('Import en cours… (la synchronisation Algolia par source s’effectue automatiquement)');
      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping, replace_all: replaceAll }
      });
      if (error) throw error;
      toast({ title: 'Import lancé', description: `Job: ${data?.import_id || 'en file'}` });
      try {
        const { error: reindexErr } = await supabase.functions.invoke('reindex-ef-all-atomic', { body: {} })
        if (reindexErr) throw reindexErr
        setImportStatus('success');
        setImportMessage('Import terminé. Reindex Algolia atomique effectué.');
      } catch (e: any) {
        setImportStatus('error');
        setImportMessage(`Import OK mais reindex Algolia a échoué: ${e?.message || String(e)}`);
      }
      await loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur import', description: e.message || String(e) });
      setImportStatus('error');
      setImportMessage(e?.message ? String(e.message) : 'Erreur lors de l\'import.');
    }
  };

  // Reindex manuel supprimé: l'indexation se fait automatiquement via Webhooks après import

  const loadJobs = React.useCallback(async () => {
    try {
      setLoadingJobs(true);
      const { data, error } = await supabase
        .from('data_imports')
        .select('id,status,processed,failed,started_at,finished_at')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const mapped: ImportJob[] = (data || []).map((d: any) => ({
        id: d.id,
        status: d.status,
        processed: d.processed ?? null,
        failed: d.failed ?? null,
        started_at: d.started_at,
      }));
      setJobs(mapped);
    } catch (e) {
      // silencieux
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  React.useEffect(() => {
    loadJobs();
    const h = setInterval(loadJobs, 5000);
    return () => clearInterval(h);
  }, [loadJobs]);

  if (!isSupraAdmin) return null;

  const setAllAccess = (lvl: AccessLevel) => setMappingRows((rows) => rows.map((r) => ({ ...r, access_level: lvl })));
  const setAllGlobal = (val: boolean) => setMappingRows((rows) => rows.map((r) => ({ ...r, is_global: val })));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import de la base de facteurs (FR/EN)</CardTitle>
        <CardDescription>
          Importez facilement des facteurs d'émission depuis un fichier CSV ou XLSX. 
          Le processus est guidé en 3 étapes simples avec compression automatique et synchronisation Algolia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Étape 1: Sélection et upload du fichier */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">1</div>
              <h3 className="text-lg font-semibold">Sélectionner le fichier</h3>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              📄 Télécharger le template CSV
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="file-input">Fichier CSV/XLSX</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help">(Aide)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Formats supportés : CSV, XLSX. La compression automatique optimise les transferts volumineux.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input 
              id="file-input"
              type="file" 
              accept=".csv,.xlsx,.gz,.csv.gz,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/gzip" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
            />
            
            <div className="flex items-center justify-between">
              <Button 
                onClick={handleUpload} 
                disabled={!file || uploading}
                className="min-w-[180px]"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Upload... {progress}%
                  </>
                ) : (
                  <>
                    ⬆️ Uploader le fichier
                  </>
                )}
              </Button>
              
              {filePath && (
                <div className="text-sm text-green-600 flex items-center gap-2">
                  ✅ Fichier uploadé : <span className="font-mono text-xs">{filePath.split('/').pop()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Étape 2: Analyse et import */}
        <div className={`border rounded-lg p-4 space-y-4 ${!filePath ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${filePath ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-500'} flex items-center justify-center text-sm font-semibold`}>2</div>
            <h3 className="text-lg font-semibold">Analyser et importer</h3>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={analyzeThenImport} 
              disabled={!filePath}
              className="min-w-[200px]"
            >
              🔍 Analyser puis Importer
            </Button>
            
            {analysisDone && mappingRows.length > 0 && (
              <Button 
                variant="secondary" 
                onClick={launchImportWithCurrentMapping}
                className="min-w-[180px]"
              >
                📥 Importer maintenant
              </Button>
            )}
          </div>
          
          {!filePath && (
            <p className="text-sm text-muted-foreground">
              ⚠️ Veuillez d'abord uploader un fichier à l'étape 1
            </p>
          )}
        </div>

        {/* Étape 3: Configuration des sources (après analyse) */}
        <div className={`border rounded-lg p-4 space-y-4 ${mappingRows.length === 0 ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${mappingRows.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-500'} flex items-center justify-center text-sm font-semibold`}>3</div>
            <h3 className="text-lg font-semibold">Configuration des sources</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">(Aide)</span>
                </TooltipTrigger>
                <TooltipContent>
                  Configurez l'accès par source : Standard (gratuit) ou Premium (payant). Global = visible par toutes les workspaces.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {mappingRows.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              ℹ️ Les sources seront détectées après l'analyse du fichier à l'étape 2
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Appliquer à toutes:</span>
                <Select onValueChange={(v) => setAllAccess(v as AccessLevel)}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Accès" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setAllGlobal(true)}>Global: Oui</Button>
                <Button variant="outline" size="sm" onClick={() => setAllGlobal(false)}>Global: Non</Button>
              </div>
              <div className="overflow-auto border rounded-md">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Source</th>
                      <th className="p-2 text-right">Lignes</th>
                      <th className="p-2 text-left">Accès</th>
                      <th className="p-2 text-left">Global</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingRows.map((r, idx) => (
                      <tr key={r.name} className="border-t">
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-right">{r.count}</td>
                        <td className="p-2">
                          <Select value={r.access_level} onValueChange={(v) => setMappingRows((rows) => rows.map((x, i) => i===idx ? { ...x, access_level: v as AccessLevel } : x))}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={r.is_global} onChange={(e) => setMappingRows((rows) => rows.map((x, i) => i===idx ? { ...x, is_global: e.target.checked } : x))} />
                            <span>Global</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Historique des imports */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm">
              📊
            </div>
            <h3 className="text-lg font-semibold">Historique des imports</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">(Aide)</span>
                </TooltipTrigger>
                <TooltipContent>Suivi des imports récents avec statuts et métriques</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Statut</th>
                  <th className="p-2 text-right">Traitées</th>
                  <th className="p-2 text-right">Échecs</th>
                </tr>
              </thead>
              <tbody>
                {loadingJobs ? (
                  <tr><td className="p-2" colSpan={4}>Chargement...</td></tr>
                ) : jobs.length === 0 ? (
                  <tr><td className="p-2" colSpan={4}>Aucun import pour le moment.</td></tr>
                ) : jobs.map((j) => (
                  <tr key={j.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(j.started_at).toLocaleString()}</td>
                    <td className="p-2">{j.status ?? '-'}</td>
                    <td className="p-2 text-right">{j.processed ?? '-'}</td>
                    <td className="p-2 text-right">{j.failed ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statut d'import en temps réel */}
        {importStatus !== 'idle' && (
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                importStatus === 'importing' ? 'bg-blue-100 text-blue-600' :
                importStatus === 'success' ? 'bg-green-100 text-green-600' :
                'bg-red-100 text-red-600'
              }`}>
                {importStatus === 'importing' ? '⏳' : importStatus === 'success' ? '✅' : '❌'}
              </div>
              <h3 className="text-lg font-semibold">
                {importStatus === 'importing' ? 'Import en cours...' :
                 importStatus === 'success' ? 'Import terminé' :
                 'Erreur d\'import'}
              </h3>
            </div>
            
            <div className="space-y-2">
              {importStatus === 'importing' && (
                <>
                  <div className="text-sm text-gray-600">{importMessage}</div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-3 bg-blue-500 rounded-full animate-pulse" style={{width: '60%'}} />
                  </div>
                </>
              )}
              {importStatus === 'success' && (
                <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                  {importMessage}
                </div>
              )}
              {importStatus === 'error' && (
                <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">
                  {importMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reindex manuel retiré: Webhook = auto-sync après import */}
      </CardContent>
    </Card>
  );
};
