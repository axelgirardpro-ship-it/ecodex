# Architecture i18n & Search

## Langue

- `LanguageProvider` maintient la langue (`fr`/`en`), persiste l’info (localStorage/cookie) et force un **hard refresh** sur `/search` et `/favoris` lors du toggle.
- `buildLocalizedPath(path, lang)` construit les URLs localisées (`/en/...`).
- `useSafeLanguage()` offre un fallback FR si le provider n’est pas monté.
- Les routes principales (Index/Login/Signup/Search/Favoris/Import/Settings/Admin) passent par `LanguageLayout` pour garantir la synchro de langue à chaque préfixe.

## Algolia

- Toute requête passe par `SearchProvider`, qui injecte `query_language`, `remove_stop_words`, `ignore_plurals` sur le proxy `algolia-search-proxy`.
- `GetLocalizedValue(hit, frKey, enKey, fallback)` centralise la sélection des champs FR/EN.
- Mappages clés :
  - `Nom_fr` ↔ `Nom_en`
  - `Description_fr` ↔ `Description_en`
  - `Secteur_fr` ↔ `Secteur_en`
  - `Sous-secteur_fr` ↔ `Sous-secteur_en`
  - `Unite_fr` ↔ `Unite_en`
  - `Périmètre_fr` ↔ `Périmètre_en`
  - `Localisation_fr` ↔ `Localisation_en`
  - `Commentaires_fr` ↔ `Commentaires_en`
- `SearchFilters.tsx` expose deux listes (`FILTERS_FR`, `FILTERS_EN`), labels traduits (`Unit`).
- Les exports/copies (`useQuotaActions`) génèrent des CSV/TXT localisés.

## Supabase

- Colonnes `language`/`languages` supprimées (`emission_factors`, `fe_versions`, `data_imports`, `user_batch_algolia`, `emission_factors_all_search`).
- Fonctions `invalidate_latest_by_language*` retirées.
- `rebuild_emission_factors_all_search()` ne calcule plus `languages`; la vue `emission_factors_algolia` a été recréée sans ce champ.

## UI

- Search/Favoris : accordéon harmonisé (typo `font-light`, `text-muted-foreground`, markdown avec liens cliquables).
- `LanguageSwitcher` accessible dans la navbar ; CTA et toasts traduits via `useTranslation`.
- `AuthCallback`, `Login`, `Signup`, `Import`, `SimplifiedSettings` supportent FR/EN.

## Checklist intégration

1. Ajouter la langue aux routes via `buildLocalizedPath`.
2. Récupérer la langue active avec `useSafeLanguage` (pas `useLanguage` dans des hooks conditionnels).
3. Utiliser les helpers `getLocalizedValue` pour chaque champ Algolia.
4. Pour les exports/copier, convertir les `AlgoliaHit` via `mapHitToLocalizedFactor`.
5. Éviter toute dépendance à l’ancien champ `languages` (Supabase/Algolia).
