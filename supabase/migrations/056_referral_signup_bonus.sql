-- ============================================================
-- StocksLab Trading Platform — Migration 056
-- Referral Signup Bonus: 10% of first deposit (cap ₹3,500)
-- Turnover: 7x first-deposit-amount → auto-unlock to main wallet
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. WALLET SCHEMA: Track bonus metadata so subsequent deposits
--    don't accidentally inflate the turnover target
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS bonus_first_deposit_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_source               TEXT          DEFAULT NULL;

-- ──────────────────────────────────────────────────────────────
-- 2. REFERRAL_REWARD_CONFIG: Admin-configurable bonus rules
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.referral_reward_config
  ADD COLUMN IF NOT EXISTS referral_signup_bonus_pct  NUMERIC(6,2) DEFAULT 10,   -- 10% of first deposit
  ADD COLUMN IF NOT EXISTS referral_signup_bonus_cap  NUMERIC(12,2) DEFAULT 3500, -- max ₹3,500
  ADD COLUMN IF NOT EXISTS referral_turnover_multiplier NUMERIC(6,2) DEFAULT 7;  -- 7x first deposit amount

-- Ensure the single config row has sensible defaults
UPDATE public.referral_reward_config
SET
  referral_signup_bonus_pct      = COALESCE(referral_signup_bonus_pct, 10),
  referral_signup_bonus_cap      = COALESCE(referral_signup_bonus_cap, 3500),
  referral_turnover_multiplier   = COALESCE(referral_turnover_multiplier, 7)
WHERE id = 1;

-- ──────────────────────────────────────────────────────────────
-- 3. FUNCTION: update_bonus_turnover
--    Called after every trade close to accumulate notional value.
--    When bonus_turnover_completed >= bonus_turnover_required,
--    the bonus is automatically moved to the main balance.
--
--    p_user_id       — trader user id
--    p_trade_notional — entry_price × quantity of the closed trade
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_bonus_turnover(
  p_user_id        UUID,
  p_trade_notional NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet         public.wallets%ROWTYPE;
  v_new_completed  NUMERIC;
  v_unlocked       BOOLEAN := false;
  v_bonus_amount   NUMERIC := 0;
  v_new_balance    NUMERIC;
BEGIN
  -- Lock the wallet row
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Only act if there is an active bonus with remaining turnover
  IF v_wallet.bonus_balance IS NULL OR v_wallet.bonus_balance <= 0 THEN
    RETURN jsonb_build_object('success', true, 'bonus_active', false);
  END IF;

  IF v_wallet.bonus_turnover_required IS NULL OR v_wallet.bonus_turnover_required <= 0 THEN
    RETURN jsonb_build_object('success', true, 'bonus_active', false);
  END IF;

  IF COALESCE(v_wallet.bonus_turnover_completed, 0) >= v_wallet.bonus_turnover_required THEN
    -- Already completed, skip (idempotent safety)
    RETURN jsonb_build_object('success', true, 'bonus_active', false, 'already_completed', true);
  END IF;

  -- Accumulate completed turnover
  v_new_completed := COALESCE(v_wallet.bonus_turnover_completed, 0) + p_trade_notional;

  -- Check if threshold is now reached
  IF v_new_completed >= v_wallet.bonus_turnover_required THEN
    -- ── BONUS UNLOCKED ──
    v_unlocked     := true;
    v_bonus_amount := v_wallet.bonus_balance;
    v_new_balance  := v_wallet.balance + v_bonus_amount;

    UPDATE public.wallets
    SET
      balance                 = v_new_balance,
      bonus_balance           = 0,
      bonus_turnover_completed = v_wallet.bonus_turnover_required, -- cap at required
      bonus_turnover_required = 0,
      bonus_first_deposit_amount = 0,
      bonus_source            = NULL,
      bonus_locked            = false,
      updated_at              = now()
    WHERE user_id = p_user_id;

    -- Ledger entry: bonus transferred to main wallet
    INSERT INTO public.wallet_transactions (
      user_id, type, amount, balance_after,
      reference_type, description
    ) VALUES (
      p_user_id,
      'bonus',
      v_bonus_amount,
      v_new_balance,
      'bonus_unlocked',
      '🎁 Referral bonus unlocked! ₹' || v_bonus_amount::TEXT || ' transferred to your main wallet.'
    );
  ELSE
    -- ── TURNOVER PROGRESSING ──
    UPDATE public.wallets
    SET
      bonus_turnover_completed = v_new_completed,
      updated_at               = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'bonus_active',     true,
    'unlocked',         v_unlocked,
    'bonus_amount',     v_bonus_amount,
    'completed',        CASE WHEN v_unlocked THEN v_wallet.bonus_turnover_required ELSE v_new_completed END,
    'required',         v_wallet.bonus_turnover_required
  );
END;
$$;

-- Only service_role (backend) may call this
REVOKE EXECUTE ON FUNCTION public.update_bonus_turnover(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_bonus_turnover(UUID, NUMERIC) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_bonus_turnover(UUID, NUMERIC) TO service_role;


-- ──────────────────────────────────────────────────────────────
-- 4. INJECT turnover tracking into all three close_position RPCs
--    We add a call to update_bonus_turnover AFTER the balance
--    update in each function.
-- ──────────────────────────────────────────────────────────────

-- 4a. close_position_v2 (manual/liquidation)
CREATE OR REPLACE FUNCTION public.close_position_v2(
  p_user_id      UUID,
  p_position_id  UUID,
  p_last_price   NUMERIC,
  p_spread_pct   NUMERIC,
  p_close_reason TEXT DEFAULT 'manual'
)
RETURNS JSONB AS $$
DECLARE
  v_position   RECORD;
  v_wallet     RECORD;
  v_exit_price NUMERIC;
  v_spread_amt NUMERIC;
  v_gross_pnl  NUMERIC;
  v_charges    NUMERIC;
  v_net_pnl    NUMERIC;
  v_new_balance NUMERIC;
  v_trade      RECORD;
  v_notional   NUMERIC;
BEGIN
  SELECT * INTO v_position FROM public.positions
  WHERE id = p_position_id AND user_id = p_user_id AND status = 'open'
  FOR UPDATE;
  IF v_position IS NULL THEN RAISE EXCEPTION 'Open position not found'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  v_spread_amt := p_last_price * (p_spread_pct / 100);
  IF v_position.side = 'long' THEN
    v_exit_price := p_last_price - (v_spread_amt / 2);
    v_gross_pnl  := (v_exit_price - v_position.entry_price) * v_position.quantity;
  ELSE
    v_exit_price := p_last_price + (v_spread_amt / 2);
    v_gross_pnl  := (v_position.entry_price - v_exit_price) * v_position.quantity;
  END IF;
  v_exit_price := round(v_exit_price, 4);
  v_charges    := (v_spread_amt * v_position.quantity * 0.01) + v_position.total_swap_fees;
  v_net_pnl    := v_gross_pnl - v_charges;

  -- Notional value of this trade (for turnover tracking)
  v_notional := v_position.entry_price * v_position.quantity;

  UPDATE public.positions
  SET status = 'closed', current_price = v_exit_price, realized_pnl = v_net_pnl,
      close_reason = p_close_reason, closed_at = now()
  WHERE id = p_position_id
  RETURNING * INTO v_position;

  INSERT INTO public.trades (
    user_id, instrument_id, position_id, symbol, side, quantity,
    entry_price, exit_price, gross_pnl, charges, net_pnl,
    spread_revenue, swap_revenue, routing, opened_at, closed_at
  ) VALUES (
    p_user_id, v_position.instrument_id, p_position_id, v_position.symbol,
    CASE WHEN v_position.side = 'long' THEN 'buy'::TEXT ELSE 'sell'::TEXT END,
    v_position.quantity, v_position.entry_price, v_exit_price, v_gross_pnl, v_charges, v_net_pnl,
    v_spread_amt * v_position.quantity * 0.01, v_position.total_swap_fees,
    v_position.routing, v_position.opened_at, now()
  ) RETURNING * INTO v_trade;

  v_new_balance := v_wallet.balance + v_net_pnl;
  UPDATE public.wallets
  SET balance    = v_new_balance,
      used_margin = greatest(0, used_margin - v_position.margin_used)
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, reference_id, reference_type, description
  ) VALUES (
    p_user_id, 'trade_pnl'::TEXT, v_net_pnl, v_new_balance, p_position_id, 'position',
    'Realized PNL for ' || upper(v_position.side) || ' ' || v_position.quantity::TEXT ||
    ' ' || v_position.symbol || ' @ ' || v_exit_price::TEXT
  );

  -- Bonus turnover tracking (fire-and-forget; ignore errors)
  BEGIN
    PERFORM public.update_bonus_turnover(p_user_id, v_notional);
  EXCEPTION WHEN OTHERS THEN
    -- Non-fatal: log but don't fail the close
    RAISE WARNING 'update_bonus_turnover failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true, 'position', to_jsonb(v_position), 'trade', to_jsonb(v_trade), 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4b. close_position_atomic
CREATE OR REPLACE FUNCTION public.close_position_atomic(
  p_user_id        UUID,
  p_position_id    UUID,
  p_exit_price     NUMERIC,
  p_gross_pnl      NUMERIC,
  p_net_pnl        NUMERIC,
  p_charges        NUMERIC,
  p_spread_revenue NUMERIC,
  p_swap_revenue   NUMERIC,
  p_close_reason   TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_position    RECORD;
  v_wallet      RECORD;
  v_new_balance NUMERIC;
  v_trade       RECORD;
  v_trade_side  TEXT;
  v_notional    NUMERIC;
BEGIN
  SELECT * INTO v_position FROM public.positions
  WHERE id = p_position_id AND user_id = p_user_id AND status = 'open'
  FOR UPDATE;
  IF v_position IS NULL THEN RAISE EXCEPTION 'Open position not found'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  -- Notional value
  v_notional := v_position.entry_price * v_position.quantity;

  UPDATE public.positions
  SET status = 'closed', current_price = p_exit_price, realized_pnl = p_net_pnl,
      close_reason = p_close_reason, closed_at = now()
  WHERE id = p_position_id
  RETURNING * INTO v_position;

  v_trade_side := CASE WHEN v_position.side = 'long' THEN 'sell' ELSE 'buy' END;

  INSERT INTO public.trades (
    user_id, instrument_id, position_id, symbol, side, quantity,
    entry_price, exit_price, gross_pnl, charges, net_pnl,
    spread_revenue, swap_revenue, routing, opened_at, closed_at
  ) VALUES (
    p_user_id, v_position.instrument_id, p_position_id, v_position.symbol,
    v_trade_side, v_position.quantity, v_position.entry_price, p_exit_price,
    p_gross_pnl, p_charges, p_net_pnl, p_spread_revenue, p_swap_revenue,
    v_position.routing, v_position.opened_at, now()
  ) RETURNING * INTO v_trade;

  v_new_balance := v_wallet.balance + p_net_pnl;
  UPDATE public.wallets
  SET balance    = v_new_balance,
      used_margin = greatest(0, used_margin - v_position.margin_used)
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, reference_id, reference_type, description
  ) VALUES (
    p_user_id, 'trade_pnl'::TEXT, p_net_pnl, v_new_balance, p_position_id, 'position',
    'Realized PNL for ' || upper(v_position.side) || ' ' || v_position.quantity::TEXT ||
    ' ' || v_position.symbol || ' @ ' || p_exit_price::TEXT
  );

  -- Bonus turnover tracking
  BEGIN
    PERFORM public.update_bonus_turnover(p_user_id, v_notional);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_bonus_turnover failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true, 'position', to_jsonb(v_position), 'trade', to_jsonb(v_trade), 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4c. close_position_partial_v2
CREATE OR REPLACE FUNCTION public.close_position_partial_v2(
  p_user_id      UUID,
  p_position_id  UUID,
  p_last_price   NUMERIC,
  p_spread_pct   NUMERIC,
  p_exit_qty     NUMERIC  DEFAULT NULL::numeric,
  p_close_reason TEXT     DEFAULT 'manual'::text
)
RETURNS JSONB AS $$
DECLARE
  v_position        RECORD;
  v_wallet          RECORD;
  v_exit_price      NUMERIC;
  v_spread_amount   NUMERIC;
  v_gross_pnl       NUMERIC;
  v_charges         NUMERIC;
  v_net_pnl         NUMERIC;
  v_new_balance     NUMERIC;
  v_trade           RECORD;
  v_margin_released NUMERIC;
  v_swap_fee_realized NUMERIC;
  v_target_exit_qty NUMERIC;
  v_original_qty    NUMERIC;
  v_notional        NUMERIC;
BEGIN
  SELECT * INTO v_position FROM public.positions
  WHERE id = p_position_id AND user_id = p_user_id AND status = 'open'
  FOR UPDATE;
  IF v_position IS NULL THEN RAISE EXCEPTION 'Open position not found'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  v_original_qty     := v_position.quantity;
  v_target_exit_qty  := COALESCE(p_exit_qty, v_position.quantity);
  IF v_target_exit_qty <= 0 THEN RAISE EXCEPTION 'Invalid exit quantity'; END IF;
  IF v_target_exit_qty > v_position.quantity THEN v_target_exit_qty := v_position.quantity; END IF;

  v_spread_amount := p_last_price * (p_spread_pct / 100);
  IF v_position.side = 'long' THEN
    v_exit_price := p_last_price - (v_spread_amount / 2);
    v_gross_pnl  := (v_exit_price - v_position.entry_price) * v_target_exit_qty;
  ELSE
    v_exit_price := p_last_price + (v_spread_amount / 2);
    v_gross_pnl  := (v_position.entry_price - v_exit_price) * v_target_exit_qty;
  END IF;
  v_exit_price        := round(v_exit_price, 4);
  v_swap_fee_realized := 0;
  v_charges           := 0;
  v_net_pnl           := v_gross_pnl - v_charges;
  v_margin_released   := (v_position.margin_used * (v_target_exit_qty / v_position.quantity));

  -- Notional for the exited portion only
  v_notional := v_position.entry_price * v_target_exit_qty;

  IF v_target_exit_qty = v_position.quantity THEN
    UPDATE public.positions
    SET status = 'closed', quantity = quantity - v_target_exit_qty, current_price = v_exit_price,
        realized_pnl = realized_pnl + v_net_pnl, unrealized_pnl = 0, margin_used = 0,
        total_swap_fees = total_swap_fees - v_swap_fee_realized,
        close_reason = p_close_reason, closed_at = now()
    WHERE id = p_position_id RETURNING * INTO v_position;
  ELSE
    UPDATE public.positions
    SET quantity = quantity - v_target_exit_qty, margin_used = margin_used - v_margin_released,
        total_swap_fees = total_swap_fees - v_swap_fee_realized,
        realized_pnl = realized_pnl + v_net_pnl, current_price = p_last_price
    WHERE id = p_position_id RETURNING * INTO v_position;
  END IF;

  INSERT INTO public.trades (
    user_id, instrument_id, position_id, symbol, side, quantity,
    entry_price, exit_price, gross_pnl, charges, net_pnl,
    spread_revenue, swap_revenue, routing, opened_at, closed_at
  ) VALUES (
    p_user_id, v_position.instrument_id, p_position_id, v_position.symbol,
    CASE WHEN v_position.side = 'long' THEN 'buy'::TEXT ELSE 'sell'::TEXT END,
    v_target_exit_qty, v_position.entry_price, v_exit_price, v_gross_pnl, v_charges, v_net_pnl,
    0, v_swap_fee_realized, v_position.routing, v_position.opened_at, now()
  ) RETURNING * INTO v_trade;

  v_new_balance := v_wallet.balance + v_net_pnl;
  UPDATE public.wallets
  SET balance    = v_new_balance,
      used_margin = greatest(0, used_margin - v_margin_released)
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, reference_id, reference_type, description
  ) VALUES (
    p_user_id, 'trade_pnl'::TEXT, v_net_pnl, v_new_balance, p_position_id, 'position',
    'Realized partial PNL for ' || upper(v_position.side) || ' ' || v_target_exit_qty::TEXT ||
    '/' || v_original_qty::TEXT || ' ' || v_position.symbol || ' @ ' || v_exit_price::TEXT
  );

  -- Bonus turnover tracking
  BEGIN
    PERFORM public.update_bonus_turnover(p_user_id, v_notional);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_bonus_turnover failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true, 'position', to_jsonb(v_position), 'trade', to_jsonb(v_trade), 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
