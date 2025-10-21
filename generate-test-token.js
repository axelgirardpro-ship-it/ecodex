// Script pour générer un token JWT de test via Supabase Auth
const SUPABASE_URL = 'https://wrodvaatdujbpfpvrzge.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2YWF0ZHVqYnBmcHZyemdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzE3MzgsImV4cCI6MjA2OTMwNzczOH0.0ac4Hjbb09n7V8orvD16jtj0ZA6Qz8T0PBM3y33fQ0s';

const EMAIL = process.env.TEST_EMAIL || 'axelgirard.pro+dev@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD;

async function getAuthToken() {
  if (!PASSWORD) {
    console.error('❌ Veuillez définir TEST_PASSWORD dans les variables d\'environnement');
    console.log('Usage: TEST_PASSWORD="votre_mot_de_passe" node generate-test-token.js');
    process.exit(1);
  }

  console.log('🔐 Authentification à Supabase...');
  console.log(`Email: ${EMAIL}`);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur d\'authentification:', response.status);
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('\n✅ Authentification réussie !');
    console.log('\n📋 Token JWT (access_token):');
    console.log(data.access_token);
    console.log('\n📋 User ID:');
    console.log(data.user.id);
    console.log('\n⏰ Expire à:', new Date(data.expires_at * 1000).toLocaleString());
    
    // Sauvegarder le token pour les autres scripts
    const fs = require('fs');
    fs.writeFileSync('.test-token.json', JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user.id,
      expires_at: data.expires_at
    }, null, 2));
    
    console.log('\n💾 Token sauvegardé dans .test-token.json');
    
    return data.access_token;
  } catch (error) {
    console.error('❌ Exception:', error.message);
    process.exit(1);
  }
}

getAuthToken().catch(console.error);

