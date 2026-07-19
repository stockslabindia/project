-- Migration: 048_get_referral_stats
-- Performs PostgreSQL-level GROUP BY aggregation for referee trade counts and referral commission sums.

CREATE OR REPLACE FUNCTION public.get_referral_stats(p_referrer_id UUID)
RETURNS TABLE (
  referee_id UUID,
  full_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  trade_count BIGINT,
  commissions_sum NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS referee_id,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    COALESCE(p.status, 'active') AS status,
    p.created_at,
    COALESCE(COUNT(DISTINCT t.id), 0) AS trade_count,
    COALESCE(SUM(c.amount_earned), 0)::NUMERIC AS commissions_sum
  FROM public.profiles p
  LEFT JOIN public.trades t ON t.user_id = p.id
  LEFT JOIN public.referral_commissions c ON c.referee_id = p.id AND c.referrer_id = p_referrer_id
  WHERE p.referred_by = p_referrer_id
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
