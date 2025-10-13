# Correction du bug d'affichage du plan utilisateur

## 🐛 Problème identifié

L'utilisateur `guillaumears44@gmail.com` (Guillaume Colin) voyait son plan affiché comme "Freemium" dans la page des paramètres, alors qu'il est rattaché au workspace "Global Administration" qui est sur un plan **Pro**.

## 🔍 Analyse

### Données en base (✅ CORRECTES)
- **Email** : guillaumears44@gmail.com
- **Workspace** : Global Administration (ID: `de960863-892c-45e2-8288-b9bbc69bc03b`)
- **Plan du workspace** : `pro` ✅
- **Rôle** : `admin`
- **Supra admin** : `true`

### Cause du bug
Le problème était dans le **frontend** :
- La page `SimplifiedSettings.tsx` affichait `userProfile?.plan_type`
- Or, la colonne `plan_type` **n'existe PAS** dans la table `users`
- Le plan doit être récupéré depuis `workspaces.plan_type`, pas depuis `users`

### Architecture correcte
```
auth.users (authentification)
    ↓
public.users (profil utilisateur)
    ↓ workspace_id
public.workspaces (workspace avec plan_type)
    ↓
plan_type: 'freemium' | 'pro'
```

## ✅ Corrections appliquées

### 1. Frontend - Suppression de `plan_type` de l'interface `UserProfile`
**Fichier** : `src/contexts/UserContext.tsx`
- ❌ Supprimé : `plan_type?: string;` de l'interface `UserProfile`
- ❌ Supprimé : `plan_type: userData?.plan_type` de l'objet profile

### 2. Frontend - Correction de l'affichage dans les paramètres
**Fichier** : `src/pages/SimplifiedSettings.tsx`
- ✅ Ajouté : Import de `usePermissions`
- ✅ Modifié : Affichage du plan avec `planType || currentWorkspace?.plan_type || 'Freemium'`
- ❌ Avant : `{userProfile?.plan_type || t('account.planDefault')}`
- ✅ Après : `{planType || currentWorkspace?.plan_type || 'Freemium'}`

### 3. Frontend - Correction du hook `usePermissions`
**Fichier** : `src/hooks/usePermissions.ts`
- ✅ Modifié : `const planType = currentWorkspace?.plan_type || 'freemium';`
- ❌ Avant : `const planType = currentWorkspace?.plan_type || userProfile?.plan_type;`
- ✅ Ajouté : Commentaire explicatif

### 4. Frontend - Correction du debug
**Fichier** : `src/hooks/useGlobalStateDebug.ts`
- ❌ Supprimé : `plan_type: userProfile.plan_type` du debug

### 5. Base de données - Documentation
**Migration** : `add_users_table_documentation`
- ✅ Ajouté : Commentaire sur la table `users` précisant que le plan est dans `workspaces`
- ✅ Ajouté : Commentaire sur `users.workspace_id` expliquant comment obtenir le plan
- ✅ Ajouté : Commentaire sur `workspaces.plan_type` comme source de vérité

## 🧪 Vérification

### Build
```bash
npm run build
```
✅ Build réussi sans erreurs

### Données en base
```sql
SELECT 
  u.email,
  w.name as workspace_name,
  w.plan_type as plan,
  ur.role,
  ur.is_supra_admin
FROM users u
LEFT JOIN workspaces w ON u.workspace_id = w.id
LEFT JOIN user_roles ur ON ur.user_id = u.user_id
WHERE u.email = 'guillaumears44@gmail.com';
```

**Résultat** :
- ✅ Email : guillaumears44@gmail.com
- ✅ Workspace : Global Administration
- ✅ Plan : **pro**
- ✅ Role : admin
- ✅ Supra admin : true

## 📊 Impact

### Utilisateurs affectés
Tous les utilisateurs qui consultaient la page des paramètres voyaient potentiellement un plan incorrect si le frontend essayait de lire `userProfile.plan_type` au lieu de `currentWorkspace.plan_type`.

### Résolution
Après déploiement, tous les utilisateurs verront le plan correct basé sur leur workspace :
- ✅ Utilisateurs Pro verront "Pro"
- ✅ Utilisateurs Freemium verront "Freemium"

## 🚀 Déploiement

1. ✅ Migration appliquée en base de données
2. ✅ Code frontend corrigé
3. ✅ Build vérifié
4. 🔄 À déployer : Frontend

### Commandes de déploiement
```bash
# Build
npm run build

# Deploy (selon votre méthode)
npm run deploy
# ou
./deploy.sh
```

## 📝 Notes importantes

### Pour les développeurs futurs
⚠️ **IMPORTANT** : Le plan d'un utilisateur (`freemium` ou `pro`) est **TOUJOURS** stocké dans `workspaces.plan_type`, **JAMAIS** dans la table `users`.

Pour obtenir le plan d'un utilisateur :
```typescript
// ✅ CORRECT
const { planType } = usePermissions();
// ou
const { currentWorkspace } = useWorkspace();
const plan = currentWorkspace?.plan_type;

// ❌ INCORRECT
const plan = userProfile?.plan_type; // Cette propriété n'existe pas !
```

### Architecture des plans
- **Source de vérité** : `workspaces.plan_type`
- **Hook recommandé** : `usePermissions()` qui retourne `planType`
- **Fallback** : `'freemium'` si aucun workspace n'est trouvé

## ✅ Résultat final

Après ces corrections, l'utilisateur `guillaumears44@gmail.com` verra correctement :
- **Plan du workspace** : Pro ✅
- **Rôle** : admin ✅

Et tous les autres utilisateurs verront également leur plan correct basé sur leur workspace.




