// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type DBEvent = {
  type: 'INSERT'|'UPDATE'|'DELETE'
  table: string
  schema?: string
  record?: any
  old_record?: any
  new?: any
  old?: any
}

interface BatchUpdate {
  source: string;
  operations: Set<string>; // 'insert', 'update', 'delete'
  objectIds: Set<string>;
  priority: number; // 1=high, 2=medium, 3=low
  timestamp: number;
}

interface WebhookMetrics {
  totalEvents: number;
  batchedEvents: number;
  duplicatesAvoided: number;
  avgBatchSize: number;
  processingTime: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, X-Webhook-Secret, x-supabase-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

class WebhookBatcher {
  private pendingUpdates = new Map<string, BatchUpdate>();
  private batchTimer: number | null = null;
  private readonly batchDelay = 5000; // 5 secondes
  private readonly maxBatchSize = 100;
  private readonly maxWaitTime = 30000; // 30 secondes max
  private metrics: WebhookMetrics = {
    totalEvents: 0,
    batchedEvents: 0,
    duplicatesAvoided: 0,
    avgBatchSize: 0,
    processingTime: 0
  };

  async addEvent(event: DBEvent): Promise<void> {
    const source = this.extractSource(event);
    if (!source) return;

    this.metrics.totalEvents++;
    
    const existing = this.pendingUpdates.get(source);
    const operation = event.type.toLowerCase();
    const objectId = this.extractObjectId(event);
    const priority = this.calculatePriority(event);

    if (existing) {
      // Merger avec le batch existant
      existing.operations.add(operation);
      if (objectId) existing.objectIds.add(objectId);
      existing.priority = Math.min(existing.priority, priority);
      this.metrics.duplicatesAvoided++;
    } else {
      // Créer un nouveau batch
      const batch: BatchUpdate = {
        source,
        operations: new Set([operation]),
        objectIds: objectId ? new Set([objectId]) : new Set(),
        priority,
        timestamp: Date.now()
      };
      this.pendingUpdates.set(source, batch);
    }

    this.scheduleBatch();
  }

  private extractSource(event: DBEvent): string | null {
    const table = this.getTableName(event?.table);
    const rec = event?.record ?? event?.new ?? event?.old ?? event?.old_record ?? {};
    
    switch (table) {
      case 'emission_factors':
        return rec['Source'] ?? rec['source'] ?? null;
      case 'fe_source_workspace_assignments':
      case 'fe_sources':
        return rec?.source_name ?? null;
      default:
        return null;
    }
  }

  private extractObjectId(event: DBEvent): string | null {
    const rec = event?.record ?? event?.new ?? event?.old ?? event?.old_record ?? {};
    return rec?.id ?? rec?.object_id ?? null;
  }

  private calculatePriority(event: DBEvent): number {
    const table = this.getTableName(event?.table);
    
    // Priorité basée sur l'impact business
    switch (table) {
      case 'fe_source_workspace_assignments':
        return 1; // Haute priorité - affecte l'accès immédiat
      case 'emission_factors':
        return event.type === 'DELETE' ? 1 : 2; // DELETE urgent, autres medium
      case 'fe_sources':
        return 2; // Medium priority
      case 'favorites':
        return 3; // Basse priorité - pas critique pour Algolia
      default:
        return 3;
    }
  }

  private getTableName(raw: string | undefined | null): string {
    if (!raw) return ''
    const s = String(raw)
    const p = s.includes(':') ? s.split(':').pop() : s
    return (p || '').trim()
  }

  private scheduleBatch(): void {
    // Traitement immédiat si conditions critiques
    const hasHighPriority = Array.from(this.pendingUpdates.values()).some(b => b.priority === 1);
    const isBatchFull = this.pendingUpdates.size >= this.maxBatchSize;
    const hasOldBatch = Array.from(this.pendingUpdates.values()).some(
      b => Date.now() - b.timestamp > this.maxWaitTime
    );

    if (hasHighPriority || isBatchFull || hasOldBatch) {
      this.processBatch();
      return;
    }

    // Sinon programmer un batch
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay) as any;
  }

  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingUpdates.size === 0) return;

    const startTime = Date.now();
    const batches = Array.from(this.pendingUpdates.entries());
    const batchSize = batches.length;
    
    // Trier par priorité
    batches.sort(([,a], [,b]) => a.priority - b.priority);
    
    this.pendingUpdates.clear();
    this.metrics.batchedEvents += batchSize;
    this.metrics.avgBatchSize = (this.metrics.avgBatchSize + batchSize) / 2;

    console.log(`[WebhookBatcher] Processing batch of ${batchSize} sources`);

    // Traitement en parallèle optimisé
    const results = await this.processBatchesInParallel(batches);
    
    this.metrics.processingTime = Date.now() - startTime;
    
    console.log(`[WebhookBatcher] Batch completed in ${this.metrics.processingTime}ms`, {
      results,
      metrics: this.metrics
    });
  }

  private async processBatchesInParallel(
    batches: Array<[string, BatchUpdate]>
  ): Promise<Record<string, string>> {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'

    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
      return Object.fromEntries(batches.map(([source]) => [source, 'skipped_no_algolia']));
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: Record<string, string> = {};

    // Grouper par priorité pour traitement séquentiel des priorités
    const priorityGroups = new Map<number, Array<[string, BatchUpdate]>>();
    for (const batch of batches) {
      const priority = batch[1].priority;
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(batch);
    }

    // Traiter par ordre de priorité, en parallèle au sein de chaque priorité
    for (const [priority, group] of Array.from(priorityGroups.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`[WebhookBatcher] Processing priority ${priority} group (${group.length} sources)`);
      
      const promises = group.map(async ([source, batch]) => {
        try {
          const result = await this.syncAlgoliaForSourceOptimized(
            source, 
            batch, 
            supabase, 
            ALGOLIA_APP_ID, 
            ALGOLIA_ADMIN_KEY, 
            ALGOLIA_INDEX_ALL
          );
          results[source] = result;
        } catch (error) {
          console.error(`[WebhookBatcher] Error syncing source ${source}:`, error);
          results[source] = 'failed';
        }
      });

      // Attendre que ce groupe de priorité soit terminé avant le suivant
      await Promise.all(promises);
    }

    return results;
  }

  private async syncAlgoliaForSourceOptimized(
    sourceName: string,
    batch: BatchUpdate,
    supabase: any,
    appId: string,
    adminKey: string,
    indexName: string
  ): Promise<string> {
    const algoliaHeaders = {
      'X-Algolia-API-Key': adminKey,
      'X-Algolia-Application-Id': appId,
      'Content-Type': 'application/json'
    };

    try {

      // Optimisation: ne rafraîchir la projection que si nécessaire
      const needsFullRefresh = batch.operations.has('insert') || 
                              batch.operations.has('delete') ||
                              batch.objectIds.size > 10; // Seuil pour refresh complet

      if (needsFullRefresh) {
        // Refresh complet pour les changements majeurs
        await supabase.rpc('refresh_ef_all_for_source', { p_source: sourceName });
        
        const { data: rows, error } = await supabase
          .from('emission_factors_all_search')
          .select('*')
          .eq('Source', sourceName);
          
        if (error) throw new Error(`Projection fetch failed: ${error.message}`);

        const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }));
        
        // Purge totale de la Source avant réinjection (évite l'appel /query)
        await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${indexName}/deleteByQuery`, {
          method: 'POST',
          headers: algoliaHeaders,
          body: JSON.stringify({ filters: `Source:"${sourceName}"` })
        });

        if (records.length > 0) {
          // Batch update optimisé
          const batchRequests = records.map((record: any) => ({
            action: 'updateObject',
            body: record
          }));

          // Diviser en chunks si trop gros
          const chunkSize = 1000;
          for (let i = 0; i < batchRequests.length; i += chunkSize) {
            const chunk = batchRequests.slice(i, i + chunkSize);
            
            await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${indexName}/batch`, {
              method: 'POST',
              headers: algoliaHeaders,
              body: JSON.stringify({ requests: chunk })
            });
          }
        }
      } else {
        // Update incrémental pour les petits changements
        if (batch.objectIds.size > 0) {
          const objectIds = Array.from(batch.objectIds);
          
          const { data: rows, error } = await supabase
            .from('emission_factors_all_search')
            .select('*')
            .eq('Source', sourceName)
            .in('object_id', objectIds);
            
          if (error) throw new Error(`Incremental fetch failed: ${error.message}`);

          if (rows && rows.length > 0) {
            const records = rows.map((r: any) => ({ ...r, objectID: String(r.object_id) }));
            
            const batchRequests = records.map((record: any) => ({
              action: 'updateObject',
              body: record
            }));

            await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${indexName}/batch`, {
              method: 'POST',
              headers: algoliaHeaders,
              body: JSON.stringify({ requests: batchRequests })
            });
          }
        }
      }

      return 'ok';
    } catch (error) {
      console.error(`[WebhookBatcher] Sync error for ${sourceName}:`, error);
      return 'failed';
    }
  }

  getMetrics(): WebhookMetrics {
    return { ...this.metrics };
  }

  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingUpdates.clear();
  }
}

// Instance globale du batcher
const webhookBatcher = new WebhookBatcher();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const body = await req.json().catch(() => ({}))
    const events: DBEvent[] = Array.isArray(body) ? body : [body]
    
    console.log(`[db-webhooks-optimized] Received ${events.length} events`)

    // Traitement asynchrone des événements
    const processingPromises = events.map(event => 
      webhookBatcher.addEvent(event).catch(error => 
        console.error('[db-webhooks-optimized] Event processing error:', error)
      )
    );

    // Attendre que tous les événements soient ajoutés au batch
    await Promise.all(processingPromises);
    
    const metrics = webhookBatcher.getMetrics();
    
    return json(200, { 
      ok: true, 
      events_received: events.length,
      metrics,
      message: 'Events queued for batch processing'
    })
  } catch (e) {
    console.error('[db-webhooks-optimized] Error:', e);
    return json(500, { error: String(e) })
  }
})
