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
  created_at: string;
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

  const handleUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Aucun fichier', description: 'Sélectionnez un fichier CSV.' });
      return;
    }
    try {
      setUploading(true);
      setProgress(0);
      
      // Debug : Analyser le nom de fichier original en détail
      console.log('🔍 Analyse filename original:', {
        name: file.name,
        length: file.name.length,
        charCodes: file.name.split('').map(char => `${char}(${char.charCodeAt(0)})`),
        hasNonAscii: /[^\x00-\x7F]/.test(file.name),
        hasSpaces: file.name.includes(' '),
        hasDashes: file.name.includes('-'),
        hasSpecialChars: /[^a-zA-Z0-9.-]/.test(file.name)
      });

      // Sanitization ultra-agressive pour Supabase Storage
      let cleanFileName = file.name
        .normalize('NFD')                     // Décomposer les accents
        .replace(/[\u0300-\u036f]/g, '')      // Supprimer les accents
        .toLowerCase()                        // Tout en minuscules
        .replace(/[^a-z0-9.]/g, '_')         // SEULEMENT lettres, chiffres, points
        .replace(/_{2,}/g, '_')              // Pas de _ multiples
        .replace(/^_+|_+$/g, '')             // Pas de _ début/fin
        .substring(0, 50);                   // Limite plus stricte

      // Forcer extension .csv sans duplication
      if (!cleanFileName.endsWith('.csv')) {
        cleanFileName = cleanFileName.replace(/\.[^.]*$/, '') + '.csv';
      }
      
      // Path final avec timestamp
      const finalPath = `${Date.now()}_${cleanFileName}`;
      
      // Debug complet de la transformation
      console.log('🔍 Debug transformation complète:', {
        '1_original': file.name,
        '2_clean': cleanFileName,
        '3_finalPath': finalPath,
        '4_pathLength': finalPath.length,
        '5_onlyAllowedChars': /^[a-z0-9_.]+$/.test(finalPath)
      });
      
      const { error } = await supabase.storage.from('imports').upload(finalPath, file, { upsert: true });
      if (error) throw error;
      setFilePath(finalPath);
      setProgress(100);
      setAnalysisDone(false);
      setMappingRows([]);
      toast({ title: 'Upload terminé', description: finalPath });
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
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping }
      });
      if (importErr) throw importErr;
      toast({ title: 'Import lancé', description: `Job: ${importData?.import_id || 'en file'}` });
      setImportStatus('success');
      setImportMessage('Import terminé. Indexation Algolia effectuée par source.');
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
        body: { file_path: filePath, language: 'fr', dry_run: false, mapping }
      });
      if (error) throw error;
      toast({ title: 'Import lancé', description: `Job: ${data?.import_id || 'en file'}` });
      setImportStatus('success');
      setImportMessage('Import terminé. Indexation Algolia effectuée par source.');
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
        .select('id,status,records_processed,records_failed,created_at,completed_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const mapped: ImportJob[] = (data || []).map((d: any) => ({
        id: d.id,
        status: d.status,
        processed: d.records_processed ?? null,
        failed: d.records_failed ?? null,
        created_at: d.created_at,
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
          L\'indexation Algolia est automatique via Webhook après import.
          • Étape 1: Uploader le fichier vers le Storage.
          • Étape 2: Analyser pour détecter les sources et préparer le mapping (Standard/Premium, Global oui/non).
          • Étape 3: Importer. La synchronisation Algolia par source s\'exécute automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadTemplate}>Télécharger le template CSV</Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Fichier CSV</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help">(Aide)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Sélectionnez le CSV complet exporté depuis la Base Carbone (ou template compatible). Les colonnes FR/EN sont supportées.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleUpload} disabled={!file || uploading}>{uploading ? `Upload... ${progress}%` : 'Uploader vers Storage'}</Button>
                  </TooltipTrigger>
                  <TooltipContent>Envoie le fichier sur Supabase Storage (bucket imports). Obligatoire avant analyse.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {filePath && <span className="text-xs text-muted-foreground break-all">{filePath}</span>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={analyzeThenImport} disabled={!filePath}>Analyser puis Importer</Button>
                  </TooltipTrigger>
                  <TooltipContent>Analyse le CSV et propose immédiatement de lancer l'import. Vous pouvez annuler pour ajuster le mapping.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {analysisDone && mappingRows.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" onClick={launchImportWithCurrentMapping}>Importer avec ce mapping</Button>
                    </TooltipTrigger>
                    <TooltipContent>Utilise le mapping affiché ci-dessous sans relancer l'analyse.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Sources détectées (après analyse)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">(Aide)</span>
                </TooltipTrigger>
                <TooltipContent>
                  Choisissez l\'accès par source: Standard ou Premium. Global = visible par toutes les workspaces; sinon, assignable.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {mappingRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune source détectée. Lancez l\'analyse après upload.</div>
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

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Historique des imports</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">(Aide)</span>
                </TooltipTrigger>
                <TooltipContent>Liste des imports récents et leur statut.</TooltipContent>
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
                    <td className="p-2 whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</td>
                    <td className="p-2">{j.status ?? '-'}</td>
                    <td className="p-2 text-right">{j.processed ?? '-'}</td>
                    <td className="p-2 text-right">{j.failed ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statut visuel d'import/indexation */}
        {importStatus !== 'idle' && (
          <div className="space-y-2 p-4 border rounded-md">
            {importStatus === 'importing' && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">{importMessage}</div>
                <div className="w-full h-2 bg-muted rounded-md overflow-hidden">
                  <div className="h-2 w-2/3 bg-primary animate-pulse" />
                </div>
              </div>
            )}
            {importStatus === 'success' && (
              <div className="text-sm text-green-700">{importMessage}</div>
            )}
            {importStatus === 'error' && (
              <div className="text-sm text-red-700">{importMessage}</div>
            )}
          </div>
        )}

        {/* Reindex manuel retiré: Webhook = auto-sync après import */}
      </CardContent>
    </Card>
  );
};
