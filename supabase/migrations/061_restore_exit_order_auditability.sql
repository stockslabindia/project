-- Migration: 061_restore_exit_order_auditability.sql
-- Description: Restores exit order insertion for position closure RPCs and fixes closing side auditability.

-- 1. Add source_position_id column to orders table for linking exit orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source_position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL;

-- 2. Add partial unique index to prevent duplicate exit orders per position and tag
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_single_exit_per_position
ON public.orders(source_position_id, tag)
WHERE source_position_id IS NOT NULL;

-- 3. Re-create close_position_v2 with exit order insertion and referral bonus tracking
CREATE OR REPLACE FUNCTION public.close_position_v2(
  p_user_id UUID,
  p_position_id UUID,
  p_last_price NUMERIC,
  p_spread_pct NUMERIC,
  p_close_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_position RECORD;
  v_wallet RECORD;
  v_trade RECORD;
  v_exit_order RECORD;
  v_spread_amount NUMERIC;
  v_exit_price NUMERIC;
  v_exit_side TEXT;
  v_gross_pnl NUMERIC;
  v_charges NUMERIC;
  v_net_pnl NUMERIC;
  v_new_balance NUMERIC;
  v_trade_volume NUMERIC;
BEGIN
  -- A. Lock position
  SELECT * INTO v_position
  FROM public.positions
  WHERE id = p_position_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Position not found');
  END IF;

  IF v_position.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Position is not open (status: ' || v_position.status || ')');
  END IF;

  -- B. Lock wallet
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- C. Calculate exit price, gross/net PnL and exit side
  v_spread_amount := p_last_price * (COALESCE(p_spread_pct, 0) / 100);
  
  IF v_position.side = 'long' THEN
    v_exit_price := p_last_price - (v_spread_amount / 2);
    v_gross_pnl := (v_exit_price - v_position.entry_price) * v_position.quantity;
    v_exit_side := 'sell';
  ELSE
    v_exit_price := p_last_price + (v_spread_amount / 2);
    v_gross_pnl := (v_position.entry_price - v_exit_price) * v_position.quantity;
    v_exit_side := 'buy';
  END IF;
  
  v_exit_price := round(v_exit_price, 4);
  v_charges := (v_spread_amount * v_position.quantity * 0.01) + COALESCE(v_position.total_swap_fees, 0);
  v_net_pnl := v_gross_pnl - v_charges;

  -- D. Update position record
  UPDATE public.positions
  SET status = 'closed',
      current_price = v_exit_price,
      realized_pnl = v_net_pnl,
      close_reason = p_close_reason,
      closed_at = now()
  WHERE id = p_position_id
  RETURNING * INTO v_position;

  -- E. Insert trade record
  INSERT INTO public.trades (
    user_id, instrument_id, position_id, symbol, side, quantity,
    quantity_lots, quantity_units, entry_price, exit_price, gross_pnl, charges, net_pnl,
    spread_revenue, swap_revenue, routing, opened_at, closed_at
  ) VALUES (
    p_user_id, v_position.instrument_id, p_position_id, v_position.symbol,
    CASE WHEN v_position.side = 'long' THEN 'buy'::TEXT ELSE 'sell'::TEXT END,
    v_position.quantity, v_position.quantity_lots, COALESCE(v_position.quantity_units, v_position.quantity),
    v_position.entry_price, v_exit_price, v_gross_pnl, v_charges, v_net_pnl,
    v_spread_amount * v_position.quantity * 0.01, COALESCE(v_position.total_swap_fees, 0), v_position.routing, v_position.opened_at, now()
  ) RETURNING * INTO v_trade;

  -- F. Insert exit order record for auditability & Orders screen
  INSERT INTO public.orders (
    user_id, instrument_id, symbol, side, order_type, quantity,
    quantity_lots, quantity_units, lot_size, price, requested_price, executed_price,
    avg_fill_price, filled_quantity, status, placed_at, filled_at, product_type, tag, source_position_id
  ) VALUES (
    p_user_id, v_position.instrument_id, v_position.symbol,
    v_exit_side,
    'market'::TEXT,
    v_position.quantity,
    v_position.quantity_lots, COALESCE(v_position.quantity_units, v_position.quantity), COALESCE(v_position.lot_size, 1),
    v_exit_price, v_exit_price, v_exit_price, v_exit_price, v_position.quantity,
    'filled'::TEXT, now(), now(),
    COALESCE(v_position.product_type, 'intraday'), COALESCE(p_close_reason, 'manual close')::TEXT, p_position_id
  ) ON CONFLICT (source_position_id, tag) WHERE source_position_id IS NOT NULL DO NOTHING
  RETURNING * INTO v_exit_order;

  -- G. Update wallet balance and release margin
  v_new_balance := v_wallet.balance + v_net_pnl;
  UPDATE public.wallets
  SET balance = v_new_balance,
      used_margin = greatest(0, used_margin - v_position.margin_used)
  WHERE user_id = p_user_id;

  -- H. Insert wallet transaction for realizing PNL
  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, reference_id, reference_type, description
  ) VALUES (
    p_user_id,
    'trade_pnl'::TEXT,
    v_net_pnl,
    v_new_balance,
    p_position_id,
    'position',
    'Realized PNL for ' || upper(v_position.side) || ' ' || v_position.quantity::TEXT || ' ' || v_position.symbol || ' @ ' || v_exit_price::TEXT
  );

  -- I. Update Referral Signup Bonus Turnover (from 056)
  v_trade_volume := v_position.quantity * v_exit_price;
  PERFORM update_referral_signup_bonus_turnover(p_user_id, v_trade_volume);

  RETURN jsonb_build_object(
    'success', true,
    'position', to_jsonb(v_position),
    'trade', to_jsonb(v_trade),
    'exit_order', to_jsonb(v_exit_order),
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permissions for close_position_v2
REVOKE EXECUTE ON FUNCTION public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT) TO service_role;
