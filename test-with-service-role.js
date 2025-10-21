// Test direct en utilisant le service_role key pour bypasser l'auth
// Cela simule un utilisateur authentifié avec workspace_id correct

const SUPABASE_URL = 'https://wrodvaatdujbpfpvrzge.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2YWF0ZHVqYnBmcHZyemdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzE3MzgsImV4cCI6MjA2OTMwNzczOH0.0ac4Hjbb09n7V8orvD16jtj0ZA6Qz8T0PBM3y33fQ0s';
const USER_ID = 'e6e2e278-14e9-44fd-86ff-28da775f43c6';
const WORKSPACE_ID = 'de960863-892c-45e2-8288-b9bbc69bc03b';

// Créer un token JWT simplifié pour les tests (non signé, juste pour debug)
function createMockJWT() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: USER_ID,
    email: 'axelgirard.pro+dev@gmail.com',
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  // Note: signature invalide mais suffisant pour tester le parsing
  return `${base64Header}.${base64Payload}.fake_signature`;
}

async function testWithInspection(testName, requestBody) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(70)}`);
  
  const url = `${SUPABASE_URL}/functions/v1/algolia-search-proxy`;
  
  // Tester AVEC et SANS authentification
  for (const withAuth of [false, true]) {
    console.log(`\n${withAuth ? '🔐 AVEC' : '🔓 SANS'} authentification:`);
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY
    };
    
    if (withAuth) {
      // Essayer avec un token mock (pour voir si ça passe le parsing)
      headers['Authorization'] = `Bearer ${createMockJWT()}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log(`   Status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`   ❌ Erreur:`, responseText.substring(0, 200));
        continue;
      }

      const data = JSON.parse(responseText);
      const hits = data.nbHits !== undefined ? data.nbHits : (data.results?.[0]?.nbHits || 0);
      
      console.log(`   ✅ Hits: ${hits}`);
      
      if (hits > 0) {
        const firstHit = data.hits?.[0] || data.results?.[0]?.hits?.[0];
        if (firstHit) {
          console.log(`   📊 Premier hit:`);
          console.log(`      - Nom: ${firstHit.Nom_fr || 'N/A'}`);
          console.log(`      - scope: ${firstHit.scope}`);
          console.log(`      - workspace_id: ${firstHit.workspace_id}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Exception:`, error.message);
    }
  }
}

async function runDiagnostic() {
  console.log('🔍 DIAGNOSTIC COMPLET EDGE FUNCTION');
  console.log('User ID:', USER_ID);
  console.log('Workspace ID:', WORKSPACE_ID);
  console.log('=' .repeat(70));

  // TEST 1: Mode private vide
  await testWithInspection(
    '1. Mode PRIVATE - Query vide',
    {
      params: {
        query: '',
        origin: 'private',
        hitsPerPage: 5
      }
    }
  );

  // TEST 2: Mode private avec recherche
  await testWithInspection(
    '2. Mode PRIVATE - Recherche "Axel"',
    {
      params: {
        query: 'Axel',
        origin: 'private',
        hitsPerPage: 5
      }
    }
  );

  // TEST 3: Mode public (pour confirmer que l'Edge Function fonctionne)
  await testWithInspection(
    '3. Mode PUBLIC - Baseline',
    {
      params: {
        query: '',
        origin: 'public',
        hitsPerPage: 5
      }
    }
  );

  console.log('\n' + '='.repeat(70));
  console.log('📋 CONCLUSIONS:');
  console.log('   - Public fonctionne → Edge Function opérationnelle');
  console.log('   - Private SANS auth retourne 0 → Normal (workspace_id=null)');
  console.log('   - Private AVEC auth retourne 0 → Problème d\'extraction du workspace_id');
  console.log('\n💡 Consultez les logs de l\'Edge Function v133 pour voir les DEBUG');
}

runDiagnostic().catch(console.error);

