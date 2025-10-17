# Système de tiers pour les plans Pro

## Vue d'ensemble

Ce document décrit le système de tiers flexible pour les plans Pro, permettant de gérer différents niveaux d'accès avec des limites d'utilisateurs configurables.

## Architecture

### Modèle de données

#### Table `plan_tiers`
Table de configuration centralisée pour gérer les tiers de plans :

```sql
CREATE TABLE plan_tiers (
  id uuid PRIMARY KEY,
  tier_code text UNIQUE NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('freemium', 'pro')),
  display_name_fr text NOT NULL,
  display_name_en text NOT NULL,
  max_users integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### Modification de `workspaces`
Ajout d'une colonne `plan_tier` avec clé étrangère vers `plan_tiers.tier_code`.

### Tiers disponibles

| Tier Code | Nom français | Nom anglais | Max Users | Plan Type |
|-----------|--------------|-------------|-----------|-----------|
| `freemium` | Freemium | Freemium | 1 | freemium |
| `pro-1` | Pro - Solo | Pro - Solo | 1 | pro |
| `pro-2` | Pro - Équipe (5 utilisateurs) | Pro - Team (5 users) | 5 | pro |
| `pro-3` | Pro - Entreprise (15 utilisateurs) | Pro - Business (15 users) | 15 | pro |
| `pro-4` | Pro - Illimité | Pro - Unlimited | 999999 | pro |

## Fonctionnalités

### 1. Validation des limites d'utilisateurs

La fonction PostgreSQL `check_workspace_user_limit(workspace_id, new_tier_code)` :
- Compte les utilisateurs actifs + invitations en attente
- Vérifie si le total respecte la limite du tier
- Retourne un objet JSON avec `allowed`, `current_count`, `max_users`, et `error` si dépassement

### 2. Gestion des tiers depuis l'admin

**Page `/admin` - Section "Gestion des Entreprises"**
- Affichage du tier actuel sous le badge du plan
- Compteur d'utilisateurs : `X / Y` (en rouge si limite dépassée)
- Modification du tier via dropdown
- **Validation stricte** : Impossible de passer à un tier avec moins d'utilisateurs que l'actuel
- Message d'erreur explicite indiquant combien d'utilisateurs doivent être retirés

### 3. Affichage sur `/settings`

**Carte "Informations du compte"**
- Affiche le nom du tier (ex: "Pro - Entreprise (15 utilisateurs)")
- Indication de la limite d'utilisateurs pour les tiers non-illimités

**Carte "Équipe du workspace"**
- Compteur d'utilisateurs intégré dans le header (couleur primaire si OK, rouge si limite atteinte)
- Bouton d'invitation automatiquement désactivé si limite atteinte
- Message d'erreur si tentative d'invitation à la limite

### 4. Limitations automatiques

**Lors d'une invitation** :
- La Edge Function `invite-user` vérifie automatiquement la limite
- Retourne une erreur 400 avec message explicite si limite atteinte

**Lors d'un changement de tier** :
- La Edge Function `update-user-plan-role` (action `update_workspace_tier`) vérifie la limite
- Bloque la modification si le nombre d'utilisateurs actuels dépasse la nouvelle limite
- Force le supra admin à retirer manuellement des utilisateurs avant de réduire le tier

## Migration des workspaces existants

Lors du déploiement initial :
- Tous les workspaces `freemium` → tier `freemium` (1 user)
- Tous les workspaces `pro` → tier `pro-4` (illimité) pour préserver l'accès existant

## API Frontend

### Fonctions dans `adminApi.ts`

```typescript
// Récupérer tous les tiers actifs
getPlanTiers(): Promise<PlanTier[]>

// Mettre à jour le tier d'un workspace (avec validation)
updateWorkspaceTier(workspaceId: string, tierCode: string)

// Vérifier les limites d'un workspace
getWorkspaceTierLimits(workspaceId: string): Promise<TierLimitCheck>
```

### Types TypeScript

```typescript
interface PlanTier {
  tier_code: string;
  display_name_fr: string;
  display_name_en: string;
  max_users: number;
  plan_type: 'freemium' | 'pro';
  // ...
}

interface TierLimitCheck {
  allowed: boolean;
  current_count: number;
  max_users: number;
  active_users: number;
  pending_invitations: number;
  tier_code: string;
  error?: string;
}
```

## Extensibilité

### Ajouter un nouveau tier

Pour ajouter un nouveau tier (ex: Pro-5 avec 50 utilisateurs) :

```sql
INSERT INTO plan_tiers 
  (tier_code, plan_type, display_name_fr, display_name_en, max_users, sort_order)
VALUES 
  ('pro-5', 'pro', 'Pro - Grande Entreprise (50 utilisateurs)', 'Pro - Large Business (50 users)', 50, 6);
```

Le nouveau tier apparaîtra automatiquement dans le dropdown admin sans aucune modification de code.

### Désactiver un tier

```sql
UPDATE plan_tiers SET is_active = false WHERE tier_code = 'pro-1';
```

Les workspaces existants sur ce tier conservent leur configuration, mais les supra admins ne peuvent plus l'assigner à de nouveaux workspaces.

## Sécurité

- **RLS activé** sur la table `plan_tiers`
- **Validation stricte** côté backend (Edge Functions)
- **Vérification en temps réel** avant toute modification
- **Messages d'erreur explicites** pour guider les administrateurs

## UX

- **Feedback visuel** : Compteur en rouge si limite dépassée
- **Boutons désactivés** : Invitation impossible si limite atteinte
- **Messages clairs** : Indique exactement combien d'utilisateurs retirer
- **Design cohérent** : Utilisation de la couleur primaire pour les compteurs

