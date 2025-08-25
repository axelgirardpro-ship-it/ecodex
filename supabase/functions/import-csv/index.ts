// Edge Function ADMIN (renommée): analyse + import SCD2, puis reindex atomique déclenché côté admin
// @ts-ignore - Import ESM valide pour Deno/Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Import XLSX pour parsing Excel
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
// Import du parser CSV robuste
import { RobustCsvParser } from './csv-parser.ts'

// Types pour l'environnement Deno/Edge Functions
interface DenoEnv {
  get(key: string): string | undefined;
}

interface DenoGlobal {
  env: DenoEnv;
  serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare const Deno: DenoGlobal;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function computeFactorKey(row: Record<string,string>, language: string) {
  const nom = (row['Nom'] || '').toLowerCase().trim();
  const unite = (row["Unité donnée d'activité"] || '').toLowerCase().trim();
  const source = (row['Source'] || '').toLowerCase().trim();
  const perimetre = (row['Périmètre'] || '').toLowerCase().trim();
  const localisation = (row['Localisation'] || '').toLowerCase().trim();
  const lang = (language || 'fr').toLowerCase().trim();
  return [nom, unite, source, perimetre, localisation, lang].join('|');
}

async function readCsvContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Cannot fetch CSV from storage');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let { value, done } = await reader.read();
  let buffer = value ? decoder.decode(value, { stream: true }) : '';
  while (!done) {
    ({ value, done } = await reader.read());
    if (value) buffer += decoder.decode(value, { stream: true });
  }
  return buffer;
}

async function readGzipCsvContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Cannot fetch GZ CSV from storage');
  // Décompresser en streaming
  // @ts-ignore - DecompressionStream est dispo en Deno Edge
  const decompressed = res.body.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressed.getReader();
  const decoder = new TextDecoder();
  let { value, done } = await reader.read();
  let buffer = value ? decoder.decode(value, { stream: true }) : '';
  while (!done) {
    ({ value, done } = await reader.read());
    if (value) buffer += decoder.decode(value, { stream: true });
  }
  return buffer;
}

async function readXlsxLines(url: string, maxErrors = 50) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Cannot fetch XLSX from storage');
  
  // Lire le fichier XLSX en ArrayBuffer
  const arrayBuffer = await res.arrayBuffer();
  
  // Parser avec XLSX
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Prendre la première feuille
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convertir en CSV
  const csvString = XLSX.utils.sheet_to_csv(worksheet);
  
  // Retourner les lignes comme pour CSV
  return csvString.split(/\r?\n/).filter(l => l !== '');
}

async function readFileContent(url: string): Promise<string> {
  // Détecter le type de fichier par l'URL
  const lower = url.toLowerCase();
  const isXlsx = lower.includes('.xlsx');
  const isGz = lower.endsWith('.gz') || lower.includes('.csv.gz');
  
  if (isXlsx) {
    console.log('📊 Détection fichier XLSX, parsing Excel...');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Cannot fetch XLSX from storage');
    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_csv(worksheet);
  } else if (isGz) {
    console.log('🗜️ Détection fichier CSV GZ, décompression streaming...');
    return await readGzipCsvContent(url);
  } else {
    console.log('📄 Détection fichier CSV, parsing texte...');
    return await readCsvContent(url);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: supaAdminCheck, error: roleError } = await supabase.rpc('is_supra_admin', { user_uuid: user.id })
    if (roleError || !supaAdminCheck) return new Response(JSON.stringify({ error: 'Access denied - supra admin required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json();
    const filePath = body?.file_path as string;
    const language = (body?.language as string) || 'fr';
    const dryRun = Boolean(body?.dry_run);
    const replaceAll = Boolean(body?.replace_all);
    const mapping = (body?.mapping || {}) as Record<string, { access_level: 'standard' | 'premium'; is_global?: boolean }>;

    if (!filePath) return new Response(JSON.stringify({ error: 'file_path is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const fileNameOnly = (filePath || '').split('/').pop() || filePath

    const { data: importRecord, error: importError } = await supabase
      .from('data_imports')
      .insert({
        user_id: user.id,
        storage_path: filePath,
        file_name: fileNameOnly,
        status: dryRun ? 'analyzing' : 'processing',
        language,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (importError) return new Response(JSON.stringify({ error: 'Failed to create import record' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: signed, error: signedErr } = await supabase.storage.from('imports').createSignedUrl(filePath, 3600)
    if (signedErr || !signed?.signedUrl) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: 'signed url failure' }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: 'Cannot sign storage url' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const fileContent = await readFileContent(signed.signedUrl)
    
    let parsedData;
    try {
      parsedData = RobustCsvParser.parseCSVContent(fileContent);
      console.log(`✅ Parser robuste: ${parsedData.rows.length} lignes parsées`);
    } catch (parseError) {
      await supabase.from('data_imports').update({ 
        status: 'failed', 
        error_details: { error: `Erreur de parsing CSV: ${parseError.message}` }, 
        finished_at: new Date().toISOString() 
      }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: `Erreur de parsing CSV: ${parseError.message}` }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { headers, rows } = parsedData;
    
    if (rows.length === 0) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: 'empty csv after parsing' }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: 'CSV vide après parsing' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Extraire les sources avec validation
    const sourcesCount = RobustCsvParser.extractSourcesFromRows(rows);
    console.log(`🔍 Sources détectées: ${Array.from(sourcesCount.keys()).join(', ')}`);
    
    const errors: string[] = []
    const processed = rows.length
    let idsMissing = 0

    // Compter les IDs manquants
    for (const row of rows) {
      const providedId = (row['ID'] || '').trim()
      if (!providedId) idsMissing++
    }

    if (dryRun) {
      await supabase.from('data_imports').update({ status: 'analyzed', processed: processed, failed: errors.length, error_samples: errors.length ? JSON.stringify({ errors }) : null }).eq('id', importRecord.id)
      const sources = Array.from(sourcesCount.entries()).map(([name, count]) => ({ name, count, access_level: mapping?.[name]?.access_level || 'standard', is_global: mapping?.[name]?.is_global ?? true }))
      return new Response(JSON.stringify({ import_id: importRecord.id, total_rows: rows.length, processed, errors_sample: errors.slice(0, 20), ids_missing: idsMissing, sources }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Non dry-run – pipeline: upsert fe_sources + SCD2 par factor_key (ID prioritaire)
    try {
      // Mode remplacement intégral: remettre à false tous les is_latest pour la langue visée
      if (replaceAll) {
        await supabase
          .from('emission_factors')
          .update({ is_latest: false, valid_to: new Date().toISOString() })
          .eq('language', language)
          .eq('is_latest', true)
      }
      // Récupérer le workspace de l'utilisateur pour les assignations
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()
      
      const userWorkspaceId = profile?.workspace_id

      for (const [name] of sourcesCount) {
        const cfg = mapping?.[name] || { access_level: 'standard', is_global: true }
        await supabase.from('fe_sources').upsert({ source_name: name, access_level: cfg.access_level, is_global: cfg.is_global }, { onConflict: 'source_name' })
        
        // IMPORTANT: Pour les imports utilisateur (non globaux), assigner automatiquement au workspace
        if (!cfg.is_global && userWorkspaceId) {
          await supabase
            .from('fe_source_workspace_assignments')
            .upsert({ 
              source_name: name, 
              workspace_id: userWorkspaceId,
              assigned_by: user.id
            }, { onConflict: 'source_name,workspace_id' })
        }
      }

      let inserted = 0
      const chunkSize = 1000
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize)
        const batch: any[] = []
        const keys: string[] = []

        for (const row of slice) {
          const factorKey = (row['ID'] && row['ID'].trim()) ? row['ID'].trim() : computeFactorKey(row, language)
          keys.push(factorKey)

          const toNumber = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null }
          const toInt = (s: string) => { const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }

          batch.push({
            factor_key: factorKey,
            version_id: (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(36).substring(2)}`,
            is_latest: true,
            valid_from: new Date().toISOString(),
            language,
            "Nom": row['Nom'],
            "Description": row['Description'] || null,
            "FE": toNumber(row['FE']),
            "Unité donnée d'activité": row["Unité donnée d'activité"],
            "Source": row['Source'],
            "Secteur": row['Secteur'] || null,
            "Sous-secteur": row['Sous-secteur'] || null,
            "Localisation": row['Localisation'],
            "Date": toInt(row['Date']),
            "Incertitude": row['Incertitude'] || null,
            "Périmètre": row['Périmètre'] || null,
            "Contributeur": row['Contributeur'] || null,
            "Commentaires": row['Commentaires'] || null,
            "Nom_en": row['Nom_en'] || null,
            "Description_en": row['Description_en'] || null,
            "Commentaires_en": row['Commentaires_en'] || null,
            "Secteur_en": row['Secteur_en'] || null,
            "Sous-secteur_en": row['Sous-secteur_en'] || null,
            "Périmètre_en": row['Périmètre_en'] || null,
            "Localisation_en": row['Localisation_en'] || null,
            "Unite_en": row['Unite_en'] || null,
          })
        }

        if (keys.length) {
          await supabase
            .from('emission_factors')
            .update({ is_latest: false, valid_to: new Date().toISOString() })
            .in('factor_key', keys)
            .eq('language', language)
            .eq('is_latest', true)

          const { error: insErr } = await supabase.from('emission_factors').insert(batch)
          if (!insErr) inserted += batch.length
        }
      }

      if (replaceAll) {
        // Rebuild complet de la projection pour refléter uniquement le nouveau dataset
        await supabase.rpc('rebuild_emission_factors_all_search')
      } else {
        // Rafraîchir projection par source (évite gros rebuild si ciblé)
        for (const [sourceName] of sourcesCount) {
          await supabase.rpc('refresh_ef_all_for_source', { p_source: sourceName })
        }
      }

      // L'indexation Algolia se fera via reindex atomique déclenché côté admin (pas ici)

      await supabase.from('data_imports').update({ status: 'completed', finished_at: new Date().toISOString(), processed: processed, inserted: inserted }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ import_id: importRecord.id, processed, inserted, status: 'completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (e) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: String(e) }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any)?.message || String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})