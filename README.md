# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/0815560b-83d3-424c-9aae-2424e8359352

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/0815560b-83d3-424c-9aae-2424e8359352) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/0815560b-83d3-424c-9aae-2424e8359352) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Supabase – Génération des types (TypeScript)

Les types Supabase (tables, vues, RPC) sont générés dans `src/integrations/supabase/types.ts`.

- Prérequis: Supabase CLI installé
  - macOS: `brew install supabase/tap/supabase`
- Projet distant: exporter l’ID du projet Supabase
  - `export SUPABASE_PROJECT_ID=xxxxxxxxxxxxxxxxxxxx`

Commandes:

```bash
# Générer depuis le projet Supabase distant (nécessite SUPABASE_PROJECT_ID)
npm run gen:types

# Générer depuis une instance locale (ex. supabase start)
npm run gen:types:local
```

## Recherche Algolia – Architecture unifiée (sans legacy)

- Edge Function `algolia-search-proxy` centralise la construction des requêtes et applique la sécurité (teaser/blur) côté serveur.
- Frontend: `SearchProvider` + `UnifiedAlgoliaClient` via `proxySearchClient` (un seul client, pas de multi-index côté UI).
- Legacy supprimé: `AlgoliaFallback`, `FavorisSearchProvider`, paramètre `searchType`, constantes `FALLBACK_*`.
- Règle stricte requêtes: minimum 3 caractères côté UI et côté serveur, sauf si des facettes/filters sont présents pour initialiser les filtres.

## Internationalisation FR/EN

- Les routes disposent désormais d’un préfixe `/en` optionnel (ex : `/search` ↔ `/en/search`).
- Le `LanguageProvider` synchronise la langue via localStorage + cookie et déclenche un **hard refresh** sur `search`/`favoris` pour relancer InstantSearch.
- `buildLocalizedPath()` et `useSafeLanguage()` sont les primitives à utiliser pour générer des URLs ou récupérer la langue active.
- L’ensemble des pages et composants transverses s’appuie sur i18next (namespaces : `common`, `navbar`, `home`, `pages`, `search`, `quota`).
- Les champs Algolia sont requêtés dynamiquement (`Nom_fr`/`Nom_en`, `Secteur_fr`/`Secteur_en`, etc.) afin d’éviter tout doublon dans l’index et garantir des exports/copies localisés.

```tsx
import { buildLocalizedPath } from '@/lib/i18n/routing';
import { useSafeLanguage } from '@/hooks/useSafeLanguage';

const { language } = useSafeLanguage();
<Link to={buildLocalizedPath('/search', language)}>Search</Link>
```

Pour plus de détails (routing, mapping Algolia, nettoyage Supabase), voir `docs/architecture/search-i18n.md` et `docs/migration/2025-09-29_language_cleanup.md`.
