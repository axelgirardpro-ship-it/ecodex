# Migration : Simplification des Plans et Renommage des Niveaux d'Accès

**Date** : 3 octobre 2025  
**Auteur** : Migration automatique  
**Type** : Breaking Change - Simplification de l'architecture  

## 🎯 Objectif

Simplifier et clarifier la structure des plans workspaces et des niveaux d'accès aux sources de données pour améliorer la cohérence du produit et réduire la confusion.

## 📊 Changements Principaux

### Plans Workspace

#### Avant
- **Freemium** : Plan gratuit avec limites
- **Standard** : Plan intermédiaire payant
- **Premium** : Plan payant complet

#### Après
- **Freemium** : Plan gratuit avec limites (10 exports, 10 copies, 10 favoris)
- **Pro** : Plan payant avec accès illimité (1000 exports, 1000 copies, favoris illimités)

**Migration automatique** :
- Tous les workspaces `standard` → `pro`
- Tous les workspaces `premium` → `pro`

### Niveaux d'Accès aux Sources

#### Avant
- **Standard** : Sources accessibles à tous
- **Premium** : Sources nécessitant une assignation

#### Après
- **Gratuit (free)** : Sources accessibles à tous
- **Payant (paid)** : Sources nécessitant une assignation manuelle

**Migration automatique** :
- Toutes les sources `standard` → `free`
- Toutes les sources `premium` → `paid`

## 🗄️ Modifications Base de Données

### Migration SQL : `20251003_simplify_plans_rename_sources.sql`

#### 1. Plans Workspace (`workspaces` table)
```sql
-- Mise à jour des plans
UPDATE public.workspaces 
SET plan_type = 'pro', updated_at = now() 
WHERE plan_type IN ('standard', 'premium');

-- Nouvelle contrainte
ALTER TABLE public.workspaces 
DROP CONSTRAINT IF EXISTS workspaces_plan_type_check;

ALTER TABLE public.workspaces 
ADD CONSTRAINT workspaces_plan_type_check 
CHECK (plan_type IN ('freemium', 'pro'));
```

#### 2. Quotas (`search_quotas` table)
```sql
-- Quotas Pro (anciens Standard et Premium)
UPDATE public.search_quotas sq
SET 
  exports_limit = 1000,
  clipboard_copies_limit = 1000,
  favorites_limit = NULL,
  updated_at = now()
FROM public.users u
JOIN public.workspaces w ON w.id = u.workspace_id
WHERE sq.user_id = u.user_id AND w.plan_type = 'pro';

-- Quotas Freemium
UPDATE public.search_quotas sq
SET 
  exports_limit = 10,
  clipboard_copies_limit = 10,
  favorites_limit = 10,
  updated_at = now()
FROM public.users u
JOIN public.workspaces w ON w.id = u.workspace_id
WHERE sq.user_id = u.user_id AND w.plan_type = 'freemium';
```

#### 3. Sources (`fe_sources` et `emission_factors_all_search`)
```sql
-- fe_sources
UPDATE public.fe_sources 
SET access_level = 'free', updated_at = now() 
WHERE access_level = 'standard';

UPDATE public.fe_sources 
SET access_level = 'paid', updated_at = now() 
WHERE access_level = 'premium';

-- emission_factors_all_search
UPDATE public.emission_factors_all_search 
SET access_level = 'free' 
WHERE access_level = 'standard';

UPDATE public.emission_factors_all_search 
SET access_level = 'paid' 
WHERE access_level = 'premium';
```

#### 4. Fonctions SQL Mises à Jour
- `get_user_workspace_plan()` : Gère les nouveaux types de plans
- `workspace_has_access()` : Simplifié pour `freemium` et `pro`

#### 5. Politiques RLS Simplifiées
- Politique `emission_factors` : Simplifiée pour gérer `free` et `paid`

## 🔧 Modifications Backend

### Edge Function : `update-user-plan-role`

**Fichier** : `supabase/functions/update-user-plan-role/index.ts`

```typescript
interface UpdateRequest {
  newPlan?: 'freemium' | 'pro'; // Was: 'freemium' | 'standard' | 'premium'
}

// Quotas
switch (newPlan) {
  case 'freemium':
    quotaUpdates = { 
      exports_limit: 10, 
      clipboard_copies_limit: 10, 
      favorites_limit: 10 
    }
    break
  case 'pro':
    quotaUpdates = { 
      exports_limit: 1000, 
      clipboard_copies_limit: 1000, 
      favorites_limit: null 
    }
    break
}
```

## 🎨 Modifications Frontend

### Types TypeScript

**Fichier** : `src/types/source.ts`
```typescript
export type SourceAccessLevel = 'free' | 'paid';

export interface FeSource {
  source_name: string;
  access_level: SourceAccessLevel;
  // ...
}
```

### Hooks Principaux

#### `useQuotaSync.ts`
```typescript
export type PlanType = 'freemium' | 'pro';

const PLAN_QUOTA_RULES: Record<PlanType, PlanQuotaRules> = {
  freemium: { 
    exports_limit: 10, 
    clipboard_copies_limit: 10, 
    favorites_limit: 10 
  },
  pro: { 
    exports_limit: 1000, 
    clipboard_copies_limit: 1000, 
    favorites_limit: null 
  },
};
```

#### `usePermissions.ts`
```typescript
const isPro = planType === 'pro';
const canImportData = isSupraAdmin || (isPro && userProfile?.role === 'admin');
```

#### `useEmissionFactorAccess.ts`
```typescript
const [freeSources, setFreeSources] = useState<string[]>([]);

const shouldBlurPaidContent = useCallback((source: string) => {
  return !assignedSources.includes(source);
}, [assignedSources]);
```

### Composants Admin

#### `EmissionFactorAccessManager.tsx`
- Labels : "Standard" → "Gratuit", "Premium" → "Payant"
- Logique de badges mise à jour
- Interface de gestion des niveaux d'accès

#### Tables Admin
- `CompaniesTable.tsx` : Dropdown "Freemium / Pro"
- `ContactsTable.tsx` : Dropdown "Freemium / Pro"
- `FreemiumCompaniesTable.tsx` : Dropdown "Freemium / Pro"
- `WorkspacesTable.tsx` : Type `'freemium'|'pro'`

### Composants UI

#### `NavbarQuotaWidget.tsx`
```typescript
const isPro = planType === 'pro';

const getPlanLabel = () => {
  if (planType === 'pro') return 'Pro';
  return 'Freemium';
};
```

**Fix bug** : Ajout de `type="button"` et `e.preventDefault()` pour éviter le refresh de page.

#### `PremiumBlur.tsx` → `PaidBlur.tsx`
- Fichier renommé
- Interface `isPaidContent` (était `isPremiumContent`)
- Badge "Source Payante" (était "Source Premium")

#### `QuotaWidget.tsx`
- Logique simplifiée pour `pro` et `freemium`
- Suppression des références à `standard`

### Pages

#### `Index.tsx`
- Tabs datasets : `"free"` et `"paid"` (était `"standards"` et `"premium"`)
- Plans pricing : `["freemium", "pro"]` (était `["standard", "premium"]`)

#### `Import.tsx`
- Niveau d'accès par défaut : `'free'` (était `'standard'`)

### Filtres Algolia

**Fichier** : `src/lib/algolia/searchClient.ts`

```typescript
// Avant
const base = '(access_level:standard)';

// Après
const base = '(access_level:free)';
```

Commentaires mis à jour : "premium" → "paid", "standard" → "free"

### Contextes

#### `FeSourcesContext.tsx`
```typescript
export interface FeSource { 
  source_name: string; 
  access_level: 'free'|'paid' 
}
```

### Traductions i18n

#### FR & EN : `quota.json`
```json
{
  "plan": {
    "pro": "Pro",
    "freemium": "Freemium"
  },
  "favorites": {
    "pro_only": "Pro"
  },
  "widget": {
    "pro": {
      "badge_pro": "Pro",
      "description_unlimited": "Illimité"
    }
  }
}
```

#### FR & EN : `navbar.json`
```json
{
  "favorites_locked": "Fonctionnalité disponible uniquement avec le plan Pro",
  "import_locked": "Réservé aux workspaces Pro"
}
```

#### FR & EN : `search.json`
```json
{
  "feature_pro_favorites": "Fonctionnalité disponible uniquement avec le plan Pro"
}
```

#### FR & EN : `pages.json`
```json
{
  "datasetsSection": {
    "tabs": [
      { "id": "free", "label": "Datasets gratuits" },
      { "id": "paid", "label": "Datasets payants" }
    ]
  },
  "pricing": {
    "plans": {
      "freemium": { "name": "Freemium", "price": "0€" },
      "pro": { "name": "Pro", "price": "3000€" }
    }
  }
}
```

## 🔄 Impacts Métier

### Pour les Utilisateurs Existants

#### Workspaces Standard
- ✅ Automatiquement upgradés vers Pro
- ✅ Quotas augmentés : 1000 exports, 1000 copies
- ✅ Favoris illimités

#### Workspaces Premium
- ➡️ Renommés en Pro (pas de changement fonctionnel)
- ✅ Toutes les fonctionnalités conservées

#### Workspaces Freemium
- ➡️ Aucun changement
- ✅ Limites maintenues : 10/10/10

### Pour les Sources de Données

#### Sources Standard
- ➡️ Renommées "Gratuit"
- ✅ Toujours accessibles à tous les workspaces
- ✅ Aucun changement fonctionnel

#### Sources Premium
- ➡️ Renommées "Payant"
- ✅ Assignation manuelle toujours requise
- ✅ Logique de floutage préservée

## 🧪 Tests & Validation

### Tests Backend
- [x] Migration SQL exécutée sans erreur
- [x] Contraintes de table mises à jour
- [x] Fonctions SQL testées
- [x] Politiques RLS validées

### Tests Frontend
- [x] Compilation TypeScript sans erreur
- [x] Pas d'erreurs ESLint
- [x] Widget quota s'ouvre correctement
- [x] Dropdowns admin affichent les bons plans
- [x] Traductions FR/EN fonctionnelles

### Tests Fonctionnels
- [x] Filtrage Algolia avec nouveaux niveaux
- [x] Floutage des sources payantes
- [x] Assignation manuelle des sources
- [x] Quotas appliqués correctement
- [x] Favoris disponibles pour Pro uniquement

## 📦 Fichiers Modifiés

### Backend
- `supabase/migrations/20251003_simplify_plans_rename_sources.sql` (nouveau)
- `supabase/functions/update-user-plan-role/index.ts`

### Frontend - Types
- `src/types/source.ts` (nouveau)

### Frontend - Hooks
- `src/hooks/useQuotaSync.ts`
- `src/hooks/usePermissions.ts`
- `src/hooks/useEmissionFactorAccess.ts`
- `src/hooks/useQuotas.ts`

### Frontend - Composants Admin
- `src/components/admin/EmissionFactorAccessManager.tsx`
- `src/components/admin/AdminImportsPanel.tsx`
- `src/components/admin/SourceWorkspaceAssignments.tsx`
- `src/components/admin/CompaniesTable.tsx`
- `src/components/admin/ContactsTable.tsx`
- `src/components/admin/FreemiumCompaniesTable.tsx`
- `src/components/admin/WorkspacesTable.tsx`

### Frontend - Composants UI
- `src/components/ui/NavbarQuotaWidget.tsx`
- `src/components/ui/QuotaWidget.tsx`
- `src/components/ui/PremiumBlur.tsx` → `src/components/ui/PaidBlur.tsx`
- `src/components/ui/UpgradeButton.tsx`

### Frontend - Composants Search
- `src/components/search/ResultsTable.tsx`
- `src/components/search/favoris/FavorisSearchResults.tsx`
- `src/components/search/algolia/SearchResults.tsx`
- `src/components/search/algolia/SearchFilters.tsx`

### Frontend - Pages
- `src/pages/Index.tsx`
- `src/pages/Import.tsx`

### Frontend - Lib
- `src/lib/algolia/searchClient.ts`
- `src/lib/adminApi.ts`

### Frontend - Contextes
- `src/contexts/FeSourcesContext.tsx`

### Frontend - Traductions
- `src/locales/fr/quota.json`
- `src/locales/fr/search.json`
- `src/locales/fr/navbar.json`
- `src/locales/fr/pages.json`
- `src/locales/en/quota.json`
- `src/locales/en/search.json`
- `src/locales/en/navbar.json`
- `src/locales/en/pages.json`

## 🚀 Déploiement

### Prérequis
1. Backup de la base de données
2. Vérification des workspaces actifs
3. Communication aux utilisateurs

### Étapes
1. ✅ Créer la migration SQL
2. ✅ Appliquer la migration en production
3. ✅ Déployer l'Edge Function mise à jour
4. ✅ Déployer le frontend
5. ✅ Réindexer Algolia avec nouveaux niveaux d'accès

### Rollback
En cas de problème, une migration de rollback est disponible pour restaurer :
- Plans `pro` → `standard` ou `premium` (selon historique)
- Niveaux `free` → `standard`, `paid` → `premium`

## 🐛 Bugs Corrigés

### Bug : Widget Quota Refresh Page
**Problème** : Cliquer sur le widget quota provoquait un refresh de la page.

**Cause** : Bouton sans `type="button"` traité comme `type="submit"`.

**Solution** :
```typescript
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  }}
>
```

## 📈 Métriques de Migration

- **Workspaces migrés** : Tous (freemium inchangés, standard+premium → pro)
- **Sources migrées** : Toutes (standard → free, premium → paid)
- **Quotas mis à jour** : Tous les utilisateurs Pro
- **Traductions** : 8 fichiers (FR + EN)
- **Composants** : 25+ fichiers modifiés
- **Breaking changes** : Oui (noms de plans et niveaux)

## ✅ Checklist Post-Migration

- [x] Migration SQL appliquée
- [x] Edge Functions déployées
- [x] Frontend compilé et déployé
- [x] Traductions validées
- [x] Tests fonctionnels passés
- [x] Documentation créée
- [x] Monitoring activé

## 📝 Notes

Cette migration simplifie grandement l'architecture du produit en réduisant de 3 à 2 le nombre de plans, ce qui améliore :
- La clarté pour les utilisateurs
- La maintenance du code
- La cohérence de la facturation
- La compréhension des niveaux d'accès

Les anciens plans Standard ont été upgradés vers Pro pour offrir une meilleure valeur aux clients existants.

