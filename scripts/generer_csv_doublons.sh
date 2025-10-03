#!/bin/bash
# Génère un CSV des vrais doublons via l'API Supabase
# Usage: ./scripts/generer_csv_doublons.sh

set -e

echo "📊 Génération du CSV des vrais doublons..."
echo "=============================================="

# Charger les variables d'environnement
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Vérifier les variables
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Erreur: Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises"
    echo "Définissez-les dans .env.local ou en variables d'environnement"
    exit 1
fi

echo "🔗 URL: ${VITE_SUPABASE_URL:0:50}..."

# Créer le fichier de sortie
OUTPUT_FILE="docs/migration/vrais_doublons_$(date +%Y%m%d_%H%M%S).csv"

echo "📝 Fichier de sortie: $OUTPUT_FILE"
echo ""
echo "⏳ Exécution de la requête SQL..."

# Requête SQL (en ligne simple pour curl)
SQL_QUERY='WITH prepared_data AS (SELECT "ID", coalesce(nullif(btrim("Nom"), '"'"''"'"'), nullif(btrim("Nom_en"), '"'"''"'"')) AS "Nom", public.safe_to_numeric(nullif(btrim("FE"), '"'"''"'"')) AS "FE", coalesce(nullif(btrim("Unité donnée d'"'"'activité"), '"'"''"'"'), nullif(btrim("Unite_en"), '"'"''"'"')) AS "Unite", nullif(btrim("Source"), '"'"''"'"') AS "Source", public.safe_to_int(nullif(btrim("Date"), '"'"''"'"')) AS "Date", coalesce(nullif(btrim("Localisation"), '"'"''"'"'), nullif(btrim("Localisation_en"), '"'"''"'"')) AS "Localisation", public.calculate_factor_key(coalesce(nullif(btrim("Nom"), '"'"''"'"'), nullif(btrim("Nom_en"), '"'"''"'"')), coalesce(nullif(btrim("Unité donnée d'"'"'activité"), '"'"''"'"'), nullif(btrim("Unite_en"), '"'"''"'"')), nullif(btrim("Source"), '"'"''"'"'), coalesce(nullif(btrim("Périmètre"), '"'"''"'"'), nullif(btrim("Périmètre_en"), '"'"''"'"')), coalesce(nullif(btrim("Localisation"), '"'"''"'"'), nullif(btrim("Localisation_en"), '"'"''"'"')), NULL, NULL, public.safe_to_numeric(nullif(btrim("FE"), '"'"''"'"')), public.safe_to_int(nullif(btrim("Date"), '"'"''"'"'))) AS factor_key, ROW_NUMBER() OVER (PARTITION BY public.calculate_factor_key(coalesce(nullif(btrim("Nom"), '"'"''"'"'), nullif(btrim("Nom_en"), '"'"''"'"')), coalesce(nullif(btrim("Unité donnée d'"'"'activité"), '"'"''"'"'), nullif(btrim("Unite_en"), '"'"''"'"')), nullif(btrim("Source"), '"'"''"'"'), coalesce(nullif(btrim("Périmètre"), '"'"''"'"'), nullif(btrim("Périmètre_en"), '"'"''"'"')), coalesce(nullif(btrim("Localisation"), '"'"''"'"'), nullif(btrim("Localisation_en"), '"'"''"'"')), NULL, NULL, public.safe_to_numeric(nullif(btrim("FE"), '"'"''"'"')), public.safe_to_int(nullif(btrim("Date"), '"'"''"'"'))) ORDER BY "ID") AS row_num FROM staging_emission_factors WHERE nullif(btrim("FE"), '"'"''"'"') IS NOT NULL AND nullif(btrim("Unité donnée d'"'"'activité"), '"'"''"'"') IS NOT NULL), duplicates AS (SELECT factor_key, COUNT(*) as dup_count FROM prepared_data GROUP BY factor_key HAVING COUNT(*) > 1) SELECT pd."ID", pd."Nom", pd."FE"::text, pd."Unite", pd."Source", pd."Date"::text, pd."Localisation", d.dup_count, pd.row_num, CASE WHEN pd.row_num = 1 THEN '"'"'CONSERVÉ'"'"' ELSE '"'"'ÉLIMINÉ'"'"' END as "Statut" FROM prepared_data pd JOIN duplicates d ON d.factor_key = pd.factor_key ORDER BY d.dup_count DESC, pd.factor_key, pd.row_num LIMIT 10000'

# Note: Utiliser l'API REST Supabase ne permet pas d'exécuter du SQL arbitraire
# Il faut passer par une fonction RPC

echo "⚠️  Ce script nécessite une fonction RPC dans Supabase pour exécuter du SQL"
echo ""
echo "📋 Pour exporter manuellement:"
echo "1. Ouvrir https://supabase.com/dashboard → SQL Editor"
echo "2. Copier-coller le contenu de: scripts/export_vrais_doublons_complet.sql"
echo "3. Exécuter la requête"
echo "4. Cliquer sur 'Download CSV'"
echo ""
echo "💡 Ou utiliser le script Python:"
echo "   python3 scripts/export_vrais_doublons_csv.py"
echo ""
echo "📖 Instructions complètes: docs/migration/2025-10-02_EXPORT_DOUBLONS_INSTRUCTIONS.md"

