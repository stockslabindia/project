-- 057_update_client_id_prefix.sql
-- Update client_id default constraint to format SL00000 (SL prefix followed by 5 digits)
ALTER TABLE public.profiles 
  ALTER COLUMN client_id SET DEFAULT ('SL' || lpad(floor(random() * 90000 + 10000)::text, 5, '0'));

-- Update existing client IDs with TDX- prefix to SL prefix
UPDATE public.profiles 
  SET client_id = REPLACE(client_id, 'TDX-', 'SL') 
  WHERE client_id LIKE 'TDX-%';
