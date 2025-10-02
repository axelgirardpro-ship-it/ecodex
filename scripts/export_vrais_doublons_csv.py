#!/usr/bin/env python3
"""
Export des vrais doublons depuis Supabase vers CSV
Date: 2025-10-02
Usage: python3 scripts/export_vrais_doublons_csv.py
"""

import os
import csv
import json
from datetime import datetime

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️  Package supabase non disponible, utilisation de requests...")
    import requests
    SUPABASE_AVAILABLE = False

def get_env_var(name):
    """Récupère une variable d'environnement"""
    value = os.environ.get(name)
    if not value:
        # Essayer de charger depuis .env.local
        try:
            with open('.env.local', 'r') as f:
                for line in f:
                    if line.startswith(name):
                        return line.split('=', 1)[1].strip().strip('"\'')
        except:
            pass
    return value

# Configuration
SUPABASE_URL = get_env_var('VITE_SUPABASE_URL') or get_env_var('SUPABASE_URL')
SUPABASE_KEY = get_env_var('VITE_SUPABASE_ANON_KEY') or get_env_var('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Erreur: Variables d'environnement Supabase non trouvées")
    print("Recherche dans: VITE_SUPABASE_URL, SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY")
    exit(1)

print("📊 Export des vrais doublons vers CSV")
print("=" * 70)
print(f"🔗 Supabase URL: {SUPABASE_URL[:50]}...")

# Requête SQL
query = """
WITH prepared_data AS (
  SELECT
    "ID",
    coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
    nullif(btrim("Nom_en"), '') AS "Nom_en",
    public.safe_to_numeric(nullif(btrim("FE"), '')) AS "FE",
    coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) AS "Unite",
    nullif(btrim("Source"), '') AS "Source",
    public.safe_to_int(nullif(btrim("Date"), '')) AS "Date",
    coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')) AS "Perimetre",
    coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')) AS "Localisation",
    public.calculate_factor_key(
      coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
      coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
      nullif(btrim("Source"), ''),
      coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
      coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
      NULL, NULL,
      public.safe_to_numeric(nullif(btrim("FE"), '')),
      public.safe_to_int(nullif(btrim("Date"), ''))
    ) AS factor_key,
    ROW_NUMBER() OVER (PARTITION BY 
      public.calculate_factor_key(
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
        coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
        nullif(btrim("Source"), ''),
        coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
        coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
        NULL, NULL,
        public.safe_to_numeric(nullif(btrim("FE"), '')),
        public.safe_to_int(nullif(btrim("Date"), ''))
      )
      ORDER BY "ID"
    ) AS row_num
  FROM staging_emission_factors
  WHERE nullif(btrim("FE"), '') IS NOT NULL
    AND nullif(btrim("Unité donnée d'activité"), '') IS NOT NULL
),
duplicates AS (
  SELECT 
    factor_key,
    COUNT(*) as dup_count
  FROM prepared_data
  GROUP BY factor_key
  HAVING COUNT(*) > 1
)
SELECT 
  pd."ID",
  pd."Nom",
  pd."Nom_en",
  pd."FE",
  pd."Unite",
  pd."Source",
  pd."Date",
  pd."Perimetre",
  pd."Localisation",
  d.dup_count as "Nombre_total_doublons",
  pd.row_num as "Position_dans_groupe",
  CASE WHEN pd.row_num = 1 THEN 'CONSERVÉ' ELSE 'ÉLIMINÉ' END as "Statut"
FROM prepared_data pd
JOIN duplicates d ON d.factor_key = pd.factor_key
ORDER BY d.dup_count DESC, pd.factor_key, pd.row_num
LIMIT 10000;
"""

print("⏳ Exécution de la requête...")

try:
    if SUPABASE_AVAILABLE:
        # Utiliser le client Supabase
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        response = supabase.rpc('execute_raw_sql', {'query': query}).execute()
        data = response.data
    else:
        # Utiliser requests directement
        import requests
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        response = requests.post(
            f'{SUPABASE_URL}/rest/v1/rpc/execute_raw_sql',
            headers=headers,
            json={'query': query}
        )
        response.raise_for_status()
        data = response.json()
    
    if not data or len(data) == 0:
        print("⚠️  Aucune donnée retournée (peut-être aucun doublon)")
        exit(0)
    
    print(f"✅ Données récupérées: {len(data)} lignes")
    
    # Créer le fichier CSV
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'docs/migration/2025-10-02_vrais_doublons_{timestamp}.csv'
    
    print(f"📝 Création du fichier CSV: {output_file}")
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        if len(data) > 0:
            fieldnames = list(data[0].keys())
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for row in data:
                writer.writerow(row)
    
    print(f"✅ Export réussi!")
    print("")
    print("📊 Statistiques:")
    print(f"  - Total lignes exportées: {len(data)}")
    
    # Compter conservés vs éliminés
    if 'Statut' in data[0]:
        conserves = sum(1 for row in data if row['Statut'] == 'CONSERVÉ')
        elimines = sum(1 for row in data if row['Statut'] == 'ÉLIMINÉ')
        print(f"  - Lignes conservées: {conserves}")
        print(f"  - Lignes éliminées: {elimines}")
    
    # Top 5 sources
    if 'Source' in data[0]:
        sources = {}
        for row in data:
            source = row.get('Source', 'N/A')
            sources[source] = sources.get(source, 0) + 1
        
        print("")
        print("🏆 Top 5 sources avec doublons:")
        for source, count in sorted(sources.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"  - {source}: {count} lignes")
    
    print("")
    print(f"📁 Fichier créé: {output_file}")
    print("✨ Export terminé!")
    
except Exception as e:
    print(f"❌ Erreur: {str(e)}")
    import traceback
    traceback.print_exc()
    exit(1)

