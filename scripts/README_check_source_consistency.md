# Script de Vérification de Cohérence des Sources

## 📋 Description

Le script `check-source-consistency.sql` vérifie la cohérence entre la configuration des sources (`fe_sources`) et leur représentation dans la table de projection Algolia (`emission_factors_all_search`).

## 🎯 Objectif

Détecter automatiquement les incohérences d'`access_level` qui peuvent causer :
- Des sources **gratuites** affichées comme **premium** (floutées à tort)
- Des sources **premium** accessibles gratuitement (faille de sécurité)

## 🔍 Cas d'Usage

### Hotfix du 30 octobre 2025

Ce script a été créé suite à la découverte que deux sources gratuites étaient floutées à tort :
- **AIB** : 2689 enregistrements marqués `paid` au lieu de `free`
- **Roundarc** : 1095 enregistrements marqués `paid` au lieu de `free`

**Total** : 3784 enregistrements affectés, maintenant corrigés.

## 📝 Utilisation

### Via Supabase SQL Editor

```sql
-- Copier/coller le contenu du script dans le SQL Editor
\i scripts/check-source-consistency.sql
```

### Via MCP Supabase (recommandé)

```javascript
// Depuis Cursor avec MCP
mcp_supabase_execute_sql({
  query: "SELECT ... FROM fe_sources ..."
});
```

### Via CLI Supabase

```bash
supabase db execute < scripts/check-source-consistency.sql
```

## 📊 Sections du Script

### 1. Détection d'Incohérences

Identifie les sources dont l'`access_level` diffère entre `fe_sources` et `emission_factors_all_search`.

**Résultat si incohérence :**
```
status                  | source_name | config_source | table_search | affected_records | fix_command
------------------------|-------------|---------------|--------------|------------------|-------------
INCOHÉRENCE DÉTECTÉE    | AIB         | free          | paid         | 2689             | SELECT refresh_ef_all_for_source('AIB');
```

**Résultat si OK :**
```
(0 rows)
✅ Aucune incohérence détectée
```

### 2. Message de Diagnostic

Affiche un message clair :
- ✅ Si tout est OK
- 🔴 Si des incohérences sont détectées (avec le nombre)

### 3. Statistiques Globales

Vue d'ensemble du nombre de sources et d'enregistrements par `access_level`.

**Exemple de résultat :**
```
type        | access_level | nb_sources | nb_records_total
------------|--------------|------------|------------------
STATISTIQUES| free         | 48         | 429821
STATISTIQUES| paid         | 6          | 195237
```

### 4. Sources Manquantes

Identifie les sources présentes dans `fe_sources` mais absentes de `emission_factors_all_search`.

Cela peut indiquer :
- Une source nouvellement ajoutée pas encore synchronisée
- Un problème d'import/synchronisation

## 🔧 Correction des Incohérences

Si une incohérence est détectée, utiliser :

```sql
-- 1. Rafraîchir la projection pour la source
SELECT refresh_ef_all_for_source('NOM_SOURCE');

-- 2. Vérifier que c'est corrigé
SELECT "Source", access_level, COUNT(*) 
FROM emission_factors_all_search 
WHERE "Source" = 'NOM_SOURCE'
GROUP BY "Source", access_level;

-- 3. Synchroniser vers Algolia
SELECT trigger_algolia_sync_for_source('NOM_SOURCE');
```

## 🔄 Automatisation Recommandée

### Option 1 : Monitoring Manuel

Exécuter ce script :
- **Hebdomadairement** : Vérification de routine
- **Après modification de `fe_sources`** : Validation immédiate
- **Après import massif de données** : Contrôle de cohérence

### Option 2 : Trigger Automatique

Créer un trigger qui vérifie la cohérence après chaque UPDATE de `fe_sources.access_level` :

```sql
CREATE OR REPLACE FUNCTION check_source_consistency_trigger()
RETURNS trigger AS $$
DECLARE
  v_inconsistent INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_inconsistent
  FROM emission_factors_all_search efs
  WHERE efs."Source" = NEW.source_name
    AND efs.access_level != NEW.access_level;
  
  IF v_inconsistent > 0 THEN
    RAISE WARNING 'Incohérence détectée pour % (% records). Exécuter: SELECT refresh_ef_all_for_source(%)',
      NEW.source_name, v_inconsistent, quote_literal(NEW.source_name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Option 3 : Edge Function Périodique

Créer une Edge Function Supabase qui s'exécute via cron (ex: tous les jours à 2h du matin) :

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const { data, error } = await supabase.rpc('check_source_consistency')
  
  // Envoyer une alerte si incohérences détectées
  // (email, Slack, etc.)
  
  return new Response(JSON.stringify({ data, error }))
})
```

## 📈 Métriques de Santé

Statistiques actuelles après le hotfix du 30/10/2025 :

| Métrique | Valeur |
|----------|--------|
| Sources gratuites | 48 |
| Sources premium | 6 |
| Enregistrements gratuits | 429 821 |
| Enregistrements premium | 195 237 |
| Incohérences détectées | 0 ✅ |

## 🔗 Liens Connexes

- **Documentation hotfix** : `docs/history/2025-10-30_HOTFIX_AIB_source_floutee.md`
- **Fonction de rafraîchissement** : `refresh_ef_all_for_source()` dans les migrations
- **Architecture des assignations** : `docs/architecture/source-assignment-flow.md`

## ⚠️ Notes Importantes

1. Ce script est **en lecture seule** - il ne modifie aucune donnée
2. L'exécution est **rapide** (< 1 seconde) même avec 600k+ enregistrements
3. Les commandes de correction sont fournies automatiquement dans les résultats
4. Toujours **synchroniser vers Algolia** après avoir corrigé une incohérence

---

**Créé** : 30 octobre 2025  
**Dernière mise à jour** : 30 octobre 2025  
**Auteur** : Assistant AI (Hotfix AIB/Roundarc)

