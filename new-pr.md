# Résumé de la Pull Request

## Contexte
- Ajustement global de l’échelle visuelle à 80% pour améliorer le confort de lecture.
- Mise à profit de la variable CSS `--app-scale` afin d’éviter tout contournement via le zoom navigateur.

## Principales modifications
- Déclaration de `--app-scale: 0.8` dans `:root` et héritage dans `.dark`.
- Application de `font-size: calc(16px * var(--app-scale))` sur `html` pour bâtir l’échelle relative.
- Conversion des tailles fixes des titres et textes (`px`) en `rem` pour conserver la réactivité.

## Impact Supabase
- Aucun changement côté Supabase.

## Tests
- ✅ Vérification manuelle des pages `search`, `favoris`, `import`, `settings` en local.
- ⚠️ Suite de tests automatisés non exécutée (à lancer si disponible).

## Points d’attention / follow-up
- Passer un coup d’œil sur les composants à largeur fixe (cartes, tableaux) après déploiement.
- Prévoir un test visuel E2E pour verrouiller la nouvelle échelle à l’avenir si nécessaire.

## Instructions merge
1. Relire visuellement la nouvelle échelle sur les pages principales.
2. Lancer la suite Playwright/visual regression si configurée.
3. Communiquer le changement à l’équipe (nouvelle base d’échelle).
