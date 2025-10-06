# Correction : Déblocage des favoris pour le plan Freemium

## 🐛 Problème identifié

Les utilisateurs **Freemium** ne pouvaient pas accéder aux favoris, alors que selon les spécifications du produit, ils devraient avoir accès à cette fonctionnalité avec une **limite de 10 favoris**.

### Comportement attendu selon les spécifications

| Plan     | Nombre de favoris max |
|----------|----------------------|
| Freemium | 10                   |
| Pro      | Illimité (1000+)     |

### Comportement réel (avant correction)

- ❌ **Freemium** : Aucun accès aux favoris (fonctionnalité complètement bloquée)
- ✅ **Pro** : Accès illimité aux favoris

## 🔍 Analyse de la cause

### Code problématique

**Fichier** : `src/hooks/useEmissionFactorAccess.ts`

```typescript
// ❌ AVANT (ligne 76-79)
const canUseFavorites = useCallback(() => {
  if (!user || !currentWorkspace) return false;
  return currentWorkspace.plan_type === 'pro'; // ❌ Bloque Freemium
}, [user, currentWorkspace]);
```

Cette logique **bloquait complètement** l'accès aux favoris pour les utilisateurs Freemium, au lieu de simplement appliquer une limite de quota.

### Architecture correcte

L'accès aux favoris devrait être géré en **deux niveaux** :

1. **Accès à la fonctionnalité** (`canUseFavorites`) : Disponible pour TOUS les plans
2. **Limite de quotas** (`canAddToFavorites` dans `useQuotas`) : 
   - Freemium : 10 favoris max
   - Pro : Illimité (null)

## ✅ Correction appliquée

### 1. Déblocage de l'accès aux favoris pour tous les plans

**Fichier** : `src/hooks/useEmissionFactorAccess.ts`

```typescript
// ✅ APRÈS (ligne 76-81)
const canUseFavorites = useCallback(() => {
  // Les favoris sont disponibles pour tous les plans (Freemium et Pro)
  // La limite de quotas est gérée par useQuotas
  if (!user || !currentWorkspace) return false;
  return true; // Tous les plans ont accès aux favoris
}, [user, currentWorkspace]);
```

### 2. Vérification des limites de quotas (déjà en place)

**Fichier** : `src/hooks/useQuotaSync.ts`

Les limites de quotas sont correctement configurées :

```typescript
const PLAN_QUOTA_RULES: Record<PlanType, PlanQuotaRules> = {
  freemium: {
    exports_limit: 10,
    clipboard_copies_limit: 10,
    favorites_limit: 10, // ✅ 10 favoris pour Freemium
  },
  pro: {
    exports_limit: 1000,
    clipboard_copies_limit: 1000,
    favorites_limit: null, // ✅ Illimité pour Pro
  },
};
```

**Fichier** : `src/hooks/useQuotas.ts`

La vérification du quota est déjà en place :

```typescript
const canAddToFavorites = quotaData ? 
  quotaData.favorites_limit === null || quotaData.favorites_used < quotaData.favorites_limit 
  : false;
```

## 📊 Impact de la correction

### Fonctionnalités débloquées pour les utilisateurs Freemium

1. ✅ **Accès à la page Favoris** dans la navbar
2. ✅ **Ajout aux favoris** depuis les résultats de recherche (jusqu'à 10)
3. ✅ **Gestion des favoris** (ajout/suppression)
4. ✅ **Limite de 10 favoris** appliquée via le système de quotas
5. ✅ **Message d'avertissement** quand la limite est atteinte

### Comportement après correction

| Plan     | Accès aux favoris | Limite | Comportement                                    |
|----------|-------------------|--------|-------------------------------------------------|
| Freemium | ✅ Oui            | 10     | Peut ajouter jusqu'à 10 favoris, puis bloqué   |
| Pro      | ✅ Oui            | ∞      | Peut ajouter un nombre illimité de favoris      |

## 🔧 Composants affectés

### Composants utilisant `canUseFavorites()`

1. **`src/hooks/useEmissionFactorAccess.ts`** - Définit `canUseFavorites()` ✅ Corrigé
2. **`src/components/ui/UnifiedNavbar.tsx`** - Affiche/cache le lien favoris
3. **`src/contexts/FavoritesContext.tsx`** - Gère les opérations sur les favoris
4. **`src/components/search/algolia/SearchResults.tsx`** - Bouton d'ajout aux favoris
5. **`src/pages/Favorites.tsx`** - Page de gestion des favoris

### Flux de vérification des favoris

```
Utilisateur clique sur "Ajouter aux favoris"
    ↓
canUseFavorites() vérifie si l'utilisateur est connecté et a un workspace
    ↓ (retourne true pour tous les plans)
canAddToFavorites (useQuotas) vérifie la limite de quotas
    ↓
- Freemium : favorites_used < 10 ? ✅ Ajouter : ❌ Limite atteinte
- Pro : favorites_limit === null ? ✅ Ajouter (illimité)
```

## 🧪 Vérification en base de données

### Vérification des quotas via MCP Supabase

Les quotas ont été vérifiés directement en base de données :

**Résultats** :
- ✅ **Freemium** : 2 utilisateurs avec `favorites_limit = 10`
- ✅ **Pro** : 6 utilisateurs avec `favorites_limit = NULL` (illimité)
- ✅ **Aucune incohérence détectée**

## 🧪 Tests à effectuer

### 1. Test avec un compte Freemium

- [ ] Se connecter avec un compte Freemium
- [ ] Vérifier que le lien "Favoris" est visible dans la navbar (sans cadenas)
- [ ] Ajouter un facteur d'émission aux favoris
- [ ] Vérifier que le compteur de favoris s'incrémente (1/10)
- [ ] Ajouter 9 autres favoris pour atteindre la limite (10/10)
- [ ] Tenter d'ajouter un 11ème favori
- [ ] Vérifier qu'un message d'erreur s'affiche indiquant la limite atteinte
- [ ] Supprimer un favori
- [ ] Vérifier que le compteur diminue (9/10)
- [ ] Vérifier qu'on peut à nouveau ajouter un favori

### 2. Test avec un compte Pro

- [ ] Se connecter avec un compte Pro
- [ ] Vérifier que le lien "Favoris" est visible dans la navbar
- [ ] Ajouter plusieurs facteurs d'émission aux favoris (> 10)
- [ ] Vérifier qu'aucune limite n'est appliquée
- [ ] Vérifier que le compteur affiche "X/Illimité"

### 3. Test de la page Favoris

- [ ] Accéder à la page Favoris
- [ ] Vérifier que tous les favoris sont affichés
- [ ] Tester la recherche dans les favoris
- [ ] Tester les filtres
- [ ] Tester la suppression d'un favori
- [ ] Tester l'export des favoris (selon le plan)

## 🚀 Déploiement

### Build

```bash
npm run build
```

✅ Build réussi sans erreurs

### Checklist de déploiement

- [x] Code corrigé
- [x] Build vérifié
- [ ] Tests manuels effectués
- [ ] Déploiement en production
- [ ] Vérification post-déploiement avec comptes Freemium et Pro

## 📝 Notes pour les développeurs

### Distinction importante

```typescript
// ✅ canUseFavorites() - Accès à la FONCTIONNALITÉ
// Retourne true si l'utilisateur peut VOIR et UTILISER les favoris
const { canUseFavorites } = useEmissionFactorAccess();

// ✅ canAddToFavorites - Vérification du QUOTA
// Retourne true si l'utilisateur n'a pas atteint sa LIMITE
const { canAddToFavorites } = useQuotas();
```

### Utilisation dans les composants

```typescript
// Pour afficher/cacher le lien Favoris dans la navbar
if (canUseFavorites()) {
  // Afficher le lien
}

// Pour vérifier si l'utilisateur peut ajouter un favori
if (canUseFavorites() && canAddToFavorites) {
  // Permettre l'ajout
} else if (canUseFavorites() && !canAddToFavorites) {
  // Afficher un message "Limite de favoris atteinte"
}
```

## 🎯 Résultat final

Après cette correction :

- ✅ **Freemium** : Accès aux favoris avec limite de 10
- ✅ **Pro** : Accès aux favoris illimité
- ✅ **Conformité** avec les spécifications du produit
- ✅ **Expérience utilisateur** améliorée pour les utilisateurs Freemium

## 📚 Références

- **Spécifications produit** : Tableau des caractéristiques Freemium vs Pro
- **Documentation technique** : 
  - `BUGFIX_FAVORITES_ACCESS.md` - Correction précédente pour les utilisateurs Pro
  - `BUGFIX_PLAN_DISPLAY.md` - Correction de l'affichage du plan
  - `PREMIUM_RESTRICTIONS_IMPLEMENTATION.md` - Implémentation des restrictions premium
