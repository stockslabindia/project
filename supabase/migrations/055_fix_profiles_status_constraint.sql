-- ============================================================
-- Migration 055: Fix profiles status check constraint
-- ============================================================
-- Corrects the profiles_status_check constraint to include 'blocked'
-- and 'closed' which were dropped by a previous migration collision.
-- ============================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'blocked', 'closed', 'pending_otp'));
