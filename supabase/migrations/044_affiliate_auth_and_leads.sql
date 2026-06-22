-- Migration: 044_affiliate_auth_and_leads
-- Description: Adds password hashing for manually created affiliate accounts and links leads to affiliates.

ALTER TABLE public.affiliate_accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS submitted_by_affiliate_id UUID REFERENCES public.affiliate_accounts(id) ON DELETE SET NULL;
