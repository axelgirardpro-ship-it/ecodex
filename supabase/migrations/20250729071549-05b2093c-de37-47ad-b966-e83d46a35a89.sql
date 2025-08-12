-- Corriger l'enum pour inclure super_admin
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'super_admin';