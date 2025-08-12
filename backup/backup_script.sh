#!/bin/bash

# Script de sauvegarde DB pour la migration multi-index
# Usage: ./backup_script.sh

set -e

PGURL="postgresql://postgres:Ga01700m%23@db.wrodvaatdujbpfpvrzge.supabase.co:5432/postgres"
BACKUP_FILE="./backup/pre_multi_index.full.backup"
DATA_FILE="./backup/pre_multi_index.data.sql"

echo "🔄 Création de la sauvegarde DB..."

# Sauvegarde complète (format custom pour restore facile)
echo "📦 Sauvegarde complète..."
/opt/homebrew/opt/postgresql@15/bin/pg_dump "$PGURL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$BACKUP_FILE"

# Sauvegarde données critiques (format SQL pour inspection)
echo "📋 Sauvegarde données critiques..."
/opt/homebrew/opt/postgresql@15/bin/pg_dump "$PGURL" \
  --data-only \
  --no-owner \
  --no-acl \
  -t public.emission_factors \
  -t public.fe_sources \
  -t public.fe_source_workspace_assignments \
  -t public.data_imports \
  > "$DATA_FILE"

echo "✅ Sauvegardes créées:"
echo "  - Complète: $BACKUP_FILE"
echo "  - Données:  $DATA_FILE"
echo ""
echo "🔙 Pour restaurer:"
echo "  pg_restore -d \"\$PGURL\" --no-owner --no-acl $BACKUP_FILE"
