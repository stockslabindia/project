-- 058_dabba_affiliate_model.sql
-- Migration for Dabba Affiliate Model: 15% uncapped deposit commission (capped ₹5000 per deposit), 10% Weekly Net Loss Share

ALTER TABLE public.referral_reward_config 
  ADD COLUMN IF NOT EXISTS affiliate_deposit_commission_pct NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS affiliate_deposit_commission_cap NUMERIC(12,2) DEFAULT 5000.00,
  ADD COLUMN IF NOT EXISTS affiliate_net_loss_share_pct NUMERIC(5,2) DEFAULT 10.00;

ALTER TABLE public.affiliate_accounts
  ADD COLUMN IF NOT EXISTS deposit_commission_pct NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS deposit_commission_cap NUMERIC(12,2) DEFAULT 5000.00,
  ADD COLUMN IF NOT EXISTS net_loss_share_pct NUMERIC(5,2) DEFAULT 10.00;

-- Update constraint on affiliate_commissions to allow 'net_loss_share'
ALTER TABLE public.affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_commission_type_check;
ALTER TABLE public.affiliate_commissions ADD CONSTRAINT affiliate_commissions_commission_type_check 
  CHECK (commission_type IN ('deposit', 'trade', 'net_loss_share'));

UPDATE public.referral_reward_config SET 
  affiliate_deposit_commission_pct = 15.00,
  affiliate_deposit_commission_cap = 5000.00,
  affiliate_net_loss_share_pct = 10.00
WHERE id = 1;

UPDATE public.affiliate_accounts SET
  deposit_commission_pct = 15.00,
  deposit_commission_cap = 5000.00,
  net_loss_share_pct = 10.00;
