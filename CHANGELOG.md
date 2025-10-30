# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### 2025-10-30n- **FEATURE_chatbot_improvements.md** : Améliorations majeures de l'agent documentaire: système multi-onglets, limitation 3 sources, historique conversation, prompt LLM refactorisén  - Documentation complète dans `docs/history/2025-10-30_FEATURE_chatbot_improvements.md`n

### 2025-10-30
- **🐛 HOTFIX - Sources AIB et Roundarc Floutées** : Correction de 3784 enregistrements affichés à tort comme premium
  - **AIB** : 2689 enregistrements corrigés de `paid` → `free`
  - **Roundarc** : 1095 enregistrements corrigés de `paid` → `free`
  - Cause : Incohérence entre `fe_sources.access_level` et `emission_factors_all_search.access_level`
  - Solution : Rafraîchissement des projections via `refresh_ef_all_for_source()` et synchronisation Algolia
  - **Script de prévention créé** : `scripts/check-source-consistency.sql` pour détecter automatiquement les futures incohérences
  - Documentation complète dans `docs/history/2025-10-30_HOTFIX_AIB_source_floutee.md`
  - Résumé exécutif dans `docs/history/2025-10-30_RESUME_CORRECTION_AIB_ROUNDARC.md`

### 2025-10-29
- **FEATURE_UX_AGENT_DOCUMENTAIRE.md** : Amélioration UX : Renommage 'Assistant documentaire' en 'Agent documentaire' avec nouvelle icône IA et message de bienvenue amélioré
  - Documentation complète dans `docs/history/2025-10-29_FEATURE_UX_AGENT_DOCUMENTAIRE.md`

### 2026-01-XX
- **🎨 AMÉLIORATION UI/UX - Chatbot Documentation** : Optimisation de l'interface et de l'expérience utilisateur du chatbot
  - **Largeur de la modale réduite** : Passage de `max-w-[1600px] w-[96vw]` à `max-w-5xl w-[90vw]` pour une taille plus raisonnable et une meilleure lisibilité
  - **Sources dans un accordéon** : Les sources sont maintenant dans un accordéon fermé par défaut, permettant à l'utilisateur de ne pas polluer la visibilité du chat
  - **Design des cards de sources amélioré** : 
    - Layout vertical optimisé (suppression de l'espace inutile entre le titre et le lien PDF)
    - Structure claire : titre du chunk/section (gras) → nom du document + page (texte gris) → lien PDF (aligné à gauche)
    - Meilleur espacement visuel avec `space-y-1`
  - **Titres des sources intelligents** :
    - **Titre principal** : Extraction automatique de la première ligne du chunk (titre de section)
    - **Sous-titre** : Nom du document complet
    - Nettoyage automatique des marqueurs markdown (`##`, `**`, numérotation)
    - Fallback intelligent sur les premiers caractères si pas de titre clair
    - Affichage du numéro de page si disponible
  - **Backend** :
    - Extraction intelligente du titre de section depuis `node.node.text`
    - Séparation claire entre `title` (titre du chunk) et `documentTitle` (nom du fichier)
    - Support de métadonnées enrichies pour améliorer l'affichage
  - **Fichiers modifiés** :
    - `src/components/search/LlamaCloudChatModal.tsx` : Refonte de l'affichage des sources, ajout de l'accordéon, amélioration du layout
    - `supabase/functions/llamacloud-chat-proxy/index.ts` : Extraction intelligente des titres de chunks et des métadonnées


- **🎨 UI - Restructuration du bandeau de sélection et suppression des compteurs** : Amélioration de la cohérence visuelle entre les pages de recherche et de favoris
  - **Page Recherche** (`/search`) :
    - Bandeau "Tout sélectionner" déplacé sous les boutons de vue (détaillée/tableau) pour une meilleure hiérarchie visuelle
    - Suppression du texte "x résultat(s) affiché(s)" pour un affichage plus épuré
  - **Page Favoris** (`/favoris`) :
    - Suppression du texte "x favoris affichés" pour harmoniser avec la page de recherche
  - **Cohérence** : Les deux pages suivent maintenant la même structure : boutons de vue en premier, puis bandeau de sélection
  - **Fichiers modifiés** :
    - `src/components/search/algolia/SearchResults.tsx` : Réorganisation de l'ordre des composants et suppression du compteur
    - `src/components/search/favoris/FavorisSearchResults.tsx` : Suppression du compteur et nettoyage des imports inutilisés


- **✨ AMÉLIORATION - Agent Documentaire sur la page Favoris** : Extension de l'agent documentaire à la page des favoris
  - **Fonctionnalité** : Ajout du bouton "Assistant documentaire" (icône Sparkles) dans l'accordéon des détails des favoris
  - **Comportement identique** : Même implémentation que sur la page `/search` pour garantir une expérience utilisateur cohérente
  - **Vues supportées** : Bouton disponible dans les deux modes d'affichage (détaillé et table)
  - **Localisation** : Bouton dans la section expanded (`isExpanded`) de chaque favori
  - **Pré-remplissage** : Question automatiquement pré-remplie avec le nom du produit et la source
  - **Modal** : Ouverture du modal `LlamaCloudChatModal` avec contexte (source + productName)
  - **Impact** : Les utilisateurs peuvent maintenant interroger la documentation directement depuis leurs favoris, sans retourner à la page de recherche
  - **Fichiers modifiés** :
    - `src/components/search/favoris/FavorisSearchResults.tsx` : Ajout des imports (`Sparkles`, `LlamaCloudChatModal`), état `chatConfig`, boutons dans les deux vues, et modal

### 2025-10-29
- **✨ FEATURE - Agent Documentaire IA (LlamaCloud)** : Assistant conversationnel intelligent pour interroger la documentation des méthodologies carbone
  - **Backend** :
    - Edge Function `llamacloud-chat-proxy` : Proxy sécurisé pour LlamaCloud API avec gestion des quotas et streaming
    - Edge Function `get-my-chatbot-quota` : Récupération des quotas utilisateur pour l'agent documentaire
    - Intégration LlamaCloud pour parsing et indexation des PDFs de méthodologies (Base Carbone, BEIS)
    - Retrieval API avec filtrage strict par source (metadata `source`)
    - Génération de réponses avec OpenAI GPT-4o-mini
    - Support multi-modal : texte, sources, screenshots, formulas LaTeX
  - **Frontend** :
    - Composant `LlamaCloudChatModal` : Interface de chat moderne avec streaming en temps réel
    - Hook custom `useSimpleChat` : Gestion du chat sans dépendances externes
    - Bouton "Assistant documentaire" (icône Sparkles) dans l'accordéon des détails des résultats de recherche
    - Pré-remplissage intelligent de la question avec produit et source
    - Affichage des sources citées avec liens cliquables vers les PDFs (avec ancrage de page)
    - Support LaTeX via `remark-math` et `rehype-katex`
    - Affichage des screenshots et graphiques extraits des PDFs
  - **Quotas** :
    - Consolidation dans la table `search_quotas` (suppression de `chatbot_usage`)
    - Freemium : 3 requêtes lifetime
    - Pro : 50 requêtes par mois
    - Affichage en temps réel dans le modal et la navbar (format `X / Y`)
    - Message d'erreur user-friendly en cas de dépassement de quota
    - Triggers automatiques pour remplir `user_email` et `workspace_name` dans `search_quotas`
  - **UX** :
    - Modal élargie : `max-w-[1600px]` et `w-[96vw]`
    - Widget quota navbar élargi : `w-80` avec icône Sparkles
    - Couleurs harmonisées avec la page de recherche (blanc/gris)
    - Invalidation automatique du cache React Query après chaque requête
    - Filtrage strict par source : seuls les résultats de la source sélectionnée sont affichés
    - Contrôle de la langue de réponse (FR/EN) basé sur la langue de l'application
  - **Technique** :
    - Migrations : `add_chatbot_columns_to_search_quotas`, `add_user_info_to_search_quotas`, `add_trigger_populate_user_info`
    - Suppression des dépendances inutilisées : `@assistant-ui/react`, `@ai-sdk/react`, `@ai-sdk/openai`, `@llamaindex/vercel`
    - Code 100% custom sans dépendances lourdes (réduction du bundle)
    - Configuration LlamaCloud : Pipeline ID, Organization ID, API Key stockés dans Supabase Secrets
    - Parsing options : `take_screenshot`, `extract_charts`, `extract_layout`, `annotate_links`
  - **Impact** : Nouvelle feature premium pour interroger intelligemment les méthodologies carbone avec RAG avancé et support multi-modal

### 2025-10-24n- **FEATURE_2025-10-24_benchmark_title_edition_inline.md** : FEATURE: Édition inline du titre des benchmarks avec tooltip intelligentn  - Documentation complète dans `docs/history/2025-10-24_FEATURE_2025-10-24_benchmark_title_edition_inline.md`n

### 2025-10-24n- **FIX_benchmark_date_range_period_2025-10-23.md** : FIX: Période du benchmark avec filtrage de date uniquen  - Documentation complète dans `docs/history/2025-10-24_FIX_benchmark_date_range_period_2025-10-23.md`n

### 2025-10-24
- **✨ FEAT - Génération Benchmark sans recherche (filtres uniquement)** : Permet de générer un benchmark avec uniquement des filtres Périmètre + Unité
  - **Frontend** : Bouton "Générer un benchmark" actif si recherche OU filtres actifs (≥5 FE)
  - **Backend** : Edge Function accepte `query` vide si des filtres sont fournis
  - **Hook** : `useBenchmarkGeneration` s'active avec `hasQueryOrFilters` (query OU filters)
  - **Validation** : Vérification query OU filtres à tous les niveaux (bouton, page, hook)
  - **Fix redirection** : Suppression du useEffect redondant qui redirigeait vers `/benchmark` sans vérifier les filtres
  - **Fix condition** : Ajout de `currentWorkspace.id` dans la `queryKey` pour réactivation automatique du hook
  - **Titre benchmark** : Affiche "Filtres uniquement" si pas de query
  - **Version Edge Function** : v1.1.1 (v34)
  - **Minimum FE** : 5 FE requis (au lieu de 10) pour génération avec filtres uniquement
  - Impact : Flexibilité accrue, génération benchmark possible même sans recherche textuelle

### 2025-10-23n- **FIX_benchmark_date_range_period_2025-10-23.md** : Fix période du benchmark (champ Publication fantôme)n  - Documentation complète dans `docs/history/2025-10-23_FIX_benchmark_date_range_period_2025-10-23.md`n

### 2025-10-23n- **HOTFIX_2025-10-23_jwt_edge_functions_config.md** : Hotfix JWT authentication error 401 sur generate-benchmark (config verify_jwt manquante)n  - Documentation complète dans `docs/history/2025-10-23_HOTFIX_2025-10-23_jwt_edge_functions_config.md`n

### 2025-10-23
- **🐛 HOTFIX CRITIQUE - JWT Authentication Edge Functions** : Résolution erreur 401 "Invalid JWT" sur generate-benchmark
  - **Cause racine** : Configuration manquante `verify_jwt = false` dans `supabase/config.toml`
  - **Symptôme** : Supabase Edge Runtime rejetait les requêtes AVANT l'exécution du code (aucun log custom généré)
  - **Solution** : Ajout de `verify_jwt = false` pour `generate-benchmark` et `algolia-search-proxy`
  - **Pattern robuste** : Validation JWT manuelle dans le code pour supporter ES256 (comme admin functions)
  - **Version Edge Function** : v1.0.9 (avec logs de debug complets)
  - **⚠️ IMPORTANT** : Toute nouvelle Edge Function nécessitant auth doit avoir `verify_jwt = false` + validation manuelle
  - **Impact** : Feature Benchmark de nouveau opérationnelle, génération de benchmarks restaurée

### 2025-10-23
- **🐛 FIX - 5 corrections critiques Benchmark** : Correction de bugs impactant l'affichage et la validation des benchmarks
  - Fix #1 : Logique d'affichage 25/50 FE garantissant que min/max soient toujours identiques entre les deux vues
  - Fix #2 : Affichage unité complète dans tooltip (kgCO2eq/unité au lieu de juste l'unité)
  - Fix #3 : Réduction minimum FE requis de 10 à 5 pour permettre benchmarks sur datasets restreints
  - Fix #4 : Warning sauvegarde fonctionnel pour TOUTES navigations (navbar, retour navigateur, fermeture)
  - Fix #5 : Style liens Markdown corrigé (bleu souligné) pour meilleure lisibilité
  - Impact : Cohérence données, accessibilité élargie, protection anti-perte de données, UX améliorée

- **✨ FEAT - 5 améliorations UX Benchmark** : Amélioration de l'expérience utilisateur sur la feature Benchmark
  - Ajout du champ "Localisation" dans le tooltip du graphique et colonne dans Top10/Worst10
  - Amélioration du style Markdown : liens bleus cliquables, gras fonctionnel
  - Ouverture du benchmark dans un nouvel onglet pour faciliter les ajustements
  - Suppression de l'Object ID des fiches FE (UI plus épurée)
  - Impact : Meilleure visibilité des données, workflow amélioré, interface simplifiée

- **🐛 FIX - Corrections bugs Cursor BugBot (PRs #137/#138)** : Correction de 3 bugs remontés par Cursor BugBot
  - Bug #2 : Nettoyage des entrées dupliquées dans `docs/history/INDEX.md` (sections 2025-10-23 répétées 5 fois)
  - Bug #5 : Désactivation du bouton "Partager" si benchmark non sauvegardé sans searchParams valides
  - Bug #8 : Redirection automatique vers `/search` si accès à `/benchmark/view` sans query params
  - Ajout traductions FR/EN pour message d'erreur de partage
  - Amélioration UX : prévention des URLs invalides et pages vides

- **🐛 FIX - ESLint errors dans composants Benchmark** : Correction de 8+ erreurs critiques détectées par Cursor BugBot
  - Remplacement de tous les types `any` par des interfaces typées
  - Correction de 6 erreurs `no-case-declarations` dans `BenchmarkValidationAlert.tsx`
  - Typage strict des `filters` : `Record<string, string | number | boolean>`
  - Changement `let query` → `const query` dans `FilterPanel.tsx`
  - Commit : `eff1b3b5`

- **AMELIORATIONS_BENCHMARK_UI_2025-10-23.md** : Améliorations UI/UX Benchmark : 13 améliorations majeures incluant coloration Q1/Q3, formatage dynamique, support Markdown, et réorganisation des contrôles
  - Documentation complète dans `docs/history/2025-10-23_AMELIORATIONS_BENCHMARK_UI_2025-10-23.md`
- **🐛 HOTFIX - Fix import espaces Unicode** : Correction erreur `"invalid input syntax for type numeric: \"2 051\""` lors import Dataiku
  - Problème : Espaces fines insécables (U+202F) dans le champ FE empêchaient la conversion en numeric
  - Solution : Remplacement du SQL dynamique (EXECUTE) par CREATE TEMPORARY TABLE direct pour échappement regex correct
  - Migration : `20251023_fix_fe_whitespace_in_dynamic_sql.sql`
  - Documentation : `docs/history/2025-10-23_HOTFIX_2025-10-23_fix_import_unicode_whitespace.md`

- **🐛 HOTFIX - Limite Algolia 10KB** : Suppression commentaires pour 316 records BEIS dépassant la limite Algolia
  - 316 records de source BEIS avec commentaires très longs (~5 000 caractères)
  - Sauvegarde dans `backup_oversized_comments` puis suppression des champs Commentaires_fr/en
  - Résultat : Taille max passée de 10.59 KB à 7.95 KB (0 records > 10KB)
  - Documentation : `docs/history/2025-10-23_HOTFIX_2025-10-23_algolia_10kb_limit.md`

---

## [1.6.2] - 2025-10-22

### 🔒 Sécurité - CRITIQUE
- **Edge Function `generate-benchmark`** : Fix vulnérabilité workspace ownership (v1.0.3 → v1.0.4)
  - Ajout validation que l'utilisateur appartient au workspace avant génération
  - Retour `403 Forbidden` pour accès non autorisé
  - Protection contre consommation de quotas d'autres workspaces
  - **Impact** : Tout utilisateur authentifié pouvait générer des benchmarks pour n'importe quel workspace (détecté par bugbot, aucune exploitation constatée)
  - Documentation : `docs/hotfix/2025-10-22-security-fix-workspace-validation.md`

---

## [1.6.1] - 2025-10-22

### Amélioré
- **Validation pré-navigation pour Benchmark** : Détection des FEs inaccessibles (floutés/verrouillés) directement sur `/search`
  - Nouveau code d'erreur `INSUFFICIENT_ACCESSIBLE_DATA` dans `useBenchmarkValidation`
  - Alerte contextuelle empêchant la navigation inutile vers une page d'erreur
  - Filtrage intelligent basé sur `variant`, `is_blurred`, et `access_level`
  - Messages clairs avec compteur de FEs accessibles vs total
- **UI BenchmarkHeader** : Gestion du débordement du titre long
  - Troncature avec ellipses (`...`) pour les titres trop longs
  - Tooltip natif au survol pour afficher le titre complet
  - Boutons d'action toujours visibles (flex-shrink-0)

### Corrigé
- **Edge Function `generate-benchmark`** : Boot error résolu
  - Restauration de l'authentification native Supabase (`supabaseAuth.auth.getUser()`)
  - Suppression du décodage JWT manuel complexe avec `atob()`
  - Simplification de la validation utilisateur
- **Linter** : Correction de toutes les erreurs TypeScript dans l'Edge Function
  - Ajout de `@ts-nocheck` pour le runtime Deno
  - Type explicite `warnings: string[]`
  - Création de `deno.json` pour configuration TypeScript

### Technique
- Edge Function version `1.0.3`
- 0 erreur de lint dans le projet
- Cohérence validation frontend ↔ backend (minimum 10 FEs accessibles)

---

## [1.6.0] - 2025-10-22

### Ajouté
- **Feature Benchmark complète** : Génération d'analyses statistiques des facteurs d'émission
  - 17 composants React (graphiques, statistiques, tables, exports)
  - Edge Function `generate-benchmark` avec validation stricte
  - Export PDF haute qualité et PNG
  - Sauvegarde et partage des benchmarks au sein du workspace
  - Quotas : 3 benchmarks pour Freemium, illimité pour Pro
  - Documentation complète dans `docs/features/benchmark-feature.md`
- Intégration complète du bouton "Générer un benchmark" sur la page `/search`
- Extension du `NavbarQuotaWidget` pour afficher les quotas benchmarks
- Routes `/benchmark` et `/benchmark/:id`

### Détails techniques
- Table PostgreSQL `benchmarks` avec RLS
- Migration `20251022092500_create_benchmarks_table.sql`
- 100+ clés de traduction FR/EN dans le namespace `benchmark`
- Voir `IMPLEMENTATION_COMPLETE.md` et `BENCHMARK_COMPONENTS_STATUS.md` pour plus de détails

---

## [1.5.2] - 2025-10-20

### Corrigé
- **Hotfix critique** : Filtre "Private" (Base personnelle) retournait 0 résultats
  - Correction de la syntaxe Algolia dans l'Edge Function `algolia-search-proxy` (v132)
  - Migration de `filters` vers `facetFilters` pour le champ `workspace_id`
  - 117 records privés désormais accessibles correctement
  - Documentation dans `HOTFIX_FILTRE_PRIVATE_ALGOLIA_20251020.md`
- **Optimisation Base de Données** : Suppression du webhook HTTP obsolète
  - Migration `20251020_remove_obsolete_fe_sources_webhook_trigger_v2.sql`
  - Performance UPDATE sur `fe_sources` : 19ms → 0.7ms (-96.3%, 27x plus rapide)
  - Détails dans `OPTIMISATIONS_OPTIONNELLES_PROPOSITIONS.md`
- **Configuration autovacuum** : Maintenance améliorée pour les petites tables
  - Migration `20251020_configure_aggressive_autovacuum.sql`
  - Tables `user_roles`, `favorites`, `workspaces` avec seuil agressif (5 dead rows)

### Amélioré
- Corrections des Security Advisors (+91% de sécurité)
- Rapport complet dans `RAPPORT_CORRECTIONS_ADVISORS_20251020.md`

---

## [1.5.1] - 2025-10-16

### Ajouté
- **Migration des champs de score Algolia** :
  - 4 nouveaux champs : `localization_score`, `perimeter_score`, `base_score`, `unit_score`
  - Migration `20251015_add_algolia_score_fields.sql`
  - Index partiels pour optimiser les performances
  - Détails dans `MIGRATION_SCORES_ALGOLIA_20251015.md`
- Edge Function `algolia-search-proxy` : Correctifs JWT et authentification
  - Détails dans `docs/hotfix/2025-10-20-fix-edge-function-jwt-auth.md`

### Corrigé
- Problèmes de blur sur facets Algolia
  - Hotfix v131 documenté dans `docs/hotfix/2025-10-20-fix-algolia-facets-blur-v131.md`
- Highlighting Algolia
  - Hotfix v118 documenté dans `docs/hotfix/2025-10-20-fix-algolia-highlighting-v118.md`

---

## [1.5.0] - 2025-10-16

### Ajouté
- **Optimisation React Query complète** : Réduction drastique des requêtes réseau
  - Migration de tous les hooks vers React Query (`useQuotas`, `useEmissionFactorAccess`, `useSupraAdmin`, etc.)
  - Configuration centralisée dans `src/lib/queryClient.ts`
  - Query keys organisées dans `src/lib/queryKeys.ts`
  - React Query DevTools intégrées (mode développement)

### Amélioré
- **Performance réseau** : -83% de requêtes (150 → 25)
  - `search_quotas` GET : 32+ → 1 requête (-97%)
  - `fe_sources` GET : 19+ → 1 requête (-95%)
  - `fe_source_workspace_assignments` GET : 18+ → 1 requête (-94%)
  - `is_supra_admin` RPC : 10+ → 1 requête (-90%)
  - `search_quotas` POST : 19+ → 1-2 requêtes (-90%)
- **Temps de chargement** : 3-5s → 1-2s (-60%)
- **Debounce** : 5 secondes sur `useQuotaSync` pour réduire les écritures en base
- **Realtime** : Circuit breaker pattern pour éviter les tentatives infinies de reconnexion
- Cache intelligent selon le type de données (30s à 24h selon la volatilité)

### Documentation
- Rapport complet dans `OPTIMISATION_REACT_QUERY_COMPLETE.md`
- Changelog détaillé dans `CHANGELOG_REACT_QUERY.md`
- Guide de tests dans `GUIDE_TEST_VISUEL.md`
- Résumé exécutif dans `MIGRATION_SUMMARY.md`

---

## [1.4.1] - 2025-10-16

### Corrigé
- **Erreurs Realtime** : Circuit breaker ajouté dans `useOptimizedRealtime`
  - Maximum 3 tentatives de reconnexion
  - Changement de `private: true` → `private: false` pour les canaux
  - Documentation dans `CORRECTIONS_REALTIME_ET_QUOTAS.md`
- **Optimisation des requêtes** `search_quotas` :
  - `staleTime` : 30s → 60s
  - `gcTime` : 60s → 10min

---

## [1.4.0] - 2025-10-16

### Ajouté
- **Analyse réseau post-optimisation React Query**
  - Audit détaillé des duplications de requêtes
  - Identification des problèmes Realtime
  - 32+ appels dupliqués sur `search_quotas` détectés
  - Documentation dans `AUDIT_RESEAU_MANGUE_20241016.md` et `ANALYSE_RESEAU_POST_OPTIMISATION.md`

---

## [1.3.0] - 2025-10-15

### Ajouté
- **Nettoyage de la codebase** : Suppression de ~80+ fichiers obsolètes
  - Documentation de session et rapports temporaires
  - Backups et logs historiques
  - Scripts de diagnostic temporaires
  - Détails dans `NETTOYAGE_LEGACY_20251015.md`

---

## [1.2.0] - 2025-10-15

### Ajouté
- **Comparatif complet des solutions Vector DB** (Octobre 2025)
  - Analyse Pinecone vs Qdrant vs pgvector
  - Verdict : Supabase pgvector reste la solution optimale
  - Documentation dans `COMPARATIF_VECTOR_DB_OCT2025.md`

---

## [1.1.0] - 2025-10-15

### Ajouté
- Migration des champs de score Algolia
- Task ID Algolia mis à jour : `55278ecb-f8dc-43d8-8fe6-aff7057b69d0`

---

## [1.0.0] - 2025-10-XX

### Initial
- Architecture initiale de l'application
- Système de recherche Algolia
- Gestion des utilisateurs et workspaces
- Système de quotas et permissions
- Intégration Supabase (Auth, DB, Storage, Edge Functions)

---

## Format des entrées

Ce changelog suit les conventions suivantes :

### Sections
- **Ajouté** : Nouvelles fonctionnalités
- **Modifié** : Changements dans les fonctionnalités existantes
- **Déprécié** : Fonctionnalités bientôt supprimées
- **Supprimé** : Fonctionnalités supprimées
- **Corrigé** : Corrections de bugs
- **Sécurité** : Corrections de vulnérabilités

### Références
Pour plus de détails sur chaque changement, consultez :
- Les fichiers de documentation dans `docs/`
- Les rapports d'historique dans `docs/history/`
- Les migrations dans `supabase/migrations/`
- Le fichier `docs/history/INDEX.md` pour une vue chronologique complète

---

**Légende des versions**
- Format : `[MAJEUR.MINEUR.CORRECTIF]`
- MAJEUR : Changements incompatibles avec les versions précédentes
- MINEUR : Ajout de fonctionnalités rétro-compatibles
- CORRECTIF : Corrections de bugs rétro-compatibles


