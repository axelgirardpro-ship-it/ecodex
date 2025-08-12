-- Ajouter contrainte d'unicité sur email pour la table subscribers
ALTER TABLE public.subscribers ADD CONSTRAINT subscribers_email_unique UNIQUE (email);