-- Nettoyage des données résiduelles uniquement

-- Supprimer toutes les traces de l'ancien compte a987ba76-4a59-4977-b5b4-7e1c48d77acf
DELETE FROM public.search_history WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.search_quotas WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.favorites WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.audit_logs WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.user_roles WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.users WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.workspaces WHERE owner_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';

-- Vérification du nettoyage
INSERT INTO public.audit_logs (user_id, action, details) VALUES
(gen_random_uuid(), 'cleanup_completed', 
'{"message": "Nettoyage des données résiduelles terminé", "user_cleaned": "a987ba76-4a59-4977-b5b4-7e1c48d77acf"}');