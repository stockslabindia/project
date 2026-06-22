-- Migration: 046_exit_orders_and_overnight_fixes
-- Description: Adds a 'tag' column to orders, and updates execute_market_order_v2, close_position_v2, close_position_atomic, and close_position_partial_v2.

-- 1. Add tag column to orders table if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tag TEXT;

-- 2. Drop and recreate execute_market_order_v2 to accept p_product_type
DROP FUNCTION IF EXISTS public.execute_market_order_v2(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.execute_market_order_v2(
  p_user_id UUID,
  p_instrument_id UUID,
  p_symbol TEXT,
  p_side TEXT,
  p_quantity NUMERIC,
  p_requested_price NUMERIC,
  p_executed_price NUMERIC,
  p_slippage_amount NUMERIC,
  p_spread_markup NUMERIC,
  p_execution_delay_ms INT,
  p_margin_required NUMERIC,
  p_stop_loss NUMERIC,
  p_take_profit NUMERIC,
  p_leverage NUMERIC,
  p_commission NUMERIC,
  p_product_type TEXT DEFAULT 'intraday'::text
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_order RECORD;
  v_position RECORD;
  v_new_balance NUMERIC;
  v_side_pos TEXT;
BEGIN
  -- 1. Lock wallet row and check margins
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Verify if available margin is sufficient
  IF v_wallet.balance - v_wallet.used_margin < (p_margin_required + p_commission) THEN
    RAISE EXCEPTION 'Insufficient margin. Available: %, Required: %',
      v_wallet.balance - v_wallet.used_margin, (p_margin_required + p_commission);
  END IF;

  -- 2. Insert order record
  INSERT INTO public.orders (
    user_id, instrument_id, symbol, side, order_type, quantity,
    requested_price, executed_price, filled_quantity, avg_fill_price,
    slippage_amount, spread_markup, execution_delay_ms, margin_required, margin_blocked,
    status, filled_at, product_type
  ) VALUES (
    p_user_id, p_instrument_id, p_symbol, p_side, 'market', p_quantity,
    p_requested_price, p_executed_price, p_quantity, p_executed_price,
    p_slippage_amount, p_spread_markup, p_execution_delay_ms, p_margin_required, p_margin_required,
    'filled', now(), COALESCE(p_product_type, 'intraday')
  ) RETURNING * INTO v_order;

  -- Determine position side
  IF p_side = 'buy' THEN
    v_side_pos := 'long';
  ELSE
    v_side_pos := 'short';
  END IF;

  -- 3. Insert position record
  INSERT INTO public.positions (
    user_id, instrument_id, symbol, order_id, side, quantity,
    entry_price, current_price, margin_used, leverage, stop_loss, take_profit, routing, product_type
  ) VALUES (
    p_user_id, p_instrument_id, p_symbol, v_order.id, v_side_pos, p_quantity,
    p_executed_price, p_requested_price, p_margin_required, p_leverage, p_stop_loss, p_take_profit, 'b_book', COALESCE(p_product_type, 'intraday')
  ) RETURNING * INTO v_position;

  -- 4. Update wallet (block margin + deduct commission)
  v_new_balance := v_wallet.balance - p_commission;
  UPDATE public.wallets
  SET used_margin = used_margin + p_margin_required,
      balance = v_new_balance
  WHERE user_id = p_user_id;

  -- 5. Insert commission transaction if > 0
  IF p_commission > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, reference_id, reference_type, description)
    VALUES (
      p_user_id, 'withdrawal', -p_commission, v_new_balance,
      v_order.id, 'order',
      'Commission for ' || upper(p_side) || ' ' || p_quantity::TEXT || ' ' || p_symbol || ' @ ' || p_executed_price::TEXT
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order', to_jsonb(v_order),
    'position', to_jsonb(v_position),
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regrant permissions
REVOKE EXECUTE ON FUNCTION public.execute_market_order_v2(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_market_order_v2(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_market_order_v2(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO service_role;


-- 3. Drop and recreate close_position_v2 to insert exit order
DROP FUNCTION IF EXISTS public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.close_position_v2(
  p_user_id UUID,
  p_position_id UUID,
  p_last_price NUMERIC,
  p_spread_pct NUMERIC,
  p_close_reason TEXT DEFAULT 'manual'::text
)
RETURNS JSONB AS $$
DECLARE
  v_position RECORD;
  v_wallet RECORD;
  v_exit_price NUMERIC;
  v_spread_amount NUMERIC;
  v_gross_pnl NUMERIC;
  v_charges NUMERIC;
  v_net_pnl NUMERIC;
  v_new_balance NUMERIC;
  v_trade RECORD;
  v_exit_side TEXT;
BEGIN
  -- A. Fetch and lock position
  SELECT * INTO v_position FROM public.positions 
  WHERE id = p_position_id AND user_id = p_user_id AND status = 'open' 
  FOR UPDATE;
  
  IF v_position IS NULL THEN
    RAISE EXCEPTION 'Open position not found';
  END IF;

  -- B. Fetch and lock wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- C. Calculate exit price and PNL
  v_spread_amount := p_last_price * (p_spread_pct / 100);
  
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
  v_charges := (v_spread_amount * v_position.quantity * 0.01) + v_position.total_swap_fees;
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
    entry_price, exit_price, gross_pnl, charges, net_pnl,
    spread_revenue, swap_revenue, routing, opened_at, closed_at
  ) VALUES (
    p_user_id, v_position.instrument_id, p_position_id, v_position.symbol,
    CASE WHEN v_position.side = 'long' THEN 'buy'::TEXT ELSE 'sell'::TEXT END,
    v_position.quantity, v_position.entry_price, v_exit_price, v_gross_pnl, v_charges, v_net_pnl,
    v_spread_amount * v_position.quantity * 0.01, v_position.total_swap_fees, v_position.routing, v_position.opened_at, now()
  ) RETURNING * INTO v_trade;

  -- F. Insert exit order record to show in Filled tab
  INSERT INTO public.orders (
    user_id, instrument_id, symbol, side, order_type, quantity,
    price, requested_price, executed_price, avg_fill_price, filled_quantity,
    status, placed_at, filled_at, product_type, tag
  ) VALUES (
    p_user_id, v_position.instrument_id, v_position.symbol,
    v_exit_side,
    'market'::TEXT,
    v_position.quantity,
    v_exit_price, v_exit_price, v_exit_price, v_exit_price, v_position.quantity,
    'filled'::TEXT, now(), now(),
    COALESCE(v_position.product_type, 'intraday'), 'position closed'::TEXT
  );

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

  RETURN jsonb_build_object(
    'success', true,
    'position', to_jsonb(v_position),
    'trade', to_jsonb(v_trade),
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regrant permissions
REVOKE EXECUTE ON FUNCTION public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_position_v2(UUID, UUID, NUMERIC, NUMERIC, TEXT) TO service_role;


-- 4. Drop and recreate close_position_atomic to insert exit order
DROP FUNCTION IF EXISTS public.close_position_atomic(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.close_position_atomic(
  p_user_id UUID,
  p_position_id UUID,
  p_exit_price NUMERIC,
  p_gross_pnl NUMERIC,
  p_net_pnl NUMERIC,
  p_charges NUMERIC,
  p_spread_revenue NUMERIC,
  p_swap_revenue NUMERIC,
  p_close_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_position RECORD;
  v_wallet RECORD;
  v_new_balance NUMERIC;
  v_trade RECORD;
  v_trade_side TEXT;
  v_exit_side TEXT;
BEGIN
  -- 1. Fetch and lock position
  SELECT * INTO v_position FROM public.positions 
  WHERE id = p_position_id AND user_id = p_user_id AND status = 'open' 
  FOR UPDATE;
  
  IF v_position IS NULL THEN
    RAISE EXCEPTION 'Open position not found';
  END IF;

  -- 2. Fetch and lock wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- 3. Update position record
  UPDATE public.positions
  SET status = 'closed',
      current_price = p_exit_price,
      realized_pnl = p_net_pnl,
      close_reason = p_close_reason,
      closed_at = now()
  WHERE id = p_position_id
  RETURNING * INTO v_position;

  -- 4. Determine trade side
  IF v_position.side = 'long' THEN
    v_trade_side := 'sell';
    v_exit_side := 'sell';
  ELSE
    v_trade_side := 'buy';
    v_exit_side := 'buy';
  END IF;

  -- 5. Insert trade record
  INSERT INTO public.trades (
    user_id, instrument_id, position_id, symbol, side, quantity,
    entry_price, exit_price, gross_pnl, charges, net_pnl,
    spread_revenue, swap_revenue, routing, opened_at, closed_at
  ) VALUES (
    p_user_id, v_position.instrument_id, p_position_id, v_position.symbol,
    v_trade_side, v_position.quantity, v_position.entry_price, p_exit_price,
    p_gross_pnl, p_charges, p_net_pnl,
    p_spread_revenue, p_swap_revenue, v_position.routing, v_position.opened_at, now()
  ) RETURNING * INTO v_trade;

  -- 6. Insert exit order record to show in Filled tab
  INSERT INTO public.orders (
    user_id, instrument_id, symbol, side, order_type, quantity,
    price, requested_price, executed_price, avg_fill_price, filled_quantity,
    status, placed_at, filled_at, product_type, tag
  ) VALUES (
    p_user_id, v_position.instrument_id, v_position.symbol,
    v_exit_side,
    'market'::TEXT,
    v_position.quantity,
    p_exit_price, p_exit_price, p_exit_price, p_exit_price, v_position.quantity,
    'filled'::TEXT, now(), now(),
    COALESCE(v_position.product_type, 'intraday'), 'position closed'::TEXT
  );

  -- 7. Update wallet balance and release margin
  v_new_balance := v_wallet.balance + p_net_pnl;
  UPDATE public.wallets
  SET balance = v_new_balance,
      used_margin = greatest(0, used_margin - v_position.margin_used)
  WHERE user_id = p_user_id;

  -- 8. Insert wallet transaction for realizing PNL
  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, reference_id, reference_type, description
  ) VALUES (
    p_user_id,
    'trade_pnl'::TEXT,
    p_net_pnl,
    v_new_balance,
    p_position_id,
    'position',
    'Realized PNL for ' || upper(v_position.side) || ' ' || v_position.quantity::TEXT || ' ' || v_position.symbol || ' @ ' || p_exit_price::TEXT
  );

  RETURN jsonb_build_object(
    'success', true,
    'position', to_jsonb(v_position),
    'trade', to_jsonb(v_trade),
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regrant permissions
REVOKE EXECUTE ON FUNCTION public.close_position_atomic(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_position_atomic(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_position_atomic(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO service_role;


-- 5. Drop and recreate close_position_partial_v2 to insert exit order
DROP FUNCTION IF EXISTS public.close_position_partial_v2(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.close_position_partial_v2(
  p_user_id UUID,
  p_position_id UUID,
  p_last_price NUMERIC,
  p_spread_pct NUMERIC,
  p_exit_qty NUMERIC DEFAULT NULL::numeric,
  p_close_reason TEXT DEFAULT 'manual'::text
)
RETURNS JSONB AS $$
DECLARE
  v_position RECORD;
  v_wallet RECORD;
  v_exit_price NUMERIC;
  v_spread_amount NUMERIC;
  v_gross_pnl NUMERIC;
  v_charges NUMERIC;
  v_net_pnl NUMERIC;
  v_new_balance NUMERIC;
  v_trade RECORD;
  v_margin_released NUMERIC;
  v_swap_fee_realized NUMERIC;
  v_target_exit_qty NUMERIC;
  v_original_qty NUMERIC;
  v_exit_side TEXT;
BEGIN
  -- 1. Fetch and lock position
  SELECT * INTO v_position FROM public.positions 
  WHERE id = p_position_id AND user_id = p_user_id AND status = 'open' 
  FOR UPDATE;
  
  IF v_position IS NULL THEN
    RAISE EXCEPTION 'Open position not found';
  END IF;

  -- 2. Fetch and lock wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  v_original_qty := v_position.quantity;

  -- 3. Determine quantity to close
  v_target_exit_qty := COALESCE(p_exit_qty, v_position.quantity);
  IF v_target_exit_qty <= 0 THEN
    RAISE EXCEPTION 'Invalid exit quantity';
  END IF;
  IF v_target_exit_qty > v_position.quantity THEN
    v_target_exit_qty := v_position.quantity;
  END IF;

  -- 4. Calculate exit price and PNL for this quantity
  v_spread_amount := p_last_price * (p_spread_pct / 100);
  
  IF v_position.side = 'long' THEN
    v_exit_price := p_last_price - (v_spread_amount / 2);
    v_gross_pnl := (v_exit_price - v_position.entry_price) * v_target_exit_qty;
    v_exit_side := 'sell';
  ELSE
    v_exit_price := p_last_price + (v_spread_amount / 2);
    v_gross_pnl := (v_position.entry_price - v_exit_price) * v_target_exit_qty;
    v_exit_side := 'buy';
  END IF;
  
  v_exit_price := round(v_exit_price, 4);
  v_swap_fee_realized := 0;
  v_charges := 0; 
  v_net_pnl := v_gross_pnl - v_charges;

  -- Margin to release: proportional
  v_margin_released := (v_position.margin_used * (v_target_exit_qty / v_position.quantity));

  -- 5. Update position record
  IF v_target_exit_qty = v_position.quantity THEN
    -- Close position fully
    UPDATE public.positions
    SET status = 'closed',
        quantity = quantity - v_target_exit_qty,
        current_price = v_exit_price,
        realized_pnl = realized_pnl + v_net_pnl,
        unrealized_pnl = 0,
        margin_used = 0,
        total_swap_fees = total_swap_fees - v_swap_fee_realized,
        close_reason = p_close_reason,
        closed_at = now()
    WHERE id = p_position_id
    RETURNING * INTO v_position;
  ELSE
    -- Close position partially (keep status open, update quantity & margin)
    UPDATE public.positions
    SET quantity = quantity - v_target_exit_qty,
        margin_used = margin_used - v_margin_released,
        total_swap_fees = total_swap_fees - v_swap_fee_realized,
        realized_pnl = realized_pnl + v_net_pnl,
        current_price = p_last_price
    WHERE id = p_position_id
    RETURNING * INTO v_position;
  END IF;

  -- 6. Insert trade record for the exited portion
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

  -- 7. Insert exit order record to show in Filled tab
  INSERT INTO public.orders (
    user_id, instrument_id, symbol, side, order_type, quantity,
    price, requested_price, executed_price, avg_fill_price, filled_quantity,
    status, placed_at, filled_at, product_type, tag
  ) VALUES (
    p_user_id, v_position.instrument_id, v_position.symbol,
    v_exit_side,
    'market'::TEXT,
    v_target_exit_qty,
    v_exit_price, v_exit_price, v_exit_price, v_exit_price, v_target_exit_qty,
    'filled'::TEXT, now(), now(),
    COALESCE(v_position.product_type, 'intraday'), 'position closed'::TEXT
  );

  -- 8. Update wallet balance and release margin
  v_new_balance := v_wallet.balance + v_net_pnl;
  UPDATE public.wallets
  SET balance = v_new_balance,
      used_margin = greatest(0, used_margin - v_margin_released)
  WHERE user_id = p_user_id;

  -- 9. Insert wallet transaction for realizing PNL
  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, reference_id, reference_type, description
  ) VALUES (
    p_user_id,
    'trade_pnl'::TEXT,
    v_net_pnl,
    v_new_balance,
    p_position_id,
    'position',
    'Realized partial PNL for ' || upper(v_position.side) || ' ' || v_target_exit_qty::TEXT || '/' || v_original_qty::TEXT || ' ' || v_position.symbol || ' @ ' || v_exit_price::TEXT
  );

  RETURN jsonb_build_object(
    'success', true,
    'position', to_jsonb(v_position),
    'trade', to_jsonb(v_trade),
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regrant permissions
REVOKE EXECUTE ON FUNCTION public.close_position_partial_v2(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_position_partial_v2(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_position_partial_v2(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO service_role;
