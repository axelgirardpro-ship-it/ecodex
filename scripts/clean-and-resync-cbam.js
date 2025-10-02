/**
 * Script pour nettoyer complètement CBAM dans Algolia et re-synchroniser
 * Usage: node scripts/clean-and-resync-cbam.js
 */

import algoliasearch from 'algoliasearch';
import { createClient } from '@supabase/supabase-js';

const ALGOLIA_APP_ID = process.env.VITE_ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const ALGOLIA_INDEX = process.env.VITE_ALGOLIA_INDEX_ALL || 'ef_all';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('Vérifiez: VITE_ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = algoliaClient.initIndex(ALGOLIA_INDEX);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanAndResyncCBAM() {
  console.log('🧹 ÉTAPE 1: Suppression de tous les records CBAM existants dans Algolia...\n');
  
  try {
    // Supprimer tous les records CBAM
    await index.deleteBy({
      filters: 'Source:"CBAM"'
    });
    console.log('✅ Tous les records CBAM supprimés d\'Algolia\n');
    
    // Attendre que la suppression soit effective
    console.log('⏳ Attente de 3 secondes pour la propagation...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    process.exit(1);
  }
  
  console.log('📊 ÉTAPE 2: Récupération des records CBAM depuis Supabase...\n');
  
  try {
    const { data: rows, error } = await supabase
      .from('emission_factors_all_search')
      .select('*')
      .eq('Source', 'CBAM');
    
    if (error) throw error;
    
    console.log(`✅ ${rows.length} records récupérés de la projection\n`);
    
    // Préparer les records pour Algolia
    const records = rows.map(r => ({
      ...r,
      objectID: String(r.object_id)
    }));
    
    console.log('📤 ÉTAPE 3: Envoi des records vers Algolia par batches de 1000...\n');
    
    const batchSize = 1000;
    let totalSaved = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);
      
      console.log(`   Envoi du batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
      
      await index.saveObjects(batch);
      totalSaved += batch.length;
      
      // Petite pause entre les batches pour éviter de surcharger l'API
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\n✅ ${totalSaved} records CBAM sauvegardés dans Algolia\n`);
    
    // Vérification finale
    console.log('🔍 ÉTAPE 4: Vérification finale...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { nbHits } = await index.search('', {
      filters: 'Source:"CBAM"',
      hitsPerPage: 0
    });
    
    console.log(`📊 Résultat final:`);
    console.log(`   - Records dans Supabase: ${rows.length}`);
    console.log(`   - Records dans Algolia: ${nbHits}`);
    
    if (nbHits === rows.length) {
      console.log('\n🎉 SUCCÈS ! Tous les records CBAM sont synchronisés !\n');
    } else {
      console.log(`\n⚠️  Attention: différence de ${Math.abs(nbHits - rows.length)} records`);
      console.log('   Attendez quelques secondes et vérifiez à nouveau dans l\'interface\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

cleanAndResyncCBAM();

