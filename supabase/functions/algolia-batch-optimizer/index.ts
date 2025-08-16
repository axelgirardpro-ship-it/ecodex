// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AlgoliaBatchJob {
  id: string;
  sources: string[];
  operation: 'full_sync' | 'incremental_sync' | 'delete_source';
  priority: number;
  created_at: number;
  estimated_records: number;
}

interface BatchOptimizationMetrics {
  totalJobs: number;
  batchedJobs: number;
  recordsProcessed: number;
  avgProcessingTime: number;
  errorRate: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

class AlgoliaBatchOptimizer {
  private jobQueue: AlgoliaBatchJob[] = [];
  private processing = false;
  private metrics: BatchOptimizationMetrics = {
    totalJobs: 0,
    batchedJobs: 0,
    recordsProcessed: 0,
    avgProcessingTime: 0,
    errorRate: 0
  };

  private readonly maxBatchSize = 5; // Sources par batch
  private readonly maxRecordsPerBatch = 10000;
  private readonly processingInterval = 2000; // 2 secondes

  async addJob(job: Omit<AlgoliaBatchJob, 'id' | 'created_at'>): Promise<string> {
    const jobWithId: AlgoliaBatchJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: Date.now()
    };

    this.jobQueue.push(jobWithId);
    this.metrics.totalJobs++;

    // Trier par priorité
    this.jobQueue.sort((a, b) => a.priority - b.priority);

    // Démarrer le traitement si pas déjà en cours
    if (!this.processing) {
      this.startProcessing();
    }

    return jobWithId.id;
  }

  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    console.log('[AlgoliaBatchOptimizer] Starting batch processing');

    while (this.jobQueue.length > 0) {
      const batch = this.createOptimalBatch();
      if (batch.length === 0) break;

      await this.processBatch(batch);
      
      // Petit délai entre les batches pour éviter de surcharger Algolia
      await this.sleep(this.processingInterval);
    }

    this.processing = false;
    console.log('[AlgoliaBatchOptimizer] Batch processing completed');
  }

  private createOptimalBatch(): AlgoliaBatchJob[] {
    if (this.jobQueue.length === 0) return [];

    const batch: AlgoliaBatchJob[] = [];
    let totalRecords = 0;
    let currentPriority = this.jobQueue[0].priority;

    for (let i = 0; i < this.jobQueue.length && batch.length < this.maxBatchSize; i++) {
      const job = this.jobQueue[i];
      
      // Respecter les priorités
      if (job.priority > currentPriority && batch.length > 0) break;
      
      // Vérifier la limite de records
      if (totalRecords + job.estimated_records > this.maxRecordsPerBatch && batch.length > 0) break;

      batch.push(job);
      totalRecords += job.estimated_records;
      
      // Mettre à jour la priorité courante
      currentPriority = job.priority;
    }

    // Retirer les jobs du queue
    batch.forEach(job => {
      const index = this.jobQueue.findIndex(j => j.id === job.id);
      if (index !== -1) this.jobQueue.splice(index, 1);
    });

    this.metrics.batchedJobs += batch.length;
    return batch;
  }

  private async processBatch(batch: AlgoliaBatchJob[]): Promise<void> {
    const startTime = Date.now();
    
    console.log(`[AlgoliaBatchOptimizer] Processing batch of ${batch.length} jobs`);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'

    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
      console.error('[AlgoliaBatchOptimizer] Missing Algolia credentials');
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const algoliaHeaders = {
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'Content-Type': 'application/json'
    };

    let totalRecordsProcessed = 0;
    let errors = 0;

    // Grouper les jobs par opération pour optimiser
    const jobsByOperation = batch.reduce((acc, job) => {
      if (!acc[job.operation]) acc[job.operation] = [];
      acc[job.operation].push(job);
      return acc;
    }, {} as Record<string, AlgoliaBatchJob[]>);

    // Traiter chaque type d'opération
    for (const [operation, jobs] of Object.entries(jobsByOperation)) {
      try {
        switch (operation) {
          case 'full_sync':
            totalRecordsProcessed += await this.processFullSyncBatch(jobs, supabase, algoliaHeaders, ALGOLIA_INDEX_ALL);
            break;
          case 'incremental_sync':
            totalRecordsProcessed += await this.processIncrementalSyncBatch(jobs, supabase, algoliaHeaders, ALGOLIA_INDEX_ALL);
            break;
          case 'delete_source':
            totalRecordsProcessed += await this.processDeleteBatch(jobs, algoliaHeaders, ALGOLIA_INDEX_ALL);
            break;
        }
      } catch (error) {
        console.error(`[AlgoliaBatchOptimizer] Error processing ${operation}:`, error);
        errors += jobs.length;
      }
    }

    const processingTime = Date.now() - startTime;
    this.metrics.recordsProcessed += totalRecordsProcessed;
    this.metrics.avgProcessingTime = (this.metrics.avgProcessingTime + processingTime) / 2;
    this.metrics.errorRate = (this.metrics.errorRate + (errors / batch.length)) / 2;

    console.log(`[AlgoliaBatchOptimizer] Batch completed in ${processingTime}ms, ${totalRecordsProcessed} records, ${errors} errors`);
  }

  private async processFullSyncBatch(
    jobs: AlgoliaBatchJob[],
    supabase: any,
    algoliaHeaders: any,
    indexName: string
  ): Promise<number> {
    const sources = jobs.flatMap(job => job.sources);
    let totalRecords = 0;

    // Traitement en parallèle par chunks de sources
    const chunkSize = 3;
    for (let i = 0; i < sources.length; i += chunkSize) {
      const sourceChunk = sources.slice(i, i + chunkSize);
      
      const promises = sourceChunk.map(async (source) => {
        try {
          // Rafraîchir la projection
          await supabase.rpc('refresh_ef_all_for_source', { p_source: source });
          
          // Récupérer les données
          const { data: rows, error } = await supabase
            .from('emission_factors_all_search')
            .select('*')
            .eq('Source', source);
            
          if (error) throw error;
          
          const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }));
          
          if (records.length > 0) {
            // Batch update optimisé avec chunks
            await this.batchUpdateRecords(records, algoliaHeaders, indexName);
          }
          
          return records.length;
        } catch (error) {
          console.error(`[AlgoliaBatchOptimizer] Error syncing source ${source}:`, error);
          return 0;
        }
      });

      const results = await Promise.all(promises);
      totalRecords += results.reduce((sum, count) => sum + count, 0);
    }

    return totalRecords;
  }

  private async processIncrementalSyncBatch(
    jobs: AlgoliaBatchJob[],
    supabase: any,
    algoliaHeaders: any,
    indexName: string
  ): Promise<number> {
    // Logique similaire mais plus ciblée pour les updates incrémentaux
    const sources = jobs.flatMap(job => job.sources);
    let totalRecords = 0;

    for (const source of sources) {
      try {
        // Pour les syncs incrémentaux, on peut utiliser une approche plus légère
        const { data: rows, error } = await supabase
          .from('emission_factors_all_search')
          .select('*')
          .eq('Source', source)
          .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Dernières 24h
          
        if (error) throw error;
        
        const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }));
        
        if (records.length > 0) {
          await this.batchUpdateRecords(records, algoliaHeaders, indexName);
          totalRecords += records.length;
        }
      } catch (error) {
        console.error(`[AlgoliaBatchOptimizer] Error in incremental sync for ${source}:`, error);
      }
    }

    return totalRecords;
  }

  private async processDeleteBatch(
    jobs: AlgoliaBatchJob[],
    algoliaHeaders: any,
    indexName: string
  ): Promise<number> {
    const sources = jobs.flatMap(job => job.sources);
    let totalDeleted = 0;

    // Supprimer en batch par source
    for (const source of sources) {
      try {
        const deleteResponse = await fetch(`https://${algoliaHeaders['X-Algolia-Application-Id']}-dsn.algolia.net/1/indexes/${indexName}/deleteByQuery`, {
          method: 'POST',
          headers: algoliaHeaders,
          body: JSON.stringify({
            filters: `Source:"${source}"`
          })
        });

        if (deleteResponse.ok) {
          const result = await deleteResponse.json();
          totalDeleted += result.nbHits || 0;
        }
      } catch (error) {
        console.error(`[AlgoliaBatchOptimizer] Error deleting source ${source}:`, error);
      }
    }

    return totalDeleted;
  }

  private async batchUpdateRecords(
    records: any[],
    algoliaHeaders: any,
    indexName: string
  ): Promise<void> {
    const chunkSize = 1000; // Limite Algolia
    
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      
      const batchRequests = chunk.map((record: any) => ({
        action: 'updateObject',
        body: record
      }));

      await fetch(`https://${algoliaHeaders['X-Algolia-Application-Id']}-dsn.algolia.net/1/indexes/${indexName}/batch`, {
        method: 'POST',
        headers: algoliaHeaders,
        body: JSON.stringify({ requests: batchRequests })
      });

      // Petit délai entre les chunks
      if (i + chunkSize < records.length) {
        await this.sleep(100);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getMetrics(): BatchOptimizationMetrics {
    return { ...this.metrics };
  }

  getQueueStatus() {
    return {
      queueSize: this.jobQueue.length,
      processing: this.processing,
      nextJobPriority: this.jobQueue[0]?.priority || null,
      estimatedWaitTime: this.jobQueue.length * this.processingInterval
    };
  }
}

// Instance globale
const batchOptimizer = new AlgoliaBatchOptimizer();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'sync';

    switch (action) {
      case 'sync':
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
        
        const body = await req.json();
        const { sources, operation = 'full_sync', priority = 2, estimated_records = 1000 } = body;
        
        if (!sources || !Array.isArray(sources)) {
          return json(400, { error: 'Sources array required' });
        }

        const jobId = await batchOptimizer.addJob({
          sources,
          operation,
          priority,
          estimated_records
        });

        return json(200, { 
          ok: true, 
          job_id: jobId,
          queue_status: batchOptimizer.getQueueStatus()
        });

      case 'status':
        return json(200, {
          queue_status: batchOptimizer.getQueueStatus(),
          metrics: batchOptimizer.getMetrics()
        });

      case 'metrics':
        return json(200, batchOptimizer.getMetrics());

      default:
        return json(400, { error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[AlgoliaBatchOptimizer] Error:', error);
    return json(500, { error: String(error) });
  }
});
