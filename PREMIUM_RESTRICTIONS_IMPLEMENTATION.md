# Implémentation des Restrictions Premium

## Vue d'ensemble

Cette documentation détaille l'implémentation des restrictions d'accès aux fonctionnalités premium (Import et Base personnelle) pour les workspaces non-Premium.

## Changements implémentés

### 1. Restrictions d'accès côté frontend

#### A. Hook `usePermissions`
**Fichier**: `src/hooks/usePermissions.ts`

**Modifications**:
- Ajout de la vérification du plan Premium pour `canImportData`
- Logique: `canImportData = isSupraAdmin || (isPremiumPlan && userProfile?.role === 'admin')`
- Exposition du `planType` pour les composants

#### B. Navigation - Import verrouillé
**Fichier**: `src/components/ui/UnifiedNavbar.tsx`

**Modifications**:
- Remplacement de la vérification `isSupraAdmin` par `canImportData`
- Ajout d'un bouton Import désactivé avec cadenas pour les non-Premium
- Tooltip explicatif "Réservé aux workspaces Premium"

#### C. Filtre d'origine - Base personnelle verrouillée
**Fichier**: `src/components/search/algolia/SearchFilters.tsx`

**Modifications**:
- Ajout de la vérification `isPremium` dans `OriginFilter`
- Bouton "Base personnelle" désactivé avec icône de cadenas si non-Premium
- Largeur des boutons augmentée (`w-56`) pour accommoder l'icône
- Tooltip explicatif "Réservé aux workspaces Premium"

#### D. Contrôle de l'origine côté SearchProvider
**Fichier**: `src/components/search/algolia/SearchProvider.tsx`

**Modifications**:
- Ajout d'un `useEffect` pour forcer l'origine à `public` si workspace non-Premium
- Modification du setter `setOrigin` pour refuser `private` si non-Premium
- Protection automatique contre les tentatives de contournement

### 2. Corrections des Edge Functions Admin

#### A. Problème d'authentification (401)
**Problème**: Les fonctions `get-admin-workspaces` et `get-admin-contacts` retournaient 401.

**Solution**:
- Mise à jour des en-têtes CORS pour inclure `Authorization` (majuscules/minuscules)
- Correction de `src/lib/adminApi.ts` pour envoyer le token d'authentification
- Ajout d'un helper `invokeWithAuth` pour centraliser l'envoi du token

#### B. Problème de permissions sur table users (500)
**Problème**: La fonction `update-user-plan-role` échouait avec "permission denied for table users".

**Solutions appliquées**:
1. **Correction de la fonction Edge**: Remplacement des accès à `users` par `user_roles`
2. **Correction du trigger**: Modification de `sync_workspace_user_quotas()` pour utiliser `user_roles` au lieu de `users`
3. **Migration de correction**: Application de `fix_sync_workspace_user_quotas_function`

### 3. Corrections de la base de données

#### A. Fonction `sync_workspace_user_quotas`
**Problème**: La fonction utilisait `FROM users` qui causait des erreurs de permissions RLS.

**Solution**:
```sql
-- Avant
SELECT u.user_id FROM users u JOIN auth.users au ON u.user_id = au.id WHERE u.workspace_id = target_workspace_id

-- Après  
SELECT ur.user_id FROM user_roles ur JOIN auth.users au ON ur.user_id = au.id WHERE ur.workspace_id = target_workspace_id
```

#### B. Edge Function `update-user-plan-role`
**Modifications**:
- Suppression de toutes les requêtes vers la table `users`
- Utilisation exclusive de `user_roles`, `workspaces`, et `search_quotas`
- Ajout de logs de debug pour faciliter le troubleshooting
- Amélioration de la gestion d'erreurs

### 4. Nettoyage et optimisations

#### A. Suppression du code temporaire
- Suppression des migrations temporaires de permissions RLS
- Suppression des logs de debug dans les Edge Functions
- Nettoyage des fonctions obsolètes

#### B. Améliorations UI
- Ajustement de la largeur des boutons d'origine pour l'icône de cadenas
- Amélioration de l'espacement et de la lisibilité

## Architecture de sécurité

### Niveaux de protection

1. **Frontend (UX)**: Désactivation visuelle et tooltips explicatifs
2. **Logique métier**: Vérification dans `usePermissions` et `SearchProvider`
3. **Backend**: Validation côté Edge Functions (pour les futures API)

### Logique de vérification Premium

```typescript
const isPremiumPlan = planType === 'premium';
const canImportData = isSupraAdmin || (isPremiumPlan && userProfile?.role === 'admin');
```

## Tests recommandés

### Scénarios à tester

1. **Workspace Freemium**:
   - [ ] Lien Import affiché avec cadenas et désactivé
   - [ ] Bouton "Base personnelle" affiché avec cadenas et désactivé
   - [ ] Origine forcée à "public" même si tentative de changement

2. **Workspace Standard**:
   - [ ] Lien Import affiché avec cadenas et désactivé
   - [ ] Bouton "Base personnelle" affiché avec cadenas et désactivé
   - [ ] Origine forcée à "public"

3. **Workspace Premium**:
   - [ ] Lien Import accessible normalement
   - [ ] Bouton "Base personnelle" fonctionnel
   - [ ] Changement d'origine libre entre public/private

4. **Supra Admin**:
   - [ ] Accès complet indépendamment du plan workspace

## Déploiement

### Edge Functions mises à jour
- `get-admin-workspaces` (version 121)
- `get-admin-contacts` (version 112) 
- `update-user-plan-role` (version 85)

### Migrations appliquées
- `fix_sync_workspace_user_quotas_function`: Correction de la fonction de synchronisation des quotas

## Notes techniques

### Gestion des plans
- Le plan est géré au niveau du **workspace**, pas de l'utilisateur individuel
- La vérification se fait via `currentWorkspace?.plan_type`
- Les quotas sont synchronisés automatiquement via le trigger `trigger_workspace_plan_change`

### Permissions RLS
- Les Edge Functions utilisent `service_role` avec policies RLS spécifiques
- La table `user_roles` est privilégiée pour éviter les conflits de permissions
- Les triggers utilisent `SECURITY DEFINER` pour les opérations privilégiées

## Maintenance

### Points d'attention
1. **Cohérence**: S'assurer que toute nouvelle fonctionnalité premium respecte le même pattern
2. **Tests**: Vérifier les restrictions après chaque changement de plan
3. **Performance**: Surveiller l'impact des vérifications de permissions sur les performances

### Évolutions futures
- Possibilité d'ajouter d'autres niveaux de restrictions (par fonctionnalité)
- Extension du système à d'autres composants premium
- Amélioration des messages d'aide et de la documentation utilisateur
