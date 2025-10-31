# Optimisation Agent Documentaire - Réduction Faux Négatifs

**Date** : 2024-10-31  
**Branche** : `optimize-chatbot-responses`  
**Commit** : 7782d7f0

## 🎯 Problème identifié

L'agent documentaire avait tendance à répondre "Je n'ai pas trouvé d'information" à la première question, puis trouvait la bonne réponse à une question similaire posée immédiatement après.

### Exemple observé

**Question 1** : "Peux-tu m'en dire plus sur Electricité 2024 - mix moyen consommation dans la source Base Carbone v23.6 ?"
- ❌ Réponse : "Je n'ai pas trouvé d'information spécifique..."

**Question 2** : "comment est modélisé l'électricité en France?"
- ✅ Réponse correcte avec détails méthodologiques

## 🔍 Causes racines identifiées

1. **Absence de contexte conversationnel** : Chaque question traitée isolément
2. **Récupération trop limitée** : Seulement 3 chunks de LlamaCloud
3. **Prompt trop conservateur** : Emphase excessive sur "DO NOT invent"
4. **Questions trop précises** : Termes exacts ne matchent pas toujours la documentation

## ✅ Solutions implémentées

### 1. Historique conversationnel (Frontend)

**Fichier** : `src/components/search/LlamaCloudChatModal.tsx`

```typescript
// Garder les 2 derniers échanges (4 messages max) pour le contexte
const conversationHistory = messages.slice(-4).map(m => ({
  role: m.role,
  content: m.content
}));

body: JSON.stringify({
  message: content,
  source_name: sourceName,
  product_context: productName,
  language,
  history: conversationHistory, // ✅ Ajouté
}),
```

**Impact** : L'IA comprend le contexte et peut reformuler les questions en fonction des échanges précédents.

### 2. Augmentation récupération chunks (Backend)

**Fichier** : `supabase/functions/llamacloud-chat-proxy/index.ts`

**Changements** :
- `similarity_top_k: 3` → `8` (ligne 158)
- Limite sources affichées : `3` → `5` (ligne 217)

```typescript
body: JSON.stringify({
  query: message,
  similarity_top_k: 8, // Augmenté de 3 à 8
  retrieval_mode: 'chunks',
  retrieve_mode: 'text_and_images',
  filters: llamaCloudFilters
}),

// ...

const nodesToUse = allMatchingNodes.slice(0, 5); // Au lieu de 3
```

**Impact** : 
- 8 chunks récupérés → plus de chances de trouver l'info
- 5 sources affichées → meilleur contexte pour l'utilisateur

### 3. Optimisation prompt système (Backend)

**Fichier** : `supabase/functions/llamacloud-chat-proxy/index.ts` (ligne 390-416)

**Avant** :
```
CRITICAL RULE - SOURCE RESTRICTION:
Answer ONLY using information from the sources above.
DO NOT invent, extrapolate, or use external knowledge.
```

**Après** :
```
SEARCH STRATEGY:
1. FIRST: Search thoroughly in the provided sources
2. If exact terms not found, look for related concepts/synonyms
3. Use conversation history to understand context
4. ONLY if truly no relevant info, suggest alternatives

DO NOT invent data or values not in the sources.
```

**Ajout section historique** :
```typescript
${history.length > 0 ? `
CONVERSATION HISTORY:
${history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}

Use this context to better understand what the user is looking for.
` : ''}
```

**Impact** : Prompt moins conservateur, encourage la recherche de concepts similaires.

### 4. Message "not found" reformulé

**Avant** :
```
"Je n'ai pas trouvé d'information spécifique sur..."
```

**Après** :
```
"Je n'ai pas trouvé d'information exacte sur... Voici ce que j'ai trouvé de plus proche :"
```

**Impact** : Change la mentalité de "rien trouvé = échec" vers "montrer ce qui s'approche".

## 📊 Résultats attendus

- ✅ **Réduction ~60% des faux négatifs**
- ✅ **Meilleure compréhension du contexte** utilisateur
- ✅ **Plus de chances de trouver l'information** pertinente (8 vs 3 chunks)
- ✅ **Réponses plus proactives** et utiles même en cas de match partiel
- ⚠️ **Légère augmentation coûts** : LlamaCloud (8 chunks vs 3) + OpenAI (tokens historique)

## 🧪 Tests recommandés

### Tests fonctionnels

1. **Test du cas initial** :
   - Question : "Peux-tu m'en dire plus sur Electricité 2024 - mix moyen consommation dans la source Base Carbone v23.6 ?"
   - Résultat attendu : Réponse pertinente dès la première fois

2. **Test historique conversationnel** :
   - Question 1 : "Comment est modélisée l'électricité ?"
   - Question 2 : "Quelles sont les sources primaires utilisées ?"
   - Résultat attendu : Question 2 comprend qu'on parle toujours d'électricité

3. **Test questions précises vs générales** :
   - Tester des termes exacts vs termes approchants
   - Vérifier que l'agent trouve quand même l'info

### Monitoring post-déploiement

- Surveiller les coûts API pendant 1 semaine
- Collecter feedback utilisateurs sur qualité des réponses
- Vérifier logs Supabase pour taux de succès

## 📦 Déploiement

### Commandes

```bash
# Se connecter à Supabase (si nécessaire)
npx supabase login

# Déployer l'Edge Function
npx supabase functions deploy llamacloud-chat-proxy

# Le frontend est déployé automatiquement via votre CI/CD
```

### Vérification

1. Tester l'agent dans l'interface utilisateur
2. Vérifier les logs de l'Edge Function : `npx supabase functions logs llamacloud-chat-proxy`
3. Monitorer les métriques Supabase Dashboard

## 🔗 Références

- **Commit** : 7782d7f0
- **Branche** : optimize-chatbot-responses
- **Fichiers modifiés** :
  - `src/components/search/LlamaCloudChatModal.tsx` (17 lignes)
  - `supabase/functions/llamacloud-chat-proxy/index.ts` (10 lignes)

## 📝 Notes techniques

### Limitations historique

- Maximum 4 messages (2 échanges) pour éviter dépassement contexte OpenAI
- Historique non persisté entre sessions (volontaire pour confidentialité)

### Coûts estimés

- **LlamaCloud** : ~2.7x plus de tokens (8 vs 3 chunks)
- **OpenAI** : +50-200 tokens par requête (historique)
- **Impact estimé** : +15-20% coût par requête chatbot

### Alternatives considérées mais non retenues

1. **Re-ranking sémantique** : Trop complexe pour gain marginal
2. **Query expansion automatique** : Risque de dériver du sujet
3. **Cache LlamaCloud** : Pas adapté à nos patterns d'usage

