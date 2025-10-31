# Hotfix : Liens du chatbot ouvrent dans un nouvel onglet

**Date** : 31 octobre 2024  
**Type** : Hotfix UX  
**Composant** : Chatbot (Agent documentaire)

## Problème identifié

Les liens présents dans le contenu markdown des réponses du chatbot (agent documentaire) écrasaient la page actuelle lors du clic, au lieu d'ouvrir dans un nouvel onglet. Cela causait une mauvaise expérience utilisateur :
- Perte du contexte de la conversation en cours
- Nécessité de naviguer en arrière pour revenir au chat
- Comportement incohérent avec les attentes UX modernes

## Solution implémentée

Ajout d'un composant personnalisé pour les liens (`a`) dans la configuration `ReactMarkdown` du composant `LlamaCloudChatModal.tsx`.

### Modifications techniques

**Fichier** : `src/components/search/LlamaCloudChatModal.tsx`

Ajout du composant `a` dans la configuration `ReactMarkdown` (ligne 430-440) :

```typescript
a: ({ href, children, ...props }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary hover:underline"
    {...props}
  >
    {children}
  </a>
),
```

### Attributs ajoutés

- `target="_blank"` : Force l'ouverture dans un nouvel onglet
- `rel="noopener noreferrer"` : Sécurise le lien contre les vulnérabilités de sécurité (prévention de l'accès au `window.opener`)
- `className="text-primary hover:underline"` : Style cohérent avec le reste de l'interface

## Impact

✅ **Amélioration UX** : Tous les liens dans le contenu markdown des messages du chatbot ouvrent maintenant dans un nouvel onglet  
✅ **Cohérence** : Comportement aligné avec les liens des sources dans l'accordéon "Sources utilisées" (qui avaient déjà cette fonctionnalité)  
✅ **Sécurité** : Ajout de `rel="noopener noreferrer"` pour prévenir les vulnérabilités de sécurité  
✅ **Expérience** : L'utilisateur conserve son contexte de conversation tout en consultant les liens référencés  

## Test recommandé

1. Ouvrir le chatbot sur un produit
2. Poser une question qui génère une réponse avec des liens
3. Cliquer sur un lien dans le contenu de la réponse
4. Vérifier que le lien s'ouvre dans un nouvel onglet
5. Vérifier que la conversation reste accessible dans l'onglet d'origine

## Notes

- Aucune régression identifiée
- Aucun changement de dépendances nécessaire
- Aucun impact sur les performances
- Compatible avec tous les navigateurs modernes
