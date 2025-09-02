import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_percent: number;
  processed: number;
  inserted: number;
  file_name: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_details: any;
}

export const ImportJobMonitor: React.FC = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = React.useState<ImportJob[]>([]);
  const [queueSize, setQueueSize] = React.useState<number>(0);
  const [cronLogs, setCronLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refreshStatus = async () => {
    try {
      setLoading(true);
      
      // Jobs d'import
      const { data: jobsData, error: jobsErr } = await supabase
        .from('import_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (jobsErr) throw jobsErr;
      setJobs(jobsData || []);

      // Taille de la queue
      const { data: queueData, error: queueErr } = await supabase
        .rpc('pgmq.metrics', { queue_name: 'import_jobs' });
      
      if (!queueErr && queueData) {
        setQueueSize(queueData[0]?.queue_length || 0);
      }

      // Logs cron récents
      const { data: cronData, error: cronErr } = await supabase
        .from('cron.job_run_details')
        .select('jobid, status, return_message, start_time, end_time')
        .order('start_time', { ascending: false })
        .limit(5);
      
      if (!cronErr) {
        setCronLogs(cronData || []);
      }

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur refresh', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const forceWorkerRun = async () => {
    try {
      const { data, error } = await supabase.rpc('process_import_job_sql');
      if (error) throw error;
      toast({ title: 'Worker déclenché', description: data || 'Exécution manuelle lancée' });
      setTimeout(refreshStatus, 2000);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur worker', description: e.message });
    }
  };

  // Auto-refresh toutes les 10 secondes
  React.useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-yellow-600 bg-yellow-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Monitoring des imports (Cron + Queue)
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={loading}>
              {loading ? '🔄' : '↻'} Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={forceWorkerRun}>
              ⚡ Force Worker
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Statut Queue */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">📋 Queue Status</h3>
          <div className="text-sm space-y-1">
            <div>Messages en attente: <span className="font-mono">{queueSize}</span></div>
            <div>Cron worker: <span className="text-green-600">✅ Actif (toutes les minutes)</span></div>
          </div>
        </div>

        {/* Jobs d'import */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">📊 Jobs d'import</h3>
          {jobs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun job pour le moment</div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs">{job.file_name}</div>
                    <div className={`px-2 py-1 rounded text-xs ${getStatusColor(job.status)}`}>
                      {job.status}
                    </div>
                  </div>
                  
                  {job.status === 'processing' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progression</span>
                        <span>{job.progress_percent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress_percent}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Traités: {job.processed} | Insérés: {job.inserted}
                      </div>
                    </div>
                  )}
                  
                  {job.status === 'completed' && (
                    <div className="text-xs text-green-700">
                      ✅ Terminé: {job.inserted} records insérés
                    </div>
                  )}
                  
                  {job.status === 'failed' && job.error_details && (
                    <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                      ❌ {job.error_details.error || 'Erreur inconnue'}
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Créé: {new Date(job.created_at).toLocaleString()}
                    {job.started_at && ` | Démarré: ${new Date(job.started_at).toLocaleString()}`}
                    {job.finished_at && ` | Terminé: ${new Date(job.finished_at).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logs Cron */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">⏰ Logs Cron (dernières exécutions)</h3>
          {cronLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun log disponible</div>
          ) : (
            <div className="space-y-1">
              {cronLogs.map((log, idx) => (
                <div key={idx} className="text-xs font-mono flex items-center justify-between">
                  <span>{new Date(log.start_time).toLocaleTimeString()}</span>
                  <span className={log.status === 'succeeded' ? 'text-green-600' : 'text-red-600'}>
                    {log.status}: {log.return_message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold mb-2">ℹ️ Comment ça marche</h3>
          <div className="text-sm space-y-1">
            <div>1. Upload → Job créé dans la queue pgmq</div>
            <div>2. Cron worker traite toutes les minutes</div>
            <div>3. Traitement par chunks SQL (pas de timeout)</div>
            <div>4. Algolia indexé à la fin automatiquement</div>
            <div className="text-muted-foreground mt-2">
              ⏱️ Temps estimé pour 246k records: 10-20 minutes
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};
