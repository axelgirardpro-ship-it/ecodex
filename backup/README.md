# Sauvegardes DB - Multi-Index Migration

## État gelé avant migration

Tag Git: `pre-multi-index-20250812`
Date: 12/08/2025

## Commandes de sauvegarde

```bash
# Récupérer l'URL de connexion depuis Supabase Dashboard > Settings > Database
PGURL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"

# Sauvegarde complète (recommandé pour restore)
pg_dump "$PGURL" --format=custom --no-owner --no-acl --file=./backup/pre_multi_index.full.backup

# Sauvegarde données critiques (optionnel)
pg_dump "$PGURL" --data-only --no-owner --no-acl \
  -t public.emission_factors \
  -t public.fe_sources \
  -t public.fe_source_workspace_assignments \
  -t public.data_imports \
  > ./backup/pre_multi_index.data.sql
```

## Commandes de restauration

```bash
# Restauration complète
pg_restore -d "$PGURL" --no-owner --no-acl ./backup/pre_multi_index.full.backup

# Ou depuis le tag Git
git checkout pre-multi-index-20250812
```

## Rollback rapide

1. **Frontend** (immédiat): `USE_SECURED_KEYS=false`, `USE_FEDERATED_SEARCH=false`, redeploy
2. **Connecteurs**: désactiver ef_public_fr/ef_private_fr 
3. **DB** (dernier recours): `pg_restore` depuis backup
