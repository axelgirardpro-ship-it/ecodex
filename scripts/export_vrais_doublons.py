#!/usr/bin/env python3
"""
Export des vrais doublons depuis Supabase vers CSV
Date: 2025-10-02
"""

import os
import csv
from supabase import create_client, Client

# Configuration Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Erreur: Variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises")
    print("Définissez-les dans votre .env ou export dans le terminal")
    exit(1)

# Connexion Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("📊 Export des vrais doublons...")
print("=" * 60)

# Requête SQL pour récupérer les doublons
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
    nullif(btrim("Contributeur"), '') AS "Contributeur",
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
  pd."Contributeur",
  d.dup_count as "Nombre_total_doublons",
  pd.row_num as "Position_dans_groupe",
  CASE WHEN pd.row_num = 1 THEN 'CONSERVÉ' ELSE 'ÉLIMINÉ' END as "Statut"
FROM prepared_data pd
JOIN duplicates d ON d.factor_key = pd.factor_key
ORDER BY d.dup_count DESC, pd.factor_key, pd.row_num
"""

try:
    # Exécuter la requête
    result = supabase.rpc('execute_sql', {'query': query}).execute()
    
    # Extraire les données
    data = result.data
    
    if not data:
        print("❌ Aucune donnée retournée")
        exit(1)
    
    # Créer le fichier CSV
    output_file = 'docs/migration/2025-10-02_vrais_doublons_export.csv'
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'ID', 'Nom', 'Nom_en', 'FE', 'Unite', 'Source', 'Date', 
            'Perimetre', 'Localisation', 'Contributeur', 
            'Nombre_total_doublons', 'Position_dans_groupe', 'Statut'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in data:
            writer.writerow(row)
    
    print(f"✅ Export réussi: {len(data)} lignes")
    print(f"📁 Fichier: {output_file}")
    
    # Statistiques
    conserves = sum(1 for row in data if row['Statut'] == 'CONSERVÉ')
    elimines = sum(1 for row in data if row['Statut'] == 'ÉLIMINÉ')
    
    print("")
    print("📊 Statistiques:")
    print(f"  - Total lignes dans CSV: {len(data)}")
    print(f"  - Lignes conservées: {conserves}")
    print(f"  - Lignes éliminées: {elimines}")
    
except Exception as e:
    print(f"❌ Erreur: {str(e)}")
    exit(1)

print("")
print("✨ Export terminé!")

