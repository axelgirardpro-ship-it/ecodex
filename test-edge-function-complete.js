// Test complet de l'Edge Function avec token JWT valide
const fs = require('fs');

const SUPABASE_URL = 'https://wrodvaatdujbpfpvrzge.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2YWF0ZHVqYnBmcHZyemdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzE3MzgsImV4cCI6MjA2OTMwNzczOH0.0ac4Hjbb09n7V8orvD16jtj0ZA6Qz8T0PBM3y33fQ0s';

async function loadToken() {
  try {
    const tokenData = JSON.parse(fs.readFileSync('.test-token.json', 'utf8'));
    console.log('✅ Token chargé depuis .test-token.json');
    console.log(`   User ID: ${tokenData.user_id}`);
    console.log(`   Expire à: ${new Date(tokenData.expires_at * 1000).toLocaleString()}`);
    return tokenData.access_token;
  } catch (error) {
    console.error('❌ Impossible de charger le token');
    console.error('   Exécutez d\'abord: TEST_PASSWORD="..." node generate-test-token.js');
    process.exit(1);
  }
}

async function testEdgeFunction(testName, requestBody, token) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(70)}`);
  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  const url = `${SUPABASE_URL}/functions/v1/algolia-search-proxy`;
  
  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`
  };

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const elapsed = Date.now() - startTime;
    const responseText = await response.text();
    
    console.log(`\n📡 Response:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Time: ${elapsed}ms`);
    
    if (!response.ok) {
      console.error('❌ ERREUR:', responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    
    if (data.results) {
      // Batch response
      const result = data.results[0];
      console.log(`   Hits: ${result?.nbHits || 0}`);
      console.log(`   Processing time: ${result?.processingTimeMS || 0}ms`);
      
      if (result?.hits?.length > 0) {
        console.log('\n📊 Premiers hits:');
        result.hits.slice(0, 3).forEach((hit, i) => {
          console.log(`   ${i + 1}. ${hit.Nom_fr || hit.Nom_en || 'Sans nom'}`);
          console.log(`      - objectID: ${hit.objectID}`);
          console.log(`      - scope: ${hit.scope}`);
          console.log(`      - workspace_id: ${hit.workspace_id}`);
          console.log(`      - Source: ${hit.Source}`);
        });
      }
      
      if (result?.facets) {
        console.log('\n🏷️  Facets:', Object.keys(result.facets).join(', '));
      }
    } else {
      // Single response
      console.log(`   Hits: ${data?.nbHits || 0}`);
      console.log(`   Processing time: ${data?.processingTimeMS || 0}ms`);
      
      if (data?.hits?.length > 0) {
        console.log('\n📊 Premiers hits:');
        data.hits.slice(0, 3).forEach((hit, i) => {
          console.log(`   ${i + 1}. ${hit.Nom_fr || hit.Nom_en || 'Sans nom'}`);
          console.log(`      - objectID: ${hit.objectID}`);
          console.log(`      - scope: ${hit.scope}`);
          console.log(`      - workspace_id: ${hit.workspace_id}`);
          console.log(`      - Source: ${hit.Source}`);
        });
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Exception:', error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 TEST COMPLET DE L\'EDGE FUNCTION ALGOLIA-SEARCH-PROXY');
  console.log('=' .repeat(70));
  
  const token = await loadToken();
  
  // TEST 1: Mode private avec query vide (devrait retourner tous les records privés)
  await testEdgeFunction(
    '1. Mode PRIVATE - Query vide (tous les records)',
    {
      params: {
        query: '',
        origin: 'private',
        hitsPerPage: 5
      }
    },
    token
  );

  // TEST 2: Mode private avec recherche "Axel"
  await testEdgeFunction(
    '2. Mode PRIVATE - Recherche "Axel"',
    {
      params: {
        query: 'Axel',
        origin: 'private',
        hitsPerPage: 5
      }
    },
    token
  );

  // TEST 3: Mode private avec recherche "Transport"
  await testEdgeFunction(
    '3. Mode PRIVATE - Recherche "Transport"',
    {
      params: {
        query: 'Transport',
        origin: 'private',
        hitsPerPage: 5
      }
    },
    token
  );

  // TEST 4: Mode private avec facets
  await testEdgeFunction(
    '4. Mode PRIVATE - Avec facets Source et dataset_name',
    {
      params: {
        query: '',
        origin: 'private',
        hitsPerPage: 5,
        facets: ['Source', 'dataset_name', 'workspace_id']
      }
    },
    token
  );

  // TEST 5: Mode public pour comparaison (devrait retourner beaucoup de hits)
  await testEdgeFunction(
    '5. Mode PUBLIC - Pour comparaison',
    {
      params: {
        query: '',
        origin: 'public',
        hitsPerPage: 5
      }
    },
    token
  );

  console.log('\n' + '='.repeat(70));
  console.log('✅ Tests terminés');
  console.log('='.repeat(70));
  console.log('\n💡 Analyse:');
  console.log('   - Si tous les tests Private retournent 0 hits → Problème dans Edge Function');
  console.log('   - Si test Public fonctionne → Auth OK, problème spécifique au filtrage Private');
  console.log('   - Consultez les logs Edge Function pour voir les messages DEBUG');
}

runAllTests().catch(console.error);

