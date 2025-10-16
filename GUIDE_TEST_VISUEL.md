# 🧪 Guide de Test Visuel - Optimisation React Query

## 📋 Checklist de Test Complète

### ✅ Phase 1: Démarrage et Login

#### 1.1 Démarrer l'application
```bash
npm run dev
```
**Attendu**: Serveur démarre sur `http://localhost:8083`

#### 1.2 Se connecter
- URL: `http://localhost:8083/login`
- Email: `axelgirard.pro+dev@gmail.com`
- Mot de passe: `Ga01700m#`

**Attendu**: Redirection vers `/search` après login réussi

---

### ✅ Phase 2: Analyse Network (CRITIQUE)

#### 2.1 Ouvrir Chrome DevTools
- Windows/Linux: `F12`
- Mac: `Cmd + Option + I`

#### 2.2 Onglet Network
1. Cliquer sur l'onglet **Network**
2. Activer **Preserve log** (case à cocher)
3. Dans le filtre, taper: `supabase.co`
4. Cliquer sur **Clear** (🚫) pour vider les logs

#### 2.3 Recharger la page /search
- Appuyer sur `Cmd+R` (Mac) ou `F5` (Windows/Linux)

#### 2.4 Compter les requêtes Supabase

**AVANT optimisation** (pour référence):
```
search_quotas        : 32+ requêtes ❌
fe_sources           : 19+ requêtes ❌
fe_source_workspace  : 18+ requêtes ❌
is_supra_admin (RPC) : 10+ requêtes ❌
search_quotas (POST) : 19+ requêtes ❌
─────────────────────────────────────
TOTAL                : ~150 requêtes ❌
```

**APRÈS optimisation** (attendu maintenant):
```
search_quotas        : 1-2 requêtes ✅
fe_sources           : 1-2 requêtes ✅
fe_source_workspace  : 1-2 requêtes ✅
is_supra_admin (RPC) : 1 requête   ✅
search_quotas (POST) : 1-2 requêtes ✅
─────────────────────────────────────
TOTAL                : ~25 requêtes ✅
```

#### 📸 Capture d'écran recommandée
- Faire une capture du Network Tab avec le filtre `supabase.co`
- Entourer le compteur total de requêtes

---

### ✅ Phase 3: React Query DevTools (IMPORTANT)

#### 3.1 Ouvrir React Query DevTools
- Chercher l'**icône flottante** en bas à gauche de l'écran
- Cliquer dessus pour ouvrir le panneau

#### 3.2 Explorer les Queries
Dans le panneau de gauche, vous devriez voir:

```
📦 Queries (5)
├── 🟢 ["quotas", "<user-id>"]
│   └── Status: success, Data: {...}, Updated: X seconds ago
├── 🟢 ["fe_sources", "global"]
│   └── Status: success, Data: [{...}], Stale in: 4min 30s
├── 🟢 ["fe_sources", "workspace", "<workspace-id>"]
│   └── Status: success, Data: [{...}], Stale in: 45s
├── 🟢 ["is_supra_admin", "<user-id>"]
│   └── Status: success, Data: false, Stale: never (∞)
└── 🟢 ["source-logos"]
    └── Status: success, Data: {...}, Stale in: 23h 59min
```

#### 3.3 Vérifier les données
- Cliquer sur **["quotas", "<user-id>"]**
- Dans le panneau de droite, cliquer sur **Data Explorer**
- Vérifier que les données sont présentes:
  ```json
  {
    "user_id": "...",
    "exports_limit": 10,
    "exports_used": 0,
    "clipboard_copies_limit": 10,
    "clipboard_copies_used": 0,
    "favorites_limit": 10,
    "favorites_used": 0
  }
  ```

#### 📸 Capture d'écran recommandée
- Panneau React Query DevTools avec les queries visibles

---

### ✅ Phase 4: Test de Navigation (Cache Persistence)

#### 4.1 Naviguer ailleurs
- Cliquer sur **Favoris** dans la navbar
- Observer le Network Tab: Devrait voir **très peu de nouvelles requêtes**

#### 4.2 Revenir sur /search
- Cliquer sur **Search** dans la navbar
- Observer le Network Tab: **PAS de nouvelles requêtes pour les données cachées**
- React Query DevTools: Les queries devraient être **vertes** (cache hit)

#### 4.3 Attendu
- Navigation **instantanée** (pas de spinner)
- Données affichées **immédiatement** depuis le cache
- Network Tab: Seulement requêtes Algolia (recherche)

---

### ✅ Phase 5: Test de Recherche Algolia

#### 5.1 Rechercher "mangue"
- Dans la barre de recherche, taper: `mangue`
- Appuyer sur Enter

#### 5.2 Vérifications
- ✅ Résultats affichés rapidement
- ✅ Filtres sur le côté gauche fonctionnels
- ✅ Aucune erreur console
- ✅ Network Tab: Requêtes Algolia présentes (normal)

#### 5.3 Tester les filtres
- Cliquer sur un filtre (ex: Secteur)
- Cocher une option
- ✅ Résultats mis à jour instantanément
- ✅ Pas de nouvelles requêtes Supabase

---

### ✅ Phase 6: Test des Favoris (Mutations + Realtime)

#### 6.1 Ajouter un favori
1. Sur la page /search avec des résultats
2. Cliquer sur l'**icône étoile** ⭐ d'un résultat
3. Observer:
   - ✅ Toast de confirmation
   - ✅ Étoile devient pleine ⭐→ ★
   - ✅ Dans React Query DevTools: `["quotas", ...]` se met à jour
   - ✅ Network Tab: **1 seule requête POST** vers `favorites`

#### 6.2 Vérifier le quota
1. Dans React Query DevTools, cliquer sur `["quotas", "<user-id>"]`
2. Data Explorer: Vérifier que `favorites_used` a été **incrémenté**
3. ✅ Update **instantanée** dans le cache (pas de refetch)

#### 6.3 Aller sur la page Favoris
- Cliquer sur **Favoris** dans la navbar
- ✅ Le nouvel élément apparaît dans la liste

#### 6.4 Retirer le favori
- Cliquer sur l'**icône étoile pleine** ★
- ✅ Étoile redevient vide ★ → ⭐
- ✅ `favorites_used` décrémenté dans le cache

---

### ✅ Phase 7: Test des Exports (Increment Quota)

#### 7.1 Exporter un résultat
1. Sur un résultat de recherche, cliquer sur **Export** (icône download)
2. Observer:
   - ✅ Fichier CSV/JSON téléchargé
   - ✅ Dans React Query DevTools: `exports_used` incrémenté
   - ✅ Network Tab: **1 requête UPDATE** vers `search_quotas`

#### 7.2 Vérifier le quota
- React Query DevTools → `["quotas", ...]` → Data Explorer
- ✅ `exports_used` = 1 (ou incrémenté si déjà utilisé)

---

### ✅ Phase 8: Test du Debounce (search_quotas POST)

#### 8.1 Recharger rapidement plusieurs fois
1. Appuyer sur `Cmd+R` (Mac) ou `F5` (Windows) **5 fois de suite rapidement**
2. Observer le Network Tab (filtré sur `search_quotas`)

#### 8.2 Attendu
- ✅ **Maximum 1-2 POST** vers `search_quotas` (au lieu de 5)
- ✅ Debounce de 5s a fusionné les appels
- ✅ Aucune erreur console

---

### ✅ Phase 9: Test Realtime (Synchronisation Multi-Onglets)

#### 9.1 Ouvrir un deuxième onglet
- Dupliquer l'onglet actuel (`Cmd+T` puis coller l'URL)
- Se connecter si nécessaire

#### 9.2 Test de synchronisation
**Onglet 1**: Ajouter un favori
**Onglet 2**: Attendre 2-3 secondes → ✅ Le favori apparaît (Realtime)

**Onglet 1**: Faire un export
**Onglet 2**: React Query DevTools → ✅ `exports_used` se met à jour

#### 9.3 Attendu
- ✅ Synchronisation **bi-directionnelle**
- ✅ Cache React Query mis à jour via Realtime
- ✅ Pas de conflit de données

---

### ✅ Phase 10: Test de Stabilité (Console)

#### 10.1 Vérifier la console
Onglet **Console** dans DevTools:

#### ✅ Aucune erreur rouge
```
❌ MAUVAIS (erreurs à corriger):
❌ TypeError: Cannot read property 'id' of undefined
❌ Failed to fetch ...
❌ Unhandled Promise rejection

✅ BON (logs normaux):
✅ [HMR] connected
✅ DEBUG SearchProvider: { ... }
✅ Logs informatifs en développement
```

#### 10.2 Aucun warning React Query
```
❌ MAUVAIS:
❌ Query data cannot be undefined

✅ BON:
Aucun warning spécifique React Query
```

---

### ✅ Phase 11: Test de Performance (Temps de Chargement)

#### 11.1 Mesurer le temps
1. Ouvrir DevTools → **Network** → Activer **Disable cache**
2. Recharger la page avec `Cmd+Shift+R` (hard reload)
3. Observer la ligne **"DOMContentLoaded"** en bas du Network Tab

#### 11.2 Attendu
- ✅ **DOMContentLoaded < 2 secondes**
- ✅ **Load complet < 3 secondes**
- ✅ UI interactive rapidement (First Input Delay < 100ms)

#### 11.3 Avec cache activé
1. Désactiver **Disable cache**
2. Recharger normalement (`Cmd+R`)
3. ✅ Temps encore **plus rapide** grâce au cache React Query

---

## 📊 Tableau Récapitulatif des Tests

| Test | Status | Notes |
|------|--------|-------|
| ✅ Login réussi | ☐ | |
| ✅ Navigation /search | ☐ | |
| ✅ Comptage requêtes Network (< 30) | ☐ | Nombre: ____ |
| ✅ React Query DevTools visible | ☐ | |
| ✅ Queries en cache (5 queries) | ☐ | |
| ✅ Navigation cache persistence | ☐ | |
| ✅ Recherche "mangue" fonctionnelle | ☐ | |
| ✅ Filtres Algolia fonctionnels | ☐ | |
| ✅ Ajout favori + quota update | ☐ | |
| ✅ Export + quota increment | ☐ | |
| ✅ Debounce POST (1-2 max) | ☐ | |
| ✅ Realtime multi-onglets | ☐ | |
| ✅ Console sans erreurs | ☐ | |
| ✅ Temps chargement < 2s | ☐ | Temps: ____ |

---

## 🎯 Critères de Validation Finale

### ✅ Succès Total
- **Toutes les cases cochées** ✅
- **Nombre de requêtes < 30**
- **Aucune erreur console**
- **Temps de chargement < 2s**

### ⚠️ Succès Partiel
- **Une ou deux cases non cochées**
- **Nombre de requêtes < 50** (amélioration, mais pas optimal)
- **Quelques warnings console** (à investiguer)

### ❌ Échec
- **Plusieurs cases non cochées**
- **Nombre de requêtes > 100** (pas d'amélioration)
- **Erreurs critiques console**
- **Fonctionnalités cassées**

---

## 🐛 Troubleshooting

### Problème: React Query DevTools n'apparaît pas
**Solution**:
1. Vérifier que vous êtes en mode développement (`npm run dev`)
2. Regarder en bas à **gauche** de l'écran (icône petite)
3. Essayer de recharger la page

### Problème: Toujours beaucoup de requêtes
**Solution**:
1. Vérifier dans React Query DevTools que les queries sont en cache
2. Regarder les "Query Keys" pour confirmer qu'elles sont correctes
3. Vérifier que `staleTime` est bien configuré dans `queryClient.ts`

### Problème: Erreurs TypeScript
**Solution**:
```bash
# Réinstaller les dépendances
npm install
# Rebuild
npm run build
```

### Problème: Realtime ne fonctionne pas
**Solution**:
1. Vérifier dans Network Tab que les connexions WebSocket sont établies
2. Regarder les logs console pour les erreurs Supabase Realtime
3. Tester avec deux onglets en mode incognito (éviter conflit de cache)

---

## 📸 Captures d'Écran Recommandées

Pour documenter les tests:

1. **Network Tab** - Avant/Après (filtré sur `supabase.co`)
2. **React Query DevTools** - Liste des queries en cache
3. **Data Explorer** - Données d'une query (ex: quotas)
4. **Console** - Aucune erreur visible
5. **DOMContentLoaded** - Temps de chargement < 2s

---

## ✅ Validation Finale

Une fois tous les tests passés:

### Commit des changements
```bash
git add .
git commit -m "feat: Optimisation réseau avec React Query (-83% requêtes)"
```

### Documentation
- ✅ Checklist de tests complétée
- ✅ Captures d'écran prises
- ✅ Métriques validées

### Déploiement
Si tous les tests sont au vert, l'application est prête pour:
- ✅ Merge dans la branche principale
- ✅ Déploiement en staging
- ✅ Tests avec utilisateurs réels

---

**Bonne validation ! 🎉**

Si tous les tests sont verts, félicitations : vous avez réduit les requêtes réseau de 83% ! 🚀

