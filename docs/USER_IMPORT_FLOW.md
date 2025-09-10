# Flux d'import utilisateur (dataset personnel)

## Résumé
1. Front: upload CSV (ou CSV.GZ / XLSX) et nom de dataset.
2. Edge `import-csv-user`:
   - Reset initial: `reset_user_import_tables()` (TRUNCATE `staging_user_imports`, `user_batch_algolia`, `staging_emission_factors`).
   - Parsing robuste et staging par chunks dans `staging_user_imports` avec `Source = dataset_name` forcé.
   - Projection via `prepare_user_batch_projection` (TRUNCATE batch + insert).
   - Lancement Algolia Data Ingestion Task (ID `ad1fe1bb-a666-4701-b392-944dec2e1326`).
   - Finalisation via `finalize_user_import` (overlays INSERT-only, pas de cleanup en fin de flux).

## Détails techniques
### Nettoyage au démarrage
- Fonction RPC `reset_user_import_tables()` (PL/pgSQL, security definer) — garantit un état propre.
- Edge appelle la RPC; si une erreur survient, le flux s'arrête avec 500.

### Staging
- Table `staging_user_imports` (text columns 1:1 avec le CSV).
- Trigger `trg_staging_force_source` force `"Source" = dataset_name` sur INSERT/UPDATE.

### Projection batch
- `prepare_user_batch_projection(p_workspace_id, p_dataset_name)`
  - `TRUNCATE user_batch_algolia` puis `INSERT` depuis `staging_user_imports`.
  - `Source` forcée à `p_dataset_name`.

### Algolia
- Appel direct à l'API Data Ingestion (region `eu`) avec la Task ID fixe.
- Credentials lus depuis les variables d'environnement Edge (`ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`).

### Overlays
- Fonction `batch_upsert_user_factor_overlays`: INSERT-only (historique non écrasé) dans `user_factor_overlays`.

## UI
- `src/pages/Import.tsx` n'affiche "Erreurs d'import" que si `importStatus === 'error'`.
- Bandeau "Indexation Algolia terminée" informatif en fin de flux.

## Tests rapides
- CSV minimal avec colonnes requises: `Nom,FE,Unité donnée d'activité,Source,Périmètre,Localisation,Date`.
- Vérifier après import:
  - `staging_user_imports` contient des lignes avec `Source = dataset_name` puis se vide lors du prochain import.
  - `user_batch_algolia` contient > 0 lignes avant l'appel Algolia.
  - Index Algolia contient les objets avec `Source = dataset_name`.
