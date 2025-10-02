import { createClient } from '@supabase/supabase-js';
import * as algoliaMod from 'algoliasearch';

const algoliasearch = algoliaMod.default ?? algoliaMod.algoliasearch ?? algoliaMod;

const {
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VITE_ALGOLIA_APP_ID,
  ALGOLIA_ADMIN_KEY,
  VITE_ALGOLIA_INDEX_ALL = 'ef_all'
} = process.env;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VITE_ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

if (typeof algoliasearch !== 'function') {
  console.error('❌ Could not initialize Algolia client');
  process.exit(1);
}

const WORKSPACE_ID = 'de960863-892c-45e2-8288-b9bbc69bc03b';

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const algoliaClient = algoliasearch(VITE_ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

async function main() {
  console.log('📥 Fetching CBAM records from Supabase…');
  const { data, error } = await supabase
    .from('emission_factors_all_search')
    .select('*')
    .eq('Source', 'CBAM');
  if (error) {
    console.error('❌ Supabase query error:', error);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error('⚠️ No CBAM records found in projection');
    process.exit(1);
  }

  const records = data.map((row) => {
    const assigned = new Set(row.assigned_workspace_ids || []);
    assigned.add(WORKSPACE_ID);
    return {
      ...row,
      assigned_workspace_ids: Array.from(assigned),
      objectID: String(row.ID_FE || row.object_id)
    };
  });

  console.log(`📦 Preparing to push ${records.length} records to Algolia…`);
  const batchSize = 1000;
  let pushed = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`   → Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length})`);
    await algoliaClient.saveObjects({ indexName: VITE_ALGOLIA_INDEX_ALL, objects: batch });
    pushed += batch.length;
  }

  console.log(`✅ Done! ${pushed} CBAM records pushed to Algolia with workspace assignment.`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
