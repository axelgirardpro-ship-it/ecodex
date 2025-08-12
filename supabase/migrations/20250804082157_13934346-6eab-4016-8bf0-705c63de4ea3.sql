-- Forcer le changement de mot de passe pour l'utilisateur admin
-- Note: Utilisation des fonctions Supabase Auth pour changer le mot de passe

-- Mettre à jour le mot de passe en utilisant la fonction crypt de Supabase
UPDATE auth.users 
SET 
  encrypted_password = crypt('Ax3l!D3v@2025#EcoS', gen_salt('bf')),
  updated_at = now()
WHERE email = 'axelgirard.pro@gmail.com';

-- Optionnel: Marquer l'email comme confirmé si ce n'est pas déjà fait
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  confirmation_sent_at = now()
WHERE email = 'axelgirard.pro@gmail.com' 
AND email_confirmed_at IS NULL;