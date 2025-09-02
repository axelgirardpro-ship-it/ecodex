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
import { ImportJobMonitor } from './ImportJobMonitor';

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
  const inflightRef = React.useRef(false);
  const hasRunningRef = React.useRef(false);

  const [importStatus, setImportStatus] = React.useState<'idle'|'importing'|'success'|'error'>('idle');
  const [importMessage, setImportMessage] = React.useState<string | null>(null);
  const [replaceAll, setReplaceAll] = React.useState(true);
  const [optimizerStatus, setOptimizerStatus] = React.useState<any | null>(null);

  const downloadTemplate = () => {
    const headers = [
      'ID','Nom','Nom_en','Description','Description_en','FE','Unité donnée d\'activité','Unite_en','Source','Secteur','Secteur_en','Sous-secteur','Sous-secteur_en','Localisation','Localisation_en','Date','Incertitude','Périmètre','Périmètre_en','Contributeur','Commentaires','Commentaires_en'
    ];
    const example = [
      '',
      'Transport routier de marchandises','Freight transportation',
      '', '',
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

  const checkOptimizerStatus = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        toast({ variant: 'destructive', title: 'Session manquante', description: 'Reconnectez-vous pour consulter le statut.' });
        return;
      }
      const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (process as any)?.env?.NEXT_PUBLIC_SUPABASE_URL || '';
      const baseFromEnv = typeof envUrl === 'string' && envUrl ? envUrl.replace('/rest/v1','').replace(/\/$/, '') : '';
      const baseFromWindow = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, '');
      const projectBase = baseFromEnv || baseFromWindow;
      const url = `${projectBase}/functions/v1/algolia-batch-optimizer?action=status`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await resp.json();
      setOptimizerStatus(j);
      toast({ title: 'Statut récupéré', description: `Queue: ${j?.queue_status?.queueSize ?? '-'} — Processing: ${String(j?.queue_status?.processing)}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur statut', description: e.message || String(e) });
    }
  }

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
      
      // Compresser seulement si pas déjà compressé
      setProgress(25);
      const originalSize = file.size;
      const isAlreadyCompressed = file.name.toLowerCase().endsWith('.gz');
      const fileToUpload = isAlreadyCompressed ? file : await compressFileToGzip(file);
      const finalSize = fileToUpload.size;
      const compressionRatio = isAlreadyCompressed ? 0 : Math.round((1 - finalSize / originalSize) * 100);

      setProgress(50);
      
      // Nom final (préserver .gz si déjà compressé)
      let cleanFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);
      const baseFileName = cleanFileName.replace(/\.(csv|xlsx|gz)$/i, '');
      const finalPath = isAlreadyCompressed ? `${Date.now()}_${cleanFileName}` : `${Date.now()}_${baseFileName}.csv.gz`;

      setProgress(75);
      
      // Upload
      const { error } = await supabase.storage.from('imports').upload(finalPath, fileToUpload, { upsert: true });
      if (error) throw error;
      setFilePath(finalPath);
      setProgress(100);
      setAnalysisDone(false);
      setMappingRows([]);
      toast({ 
        title: 'Upload terminé', 
        description: isAlreadyCompressed ? `${finalPath} (déjà compressé)` : `${finalPath} (${compressionRatio}% de compression)` 
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur upload', description: e.message || String(e) });
    } finally {
      setUploading(false);
    }
  };

  const handleChunkedUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Aucun fichier', description: 'Sélectionnez un fichier CSV.' });
      return;
    }
    
    const fileSizeMB = Math.round(file.size / 1024 / 1024);
    
    try {
      setUploading(true);
      setProgress(0);
      
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB par chunk comme spécifié
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      // 1. Créer le job d'import
      const { data: job, error: jobErr } = await supabase
        .from('import_jobs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          filename: file.name,
          original_size: file.size,
          total_chunks: totalChunks,
          replace_all: replaceAll,
          language: 'fr',
          status: 'pending'
        } as any)
        .select()
        .single();
      
      if (jobErr) throw jobErr;
      
      setProgress(10);
      
      // 2. Upload et parser par chunks côté client
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        // Parser le CSV chunk côté client
        const text = await chunk.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        
        // Parser CSV robuste
        function parseCSVLine(line: string): string[] {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let idx = 0; idx < line.length; idx++) {
            const char = line[idx];
            const nextChar = line[idx + 1];
            if (char === '"') {
              if (inQuotes && nextChar === '"') { current += '"'; idx++; } 
              else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) { 
              result.push(current.trim()); current = ''; 
            } else { 
              current += char; 
            }
          }
          result.push(current.trim());
          return result;
        }

        let parsedData: any[] = [];
        let headers: string[] = [];
        
        if (i === 0 && lines.length > 0) {
          // Premier chunk: extraire headers
          headers = parseCSVLine(lines[0]);
          lines.slice(1).forEach(line => {
            const values = parseCSVLine(line);
            if (values.length === headers.length) {
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
              parsedData.push(row);
            }
          });
        } else {
          // Chunks suivants: utiliser structure fixe (22 colonnes)
          lines.forEach(line => {
            const values = parseCSVLine(line);
            if (values.length >= 22) {
              parsedData.push({
                'ID': values[0] || '',
                'Nom': values[1] || '',
                'Nom_en': values[2] || '',
                'Description': values[3] || '',
                'Description_en': values[4] || '',
                'FE': values[5] || '',
                'Unité donnée d\'activité': values[6] || '',
                'Unite_en': values[7] || '',
                'Source': values[8] || '',
                'Secteur': values[9] || '',
                'Secteur_en': values[10] || '',
                'Sous-secteur': values[11] || '',
                'Sous-secteur_en': values[12] || '',
                'Localisation': values[13] || '',
                'Localisation_en': values[14] || '',
                'Date': values[15] || '',
                'Incertitude': values[16] || '',
                'Périmètre': values[17] || '',
                'Périmètre_en': values[18] || '',
                'Contributeur': values[19] || '',
                'Commentaires': values[20] || '',
                'Commentaires_en': values[21] || '',
              });
            }
          });
        }
        
        // 3. Stocker le chunk via SQL direct
        if (parsedData.length > 0) {
          const { error: chunkErr } = await supabase
            .from('import_chunks')
            .insert({
              job_id: job.id,
              chunk_number: i,
              data: parsedData,
              records_count: parsedData.length
            } as any);
          
          if (chunkErr) {
            console.warn(`Chunk ${i} failed:`, chunkErr);
            continue;
          }
          
          // 4. Envoyer dans la queue PGMQ via fonction utilitaire
          await supabase.rpc('send_to_import_queue', {
            p_job_id: job.id,
            p_chunk_number: i
          } as any);
        }
        
        // Progress update
        const progress = 10 + Math.round((i + 1) / totalChunks * 80);
        setProgress(progress);
      }
      
      setProgress(100);
      toast({ 
        title: 'Upload chunké terminé', 
        description: `${totalChunks} chunks de 5MB créés (${fileSizeMB}MB total). Queue + Cron actifs - monitoring via ImportJobMonitor.`
      });
      
      setAnalysisDone(false);
      setMappingRows([]);
      
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur upload chunké', description: e.message || String(e) });
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
      // 1) Analyse (optionnelle)
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

      // 3) Import avec mapping surchargé
      const mapping: Record<string, { access_level: AccessLevel; is_global: boolean }> = {};
      rows.forEach((r) => { mapping[r.name] = { access_level: r.access_level, is_global: r.is_global }; });
      setImportStatus('importing');
      setImportMessage('Import en cours… (synchronisation Algolia planifiée par source)');
      const { data: importData, error: importErr } = await supabase.functions.invoke('import-csv', {
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping, replace_all: replaceAll }
      });
      if (importErr) throw importErr;
      toast({ title: 'Import lancé', description: `Job: ${importData?.import_id || 'en file'}` });
      setImportStatus('success');
      setImportMessage('Import terminé. Synchronisation Algolia en tâche de fond.');
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
      setImportMessage('Import en cours… (synchronisation Algolia planifiée par source)');
      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping, replace_all: replaceAll }
      });
      if (error) throw error;
      toast({ title: 'Import lancé', description: `Job: ${data?.import_id || 'en file'}` });
      setImportStatus('success');
      setImportMessage('Import terminé. Synchronisation Algolia en tâche de fond.');
      await loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur import', description: e.message || String(e) });
      setImportStatus('error');
      setImportMessage(e?.message ? String(e.message) : 'Erreur lors de l\'import.');
    }
  };

  // Import direct (mode simple): après upload uniquement, sans analyse/mapping
  const quickImport = async () => {
    if (!filePath) {
      toast({ variant: 'destructive', title: 'Fichier manquant', description: 'Veuillez uploader un fichier.' });
      return;
    }
    try {
      setImportStatus('importing');
      setImportMessage('Import en cours… (synchronisation Algolia planifiée par source)');
      const { data, error } = await supabase.functions.invoke('import-csv', {
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping: {}, replace_all: replaceAll }
      });
      if (error) throw error;
      toast({ title: 'Import lancé', description: `Job: ${data?.import_id || 'en file'}` });
      setImportStatus('success');
      setImportMessage('Import terminé. Synchronisation Algolia en tâche de fond.');
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
      if (inflightRef.current) return; // anti-chevauchement
      inflightRef.current = true;
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
      hasRunningRef.current = mapped.some((j) => j.status === 'processing' || j.status === 'analyzing' || j.status === 'rebuilding');
    } catch (e) {
      // silencieux
    } finally {
      setLoadingJobs(false);
      inflightRef.current = false;
    }
  }, []);

  // Boucle d'auto-refresh
  React.useEffect(() => {
    let canceled = false;
    let timer: any;
    const tick = async () => {
      try {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          await loadJobs();
        }
      } finally {
        const delay = (typeof document !== 'undefined' && document.visibilityState !== 'visible')
          ? 60000 : (hasRunningRef.current ? 5000 : 30000);
        if (!canceled) timer = setTimeout(tick, delay);
      }
    };
    tick();
    return () => { canceled = true; if (timer) clearTimeout(timer); };
  }, [loadJobs]);

  if (!isSupraAdmin) return null;

  const setAllAccess = (lvl: AccessLevel) => setMappingRows((rows) => rows.map((r) => ({ ...r, access_level: lvl })));
  const setAllGlobal = (val: boolean) => setMappingRows((rows) => rows.map((r) => ({ ...r, is_global: val })));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import de la base de facteurs (FR/EN)</CardTitle>
        <CardDescription>
          Architecture robuste avec Queue + Cron: Upload chunké → PGMQ → traitement automatique → Algolia
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button onClick={handleChunkedUpload} disabled={!file || uploading} className="min-w-[200px]">
                {uploading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Upload chunké... {progress}%</>) : (<>🚀 Upload et traitement chunké</>)}
              </Button>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-sm">Remplacer intégralement (SCD2):</Label>
                <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Queue + Cron - Plus d'étapes manuelles nécessaires */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">⚡</div>
            <h3 className="text-lg font-semibold">Architecture automatisée</h3>
          </div>
          <div className="text-sm space-y-2">
            <div>✅ <strong>Upload chunké</strong>: Fichier découpé en chunks 5MB, parsé côté client</div>
            <div>✅ <strong>Queue PGMQ</strong>: Chaque chunk envoyé dans csv_import_queue</div>
            <div>✅ <strong>Cron worker</strong>: Traite 5 messages/minute via Edge Function</div>
            <div>✅ <strong>Progress tracking</strong>: Suivi granulaire par chunk</div>
            <div>✅ <strong>Auto-reindex</strong>: Algolia indexé automatiquement à completion</div>
            <div>✅ <strong>Retry automatique</strong>: Échecs retentés max 3×</div>
          </div>
        </div>

        {/* Historique des imports */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm">📊</div>
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
                <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">{importMessage}</div>
              )}
              {importStatus === 'error' && (
                <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">{importMessage}</div>
              )}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={checkOptimizerStatus}>🔄 Vérifier la synchro Algolia</Button>
                {optimizerStatus && (
                  <div className="text-xs text-muted-foreground">
                    Queue: {optimizerStatus?.queue_status?.queueSize ?? '-'} | Processing: {String(optimizerStatus?.queue_status?.processing)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Monitoring des jobs asynchrones */}
        <ImportJobMonitor />

        {/* Reindex manuel retiré: Webhook = auto-sync après import */}
      </CardContent>
    </Card>
  );
};
