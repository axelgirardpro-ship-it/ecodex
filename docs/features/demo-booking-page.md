# Page de prise de rendez-vous (/demo)

## Vue d'ensemble

La page `/demo` permet aux utilisateurs de prendre rendez-vous avec l'équipe commerciale, soit directement depuis la homepage, soit après l'expiration de leur période d'essai de 7 jours.

## Fonctionnalités

### 1. Accès à la page

La page est accessible via :
- **Homepage** : CTA "Prendre rendez-vous" dans le hero et dans la section finale
- **Trial expiré** : Redirection automatique depuis `/login` avec message contextuel
- **URL directe** : `/demo` (FR) ou `/en/demo` (EN)

### 2. Structure de la page

#### Navigation
- Identique à la homepage avec logo Ecodex
- Boutons "S'inscrire" et "Se connecter"
- Sélecteur de langue

#### Section principale (2 colonnes)

**Colonne gauche :**
- Titre principal : "Prenez rendez-vous avec notre équipe afin d'en savoir plus sur nos solutions"
- Sous-titre : "Notre équipe vous rappelle très rapidement !"
- 4 USP avec icônes CheckCircle :
  - Retrouvez les plus grandes bases françaises et internationales
  - Accédez à plus de 450k FE enrichis et structurés
  - Importez vos propres bases de données
  - Profitez de la puissance d'agents IA
- Section logos : "Accédez à la meilleure donnée carbone du marché"
- Grid de 14 logos des bases de données principales

**Colonne droite :**
- Formulaire Formbricks embedé (iframe)
- Hauteur : 80dvh avec scroll automatique
- Sticky sur desktop pour rester visible lors du scroll

#### Footer
- Identique à la homepage
- Logo, tagline, liens sociaux
- Liens légaux (Politique de confidentialité, Conditions d'utilisation, Cookies)

### 3. Gestion du trial expiré

Lorsqu'un utilisateur avec un trial expiré tente de se connecter :
1. Le système détecte l'expiration via `workspace_has_access` RPC
2. Redirection automatique vers `/demo?reason=trial_expired`
3. Affichage d'un message contextuel en haut de page :
   - FR : "Votre période d'essai de 7 jours est terminée. Prenez rendez-vous avec notre équipe..."
   - EN : "Your 7-day trial period has ended. Book a meeting with our team..."

### 4. Intégration Formbricks

Le formulaire est intégré via iframe avec :
- URL : `https://app.formbricks.com/s/cmh0d4dh50yobad019gak8a76?embed=true`
- Attributs de sécurité :
  - `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"`
  - `allow="clipboard-write"`
- Message fallback pour les navigateurs sans JavaScript

**Note** : L'iframe peut ne pas fonctionner en développement local en raison des restrictions CORS/CSP. Elle devrait fonctionner correctement en production.

## Modifications apportées

### Nouveaux fichiers

1. **`/src/pages/Demo.tsx`**
   - Page complète avec layout responsive
   - Gestion du message trial expiré via query param
   - Embed Formbricks sécurisé

2. **`/src/constants/datasets.ts`**
   - Export de `STANDARD_DATASET_LOGOS` (20 logos)
   - Export de `PREMIUM_DATASET_LOGOS` (3 logos)
   - Évite la duplication entre Index.tsx et Demo.tsx

### Fichiers modifiés

1. **`/src/App.tsx`**
   - Ajout de la route `/demo` pour FR
   - Ajout de la route `demo` pour EN
   - Route publique (accessible sans authentification)

2. **`/src/pages/Index.tsx`**
   - Import des constantes depuis `/src/constants/datasets.ts`
   - Hero CTA : "Tester pendant 7 jours" (au lieu de "Tester le moteur de recherche")
   - Hero CTA secondaire : "Prendre rendez-vous" → `/demo` (au lieu de "Se connecter")
   - Final CTA primaire : "Tester pendant 7 jours"
   - Final CTA secondaire : "Prendre rendez-vous" → `/demo` (au lieu de "Se connecter")

3. **`/src/pages/Login.tsx`**
   - Détection du paramètre `trial_expired=true`
   - Redirection automatique vers `/demo?reason=trial_expired`
   - Suppression du message d'alerte inline (désormais géré sur la page Demo)

4. **Traductions FR** (`/src/locales/fr/pages.json`)
   - Section `demo` complète (titre, subtitle, USPs, logos, trial expired, footer)
   - `hero.primaryCta` : "Tester pendant 7 jours"
   - `hero.bookDemo` : "Prendre rendez-vous"
   - `navbar.bookDemo` : "Prendre rendez-vous"
   - `finalCta.primary` : "Tester pendant 7 jours"
   - `finalCta.secondary` : "Prendre rendez-vous"
   - Mise à jour 255k/250k → **450k FE**

5. **Traductions EN** (`/src/locales/en/pages.json`)
   - Section `demo` complète (titre, subtitle, USPs, logos, trial expired, footer)
   - `hero.primaryCta` : "Try for 7 days"
   - `hero.bookDemo` : "Book a meeting"
   - `navbar.bookDemo` : "Book a meeting"
   - `finalCta.primary` : "Try for 7 days"
   - `finalCta.secondary` : "Book a meeting"
   - Mise à jour 255k/250k → **450k EF**

## URLs

- **FR** : `/demo`
- **EN** : `/en/demo`
- **Avec trial expiré** : `/demo?reason=trial_expired`

## Responsive

- Mobile : Layout en colonne unique, formulaire en bas
- Tablet : Layout en colonne unique
- Desktop : Layout 2 colonnes avec formulaire sticky

## Sécurité

- Page publique (pas d'authentification requise)
- Iframe sandboxée avec permissions minimales nécessaires
- Pas de données sensibles exposées
- Formulaire géré par Formbricks (plateforme tierce sécurisée)

## Tests recommandés

1. ✅ Accès direct à `/demo` et `/en/demo`
2. ✅ Clic sur "Prendre rendez-vous" depuis la homepage (hero et final CTA)
3. ✅ Trial expiré : vérifier la redirection et le message contextuel
4. ✅ Responsive : tester sur mobile, tablet et desktop
5. ✅ Formulaire : vérifier le chargement de l'iframe en production
6. ✅ Traductions : basculer entre FR et EN
7. ✅ Navigation : vérifier les liens vers signup/login depuis la navbar

