-- ============================================================
-- Stocks Lab — Migration 048: Restore Missing Database RPCs
-- ============================================================

-- 1. release_margin
DROP FUNCTION IF EXISTS public.release_margin(uuid, numeric);
CREATE OR REPLACE FUNCTION public.release_margin(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_used NUMERIC;
  v_wallet RECORD;
BEGIN
  -- Lock wallet to prevent race condition
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  UPDATE public.wallets
  SET used_margin = GREATEST(0, used_margin - p_amount),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING used_margin INTO v_new_used;

  RETURN jsonb_build_object('success', true, 'used_margin', v_new_used);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_margin(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_margin(uuid, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_margin(uuid, numeric) TO service_role;


-- 2. get_profile_by_identifier
DROP FUNCTION IF EXISTS public.get_profile_by_identifier(text);
CREATE OR REPLACE FUNCTION public.get_profile_by_identifier(
  p_identifier TEXT
)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.profiles
  WHERE email = p_identifier 
     OR phone = p_identifier 
     OR client_id = p_identifier;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_by_identifier(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_by_identifier(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_identifier(text) TO service_role;


-- 3. update_login_stats
DROP FUNCTION IF EXISTS public.update_login_stats(uuid);
CREATE OR REPLACE FUNCTION public.update_login_stats(
  p_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_login_at = now(),
      login_count = login_count + 1
  WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_login_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_login_stats(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_login_stats(uuid) TO service_role;


-- 4. get_profile_by_id
DROP FUNCTION IF EXISTS public.get_profile_by_id(uuid);
CREATE OR REPLACE FUNCTION public.get_profile_by_id(
  p_id UUID
)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.profiles WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_by_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_by_id(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(uuid) TO service_role;


-- 5. create_user_profile
DROP FUNCTION IF EXISTS public.create_user_profile(uuid, text, text, text, uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_referred_by UUID DEFAULT NULL,
  p_affiliate_id UUID DEFAULT NULL,
  p_affiliate_code_used TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    referred_by,
    affiliate_id,
    affiliate_code_used,
    status
  )
  VALUES (
    p_id,
    p_full_name,
    p_email,
    p_phone,
    p_referred_by,
    p_affiliate_id,
    p_affiliate_code_used,
    'pending_otp'
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

-- Note: create_user_profile is called from client during signup verification, so it needs to be executable by public/anon/authenticated
GRANT EXECUTE ON FUNCTION public.create_user_profile(uuid, text, text, text, uuid, uuid, text) TO anon, authenticated, service_role;


-- 6. get_active_connections
DROP FUNCTION IF EXISTS public.get_active_connections();
CREATE OR REPLACE FUNCTION public.get_active_connections()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM pg_stat_activity;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_connections() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_connections() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_connections() TO service_role;


-- 7. refund_wallet
DROP FUNCTION IF EXISTS public.refund_wallet(uuid, numeric, uuid, text, text, uuid);
CREATE OR REPLACE FUNCTION public.refund_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_id UUID,
  p_reference_type TEXT,
  p_description TEXT,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE public.wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  -- Ledger entry of type 'refund'
  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, reference_id, reference_type, description, admin_id)
  VALUES (p_user_id, 'refund', p_amount, v_new_balance, p_reference_id, p_reference_type, p_description, p_admin_id);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_wallet(uuid, numeric, uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_wallet(uuid, numeric, uuid, text, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_wallet(uuid, numeric, uuid, text, text, uuid) TO service_role;
