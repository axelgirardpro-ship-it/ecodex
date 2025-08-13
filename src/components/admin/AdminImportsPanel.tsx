import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
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

  // Algolia settings (Storage)
  const [publicSettingsFile, setPublicSettingsFile] = React.useState<File | null>(null);
  const [privateSettingsFile, setPrivateSettingsFile] = React.useState<File | null>(null);
  const [uploadingSettings, setUploadingSettings] = React.useState(false);
  const [reindexing, setReindexing] = React.useState<null | 'public' | 'private' | 'all'>(null);

  const downloadTemplate = () => {
    const headers = [
      'ID','Nom','Description','FE','Unité donnée d\'activité','Source','Secteur','Sous-secteur','Localisation','Date','Incertitude','Périmètre','Contributeur','Commentaires'
    ];
    const example = [
      'BC::12345','Exemple de facteur','Lorem ipsum','12.34','kg','Base Carbone v23.6','Retail activities','Products manufacture','France','2025','','Scope 2 du producteur','',''
    ];
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_emission_factors_fr.csv';
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
      const path = `imports/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('imports').upload(path, file, { upsert: true });
      if (error) throw error;
      setFilePath(path);
      setProgress(100);
      setAnalysisDone(false);
      setMappingRows([]);
      toast({ title: 'Upload terminé', description: path });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur upload', description: e.message || String(e) });
    } finally {
      setUploading(false);
    }
  };

  const analyze = async () => {
    if (!filePath) {
      toast({ variant: 'destructive', title: 'Fichier manquant', description: 'Veuillez uploader un fichier.' });
      return;
    }
    try {
      const res = await fetch('/functions/v1/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sb-access-token') || ''}` },
        body: JSON.stringify({ file_path: filePath, language: 'fr', dry_run: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Analyse échouée');
      const rows: MappingRow[] = (data?.sources || []).map((s: any) => ({
        name: s.name,
        count: s.count,
        access_level: s.access_level || 'standard',
        is_global: typeof s.is_global === 'boolean' ? s.is_global : true,
      }));
      setMappingRows(rows);
      setAnalysisDone(true);
      toast({ title: 'Analyse terminée', description: `${data?.processed || 0} lignes valides; ${rows.length} sources détectées` });
      await loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur analyse', description: e.message || String(e) });
    }
  };

  const launchImport = async () => {
    if (!filePath) {
      toast({ variant: 'destructive', title: 'Fichier manquant', description: 'Veuillez uploader un fichier avant de lancer l\'import.' });
      return;
    }
    if (!analysisDone || mappingRows.length === 0) {
      toast({ variant: 'destructive', title: 'Analyse requise', description: 'Cliquez d\'abord sur Analyser pour préparer le mapping.' });
      return;
    }
    try {
      const mapping: Record<string, { access_level: AccessLevel; is_global: boolean }> = {};
      mappingRows.forEach((r) => { mapping[r.name] = { access_level: r.access_level, is_global: r.is_global }; });
      const payload = { file_path: filePath, language: 'fr', dry_run: false, mapping };
      const res = await fetch('/functions/v1/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sb-access-token') || ''}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Import échoué');
      toast({ title: 'Import lancé', description: `Job: ${data?.import_id || 'en file'}` });
      await loadJobs();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur import', description: e.message || String(e) });
    }
  };

  const uploadAlgoliaSettings = async (kind: 'public' | 'private') => {
    try {
      setUploadingSettings(true);
      // S'assurer que le bucket existe
      await fetch('/functions/v1/algolia-settings-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sb-access-token') || ''}` },
        body: JSON.stringify({}),
      }).catch(() => {});
      const file = kind === 'public' ? publicSettingsFile : privateSettingsFile;
      if (!file) {
        toast({ variant: 'destructive', title: 'Fichier manquant', description: 'Sélectionnez un JSON de settings.' });
        return;
      }
      const key = kind === 'public' ? 'ef_public_fr.json' : 'ef_private_fr.json';
      const { error } = await supabase.storage.from('algolia_settings').upload(key, file, { upsert: true, contentType: 'application/json' });
      if (error) throw error;
      toast({ title: 'Settings uploadés', description: `${key}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur upload settings', description: e.message || String(e) });
    } finally {
      setUploadingSettings(false);
    }
  };

  const triggerReindex = async (kind: 'public' | 'private' | 'all') => {
    try {
      setReindexing(kind);
      const res = await fetch('/functions/v1/algolia-reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sb-access-token') || ''}` },
        body: JSON.stringify({ index: kind, applySettings: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Reindex échoué');
      toast({ title: 'Reindex terminé', description: JSON.stringify(data?.results || data) });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur reindex', description: e.message || String(e) });
    } finally {
      setReindexing(null);
    }
  };

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
        <CardTitle>Import de la base de facteurs (FR)</CardTitle>
        <CardDescription>Upload de CSV volumineux, analyse puis lancement d\'import avec mappage par source.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadTemplate}>Télécharger le template CSV</Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label>Fichier CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={!file || uploading}>{uploading ? `Upload... ${progress}%` : 'Uploader vers Storage'}</Button>
              {filePath && <span className="text-xs text-muted-foreground break-all">{filePath}</span>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={analyze} disabled={!filePath}>Analyser</Button>
              <Button onClick={launchImport} disabled={!filePath || !analysisDone || mappingRows.length === 0}>Lancer l\'import</Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Sources détectées (après analyse)</Label>
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
          <Label>Historique des imports</Label>
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

        <div className="space-y-4">
          <Label>Algolia — Settings & Reindex</Label>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Uploader les settings JSON dans le bucket privé <code>algolia_settings</code>.</div>
              <div className="flex items-center gap-2">
                <Input type="file" accept="application/json,.json" onChange={(e) => setPublicSettingsFile(e.target.files?.[0] || null)} />
                <Button onClick={() => uploadAlgoliaSettings('public')} disabled={uploadingSettings || !publicSettingsFile}>Uploader ef_public_fr.json</Button>
              </div>
              <div className="flex items-center gap-2">
                <Input type="file" accept="application/json,.json" onChange={(e) => setPrivateSettingsFile(e.target.files?.[0] || null)} />
                <Button onClick={() => uploadAlgoliaSettings('private')} disabled={uploadingSettings || !privateSettingsFile}>Uploader ef_private_fr.json</Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Lancer un reindex complet via replaceAllObjects (swap atomique).</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => triggerReindex('public')} disabled={reindexing !== null}>{reindexing === 'public' ? 'Reindex public...' : 'Reindex PUBLIC'}</Button>
                <Button onClick={() => triggerReindex('private')} disabled={reindexing !== null}>{reindexing === 'private' ? 'Reindex privé...' : 'Reindex PRIVÉ'}</Button>
                <Button variant="secondary" onClick={() => triggerReindex('all')} disabled={reindexing !== null}>{reindexing === 'all' ? 'Reindex tout...' : 'Reindex TOUT'}</Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
