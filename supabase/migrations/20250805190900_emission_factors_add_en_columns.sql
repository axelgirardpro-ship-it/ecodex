-- Ajout des colonnes EN dans la table source unique
alter table public.emission_factors add column if not exists "Nom_en" text;
alter table public.emission_factors add column if not exists "Description_en" text;
alter table public.emission_factors add column if not exists "Commentaires_en" text;
alter table public.emission_factors add column if not exists "Secteur_en" text;
alter table public.emission_factors add column if not exists "Sous-secteur_en" text;
alter table public.emission_factors add column if not exists "Périmètre_en" text;
alter table public.emission_factors add column if not exists "Localisation_en" text;
alter table public.emission_factors add column if not exists "Unite_en" text;

