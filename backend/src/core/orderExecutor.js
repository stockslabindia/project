const { supabaseAdmin } = require('../config/supabase');
const { getIO } = require('../ws/socketServer');
const { updateExposure } = require('./risk/validator');
const { getDynamicMarginRequired } = require('./risk/marginCalculator');

/**
 * Fast-path Synchronous Market Order Executor
 * Runs in the API request thread. Bypasses BullMQ for instant execution.
 */
async function executeMarketOrderSync(data) {
  const {
    userId,
    symbol,
    side,
    quantity,
    instrumentId,
    instrument,
    marginRequired,
    executionPrice,
    referencePrice,
    spreadAmount,
    executionDelay,
    stopLoss,
    takeProfit,
    isBracketOrder,
    productType,
    bidPrice,
    askPrice,
    restrictions: preloadedRestrictions, // Pre-fetched by the caller to avoid duplicate lookup
  } = data;

  const { getClientRestrictions } = require('./risk/clientRestrictions');
  // If the caller already fetched restrictions, reuse them; otherwise fetch now.
  const restrictions = preloadedRestrictions !== undefined
    ? preloadedRestrictions
    : await getClientRestrictions(userId);
  const multiplier = (restrictions && restrictions.leverage_multiplier) ? parseFloat(restrictions.leverage_multiplier) : 1.0;
  
  const dynamicMarginRequiredPct = getDynamicMarginRequired(instrument, productType || 'intraday');
  const leverage = (100 / (dynamicMarginRequiredPct || 10)) * multiplier;
  const commission = 0; // Brokerage set to 0


  let orderRecord = null;
  let positionRecord = null;
  let newBalance = null;

  // ── Step 1: Attempt Atomic Execution via Supabase RPC ──
  try {
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('execute_market_order_v2', {
      p_user_id: userId,
      p_instrument_id: instrumentId,
      p_symbol: symbol,
      p_side: side,
      p_quantity: quantity,
      p_requested_price: referencePrice,
      p_executed_price: executionPrice,
      p_slippage_amount: Math.abs(executionPrice - (side === 'buy' ? askPrice : bidPrice)),
      p_spread_markup: spreadAmount,
      p_execution_delay_ms: executionDelay,
      p_margin_required: marginRequired,
      p_stop_loss: stopLoss || null,
      p_take_profit: takeProfit || null,
      p_leverage: leverage,
      p_commission: commission,
      p_product_type: productType || 'intraday'
    });

    if (rpcErr) {
      console.warn('RPC execute_market_order_v2 failed, falling back to multi-step execution. Error:', rpcErr.message);
      throw rpcErr; // Trigger fallback
    }

    if (rpcRes && rpcRes.success) {
      orderRecord = rpcRes.order;
      positionRecord = rpcRes.position;
      newBalance = rpcRes.new_balance;
      console.log(`⚡ Fast-path execution succeeded via RPC for ${symbol} order [${orderRecord.id}]`);
    } else {
      throw new Error('RPC response indicated failure');
    }
  } catch (err) {
    // ── Step 2: Fallback Multi-step Execution ──
    console.log(`⚠️ Falling back to multi-step order execution for user ${userId} and symbol ${symbol}`);

    // A. Block Margin
    const { error: marginErr } = await supabaseAdmin.rpc('block_margin', {
      p_user_id: userId,
      p_margin_amount: marginRequired,
    });

    if (marginErr) {
      throw new Error('Fallback failed: Insufficient margin: ' + marginErr.message);
    }

    const isOptions = instrument?.segment === 'fo_options' || (symbol && (symbol.endsWith('CE') || symbol.endsWith('PE')));
    const lotSizeVal = Number(instrument?.lot_size) || (instrument?.underlying_symbol === 'BANKNIFTY' ? 30 : (isOptions ? 65 : 1));
    const qtyUnitsVal = quantity; // quantity passed to executeMarketOrderSync is effective unit quantity
    const qtyLotsVal = isOptions ? Math.round(quantity / lotSizeVal) : null;

    // B. Create Order Record
    const orderData = {
      user_id: userId,
      instrument_id: instrumentId,
      symbol,
      side,
      order_type: 'market',
      quantity,
      quantity_units: qtyUnitsVal,
      quantity_lots: qtyLotsVal,
      lot_size: lotSizeVal,
      requested_price: referencePrice,
      executed_price: executionPrice,
      filled_quantity: quantity,
      avg_fill_price: executionPrice,
      slippage_amount: Math.abs(executionPrice - (side === 'buy' ? askPrice : bidPrice)),
      spread_markup: spreadAmount,
      execution_delay_ms: executionDelay,
      margin_required: marginRequired,
      margin_blocked: marginRequired,
      status: 'filled',
      filled_at: new Date().toISOString(),
      is_bracket_order: isBracketOrder === true,
      product_type: productType || 'intraday',
    };

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderErr) {
      // Revert margin blocked
      await supabaseAdmin.rpc('release_margin', {
        p_user_id: userId,
        p_amount: marginRequired,
      }).catch(e => console.warn('Margin release failed in fallback:', e.message));
      throw new Error('Fallback failed to create order: ' + orderErr.message);
    }

    orderRecord = order;

    // C. Create Position Record
    const positionData = {
      user_id: userId,
      instrument_id: instrumentId,
      symbol,
      order_id: orderRecord.id,
      side: side === 'buy' ? 'long' : 'short',
      quantity,
      quantity_units: qtyUnitsVal,
      quantity_lots: qtyLotsVal,
      entry_price: executionPrice,
      current_price: referencePrice,
      margin_used: marginRequired,
      leverage,
      stop_loss: stopLoss || null,
      take_profit: takeProfit || null,
      routing: 'b_book',
      is_bracket_order: isBracketOrder === true,
      product_type: productType || 'intraday',
    };

    const { data: position, error: posErr } = await supabaseAdmin
      .from('positions')
      .insert(positionData)
      .select()
      .single();

    if (posErr) {
      // Release margin and update order to rejected
      await supabaseAdmin.rpc('release_margin', {
        p_user_id: userId,
        p_amount: marginRequired,
      }).catch(e => console.warn('Margin release failed in fallback:', e.message));
      await supabaseAdmin
        .from('orders')
        .update({ status: 'rejected', reject_reason: posErr.message })
        .eq('id', orderRecord.id);
      throw new Error('Fallback order filled but position creation failed: ' + posErr.message);
    }

    positionRecord = position;

    // D. Deduct Commission
    if (commission > 0) {
      const { data: commRes, error: commErr } = await supabaseAdmin.rpc('debit_wallet', {
        p_user_id: userId,
        p_amount: commission,
        p_reference_id: orderRecord.id,
        p_reference_type: 'order',
        p_description: `Commission for ${side.toUpperCase()} ${quantity} ${symbol} @ ${executionPrice}`
      });
      if (commErr) {
        console.warn(`Failed to deduct commission for order ${orderRecord.id}:`, commErr);
      } else if (commRes) {
        newBalance = commRes.new_balance;
      }
    }
  }

  // ── Step 3: Broadcast Socket.IO update ──
  try {
    const io = getIO();
    io.of('/user').to(`user:${userId}`).emit('USER:ORDER_FILLED', {
      order: orderRecord,
      position: positionRecord,
      execution: {
        requested_price: referencePrice,
        executed_price: executionPrice,
        spread: spreadAmount,
        slippage: Math.abs(executionPrice - (side === 'buy' ? askPrice : bidPrice)),
        delay_ms: executionDelay,
      },
    });
  } catch (err) {
    // Socket server may not be fully initialized or connection lost
  }

  // ── Step 4: Update Redis exposure tracking (fire-and-forget) ──
  updateExposure(symbol, side, quantity).catch(() => {});

  // ── Step 5: Invalidate Wallet Cache ──
  try {
    const cache = require('./cache');
    cache.delete(`wallet:${userId}`);
  } catch (err) {}

  console.log(`✅ Sync execution complete: ${side} ${quantity}x ${symbol} @ ${executionPrice} [${orderRecord.id}]`);

  return {
    order: orderRecord,
    position: positionRecord,
    newBalance
  };
}

module.exports = { executeMarketOrderSync };
