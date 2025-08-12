-- Add billing fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN billing_first_name TEXT,
ADD COLUMN billing_last_name TEXT,
ADD COLUMN billing_company TEXT,
ADD COLUMN billing_address TEXT,
ADD COLUMN billing_postal_code TEXT,
ADD COLUMN billing_country TEXT DEFAULT 'France',
ADD COLUMN billing_vat_number TEXT,
ADD COLUMN billing_siren TEXT;