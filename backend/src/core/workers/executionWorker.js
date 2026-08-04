const { Worker } = require('bullmq');
const { getDynamicMarginRequired } = require('../risk/marginCalculator');
const { redisOpts } = require('../../redis/client');
const { supabaseAdmin } = require('../../config/supabase');
const { getIO } = require('../../ws/socketServer');
const { updateExposure } = require('../risk/validator');
const { sendPushNotification } = require('../../services/pushNotifier');

/**
 * Execution Worker
 * Processes orders from the BullMQ queue asynchronously.
 * This is the core B-Book execution engine.
 */
const executionWorker = new Worker(
  'order-execution',
  async (job) => {
    const { name, data } = job;
    console.log(`⚡ Processing job [${job.id}]: ${name}`);

    switch (name) {
      case 'execute_market_order':
        return await processMarketOrder(data);
      case 'execute_limit_order':
        return await processLimitOrder(data);
      case 'fill_limit_order':
        return await fillLimitOrder(data);
      case 'execute_sl_tp':
        return await executeSlTp(data);
      default:
        throw new Error(`Unknown job type: ${name}`);
    }
  },
  {
    connection: redisOpts,
    concurrency: 5, // Process up to 5 orders simultaneously
    limiter: {
      max: 50,
      duration: 1000, // Max 50 orders per second
    },
  }
);

/**
 * Process a Market Order (instant fill, B-Book)
 * NOTE (Bug #6): Market orders are now executed via the fast-path executeMarketOrderSync()
 * in the API route — they NEVER reach this worker function under normal operation.
 * If this function IS called (e.g., via a direct queue.add('execute_market_order',...)),
 * margin should NOT have been pre-blocked by the route (the route only pre-blocks for
 * non-market orders). This function blocks margin itself. Do not block it a second time.
 */
async function processMarketOrder(data) {
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
    _marginAlreadyBlocked, // Set to true if caller pre-blocked margin to prevent double-block
  } = data;

  // ── Step 1: Create the order record ──
  const orderData = {
    user_id: userId,
    instrument_id: instrumentId,
    symbol,
    side,
    order_type: 'market',
    quantity,
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
    stop_loss: stopLoss || null,
    take_profit: takeProfit || null,
    product_type: productType || 'intraday',
  };

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (orderErr) {
    // Release margin atomically — avoid separate SELECT + UPDATE race condition
    await supabaseAdmin.rpc('release_margin', {
      p_user_id: userId,
      p_amount: marginRequired,
    }).catch(e => console.warn('Margin release failed:', e.message));
    throw new Error('Failed to create order: ' + orderErr.message);
  }

  // ── Step 2: Create position ──
  const { getClientRestrictions } = require('../risk/clientRestrictions');
  const restrictions = await getClientRestrictions(userId);
  const multiplier = (restrictions && restrictions.leverage_multiplier) ? parseFloat(restrictions.leverage_multiplier) : 1.0;
  
  const dynamicMarginRequiredPct = getDynamicMarginRequired(instrument, order.product_type || productType || 'intraday');
  const leverage = (100 / (dynamicMarginRequiredPct || 10)) * multiplier;

  const positionData = {
    user_id: userId,
    instrument_id: instrumentId,
    symbol,
    order_id: order.id,
    side: side === 'buy' ? 'long' : 'short',
    quantity,
    entry_price: executionPrice,
    current_price: referencePrice,
    margin_used: marginRequired,
    leverage,
    stop_loss: stopLoss || null,
    take_profit: takeProfit || null,
    is_bracket_order: isBracketOrder === true,
    routing: 'b_book',
    product_type: order.product_type || productType || 'intraday',
  };

  const { data: position, error: posErr } = await supabaseAdmin
    .from('positions')
    .insert(positionData)
    .select()
    .single();

  if (posErr) {
    // Release margin atomically and revert order
    await supabaseAdmin.rpc('release_margin', {
      p_user_id: userId,
      p_amount: marginRequired,
    }).catch(e => console.warn('Margin release failed:', e.message));
    await supabaseAdmin.from('orders').update({ status: 'rejected', reject_reason: posErr.message }).eq('id', order.id);
    throw new Error('Order filled but position creation failed: ' + posErr.message);
  }

  // ── Margin is already blocked atomically in the API route ──

  // ── Step 4: Deduct commission atomically ──
  const commission = 0; // Brokerage set to 0
  if (commission > 0) {
    const { error: commErr } = await supabaseAdmin.rpc('debit_wallet', {
      p_user_id: userId,
      p_amount: commission,
      p_reference_id: order.id,
      p_reference_type: 'order',
      p_description: `Commission for ${side.toUpperCase()} ${quantity} ${symbol} @ ${executionPrice}`
    });
    if (commErr) {
      console.warn(`Failed to deduct commission for order ${order.id}:`, commErr);
    }
  }

  // ── Step 5: Notify user via Socket.IO ──
  try {
    const io = getIO();
    io.of('/user').to(`user:${userId}`).emit('USER:ORDER_FILLED', {
      order,
      position,
      execution: {
        requested_price: referencePrice,
        executed_price: executionPrice,
        spread: spreadAmount,
        slippage: Math.abs(executionPrice - (side === 'buy' ? askPrice : bidPrice)),
        delay_ms: executionDelay,
      },
    });
  } catch (err) {
    // Socket not available — user will get update on next poll
  }

  // ── Step 6: Update Redis exposure tracking ──
  await updateExposure(symbol, side, quantity);

  // Sync positions in execution engine
  try {
    const { syncPositions } = require('../../ws/executionEngine');
    syncPositions();
  } catch (err) {}

  console.log(`✅ Order executed: ${side} ${quantity}x ${symbol} @ ${executionPrice} [${order.id}]`);

  return { orderId: order.id, positionId: position.id, executionPrice };
}

/**
 * Process a Limit Order (placeholder for Phase 3 limit order matching)
 */
async function processLimitOrder(data) {
  // For now, just insert the pending order. The execution engine
  // will match it when price reaches the limit.
  const { userId, symbol, side, quantity, price, instrumentId, marginRequired, isBracketOrder, stopLoss, takeProfit, productType } = data;

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: userId,
      instrument_id: instrumentId,
      symbol,
      side,
      order_type: 'limit',
      quantity,
      price,
      margin_required: marginRequired,
      margin_blocked: marginRequired,
      status: 'pending',
      is_bracket_order: isBracketOrder === true,
      stop_loss: stopLoss || null,
      take_profit: takeProfit || null,
      product_type: productType || 'intraday',
    })
    .select()
    .single();

  if (error) {
    // Release margin atomically
    await supabaseAdmin.rpc('release_margin', {
      p_user_id: userId,
      p_amount: marginRequired,
    }).catch(e => console.warn('Margin release failed:', e.message));
    throw new Error('Failed to create limit order: ' + error.message);
  }

  // Trigger sync of limit orders so it can be evaluated instantly
  try {
    const { syncLimitOrders } = require('../../ws/executionEngine');
    syncLimitOrders();
  } catch (err) {}

  return { orderId: order.id, status: 'pending' };
}

/**
 * Fill a pending Limit Order
 */
async function fillLimitOrder(data) {
  const { orderId, executionPrice } = data;

  // ── Step 1: Atomic claim pattern — claim order status from 'pending' to 'processing' ──
  const { data: claimedOrder, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .update({ status: 'processing' })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('*, instrument:instruments(*)')
    .single();

  if (fetchErr || !claimedOrder) {
    console.log(`[EXECUTION WORKER] Order ${orderId} already claimed or non-pending. Skipping execution.`);
    return { orderId, skipped: true };
  }

  const order = claimedOrder;

  const {
    user_id: userId,
    symbol,
    side,
    quantity,
    instrument_id: instrumentId,
    instrument,
    margin_required: marginRequired,
    price: referencePrice,
    is_bracket_order: isBracketOrder,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    product_type: productType,
  } = order;

  // ── Step 1.5: Runtime Risk Validation ──
  const { isKillSwitchActive, isUserFrozen } = require('../risk/validator');
  const [killActive, userFrozen] = await Promise.all([
    isKillSwitchActive(),
    isUserFrozen(userId),
  ]);

  if (killActive || userFrozen) {
    // Cancel the order instead of filling it, to prevent infinite loops
    await supabaseAdmin.from('orders').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: killActive ? 'Kill switch activated before execution' : 'Account frozen before execution'
    }).eq('id', orderId);
    
    // Release margin
    if (marginRequired > 0) {
      await supabaseAdmin.rpc('release_margin', {
        p_user_id: userId,
        p_amount: marginRequired,
      }).catch(e => console.warn('Margin release failed:', e.message));
    }
    throw new Error(`Execution blocked: ${killActive ? 'Kill Switch Active' : 'User Frozen'}. Order cancelled.`);
  }

  // Assuming 0.01% spread markup for calculation
  const spreadAmount = executionPrice * 0.0001;

  // ── Step 2: Update the order to filled ──
  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'filled',
      executed_price: executionPrice,
      filled_quantity: quantity,
      avg_fill_price: executionPrice,
      slippage_amount: Math.abs(executionPrice - referencePrice),
      spread_markup: spreadAmount,
      filled_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateErr) throw new Error('Failed to update limit order: ' + updateErr.message);

  // ── Step 3: Create position ──
  const { getClientRestrictions } = require('../risk/clientRestrictions');
  const restrictions = await getClientRestrictions(userId);
  const multiplier = (restrictions && restrictions.leverage_multiplier) ? parseFloat(restrictions.leverage_multiplier) : 1.0;
  
  const dynamicMarginRequiredPct = getDynamicMarginRequired(instrument, productType || 'intraday');
  const leverage = (100 / (dynamicMarginRequiredPct || 10)) * multiplier;

  const positionData = {
    user_id: userId,
    instrument_id: instrumentId,
    symbol,
    order_id: orderId,
    side: side === 'buy' ? 'long' : 'short',
    quantity,
    entry_price: executionPrice,
    current_price: executionPrice,
    margin_used: marginRequired, // Margin was already blocked!
    leverage,
    is_bracket_order: isBracketOrder === true,
    stop_loss: stopLoss || null,
    take_profit: takeProfit || null,
    routing: 'b_book',
    product_type: productType || 'intraday',
  };

  const { data: position, error: posErr } = await supabaseAdmin
    .from('positions')
    .insert(positionData)
    .select()
    .single();

  if (posErr) {
    // Attempt rollback (rare but needed)
    await supabaseAdmin.from('orders').update({ status: 'pending', filled_at: null }).eq('id', orderId);
    throw new Error('Position creation failed for limit order: ' + posErr.message);
  }

  // ── Step 4: Deduct commission atomically ──
  const commission = 0; // Brokerage set to 0
  if (commission > 0) {
    const { error: commErr } = await supabaseAdmin.rpc('debit_wallet', {
      p_user_id: userId,
      p_amount: commission,
      p_reference_id: orderId,
      p_reference_type: 'order',
      p_description: `Commission for Limit ${side.toUpperCase()} ${quantity} ${symbol} @ ${executionPrice}`
    });
    if (commErr) {
      console.warn(`Failed to deduct commission for limit order ${orderId}:`, commErr);
    }
  }

  // ── Step 5: Notify user via Socket.IO ──
  try {
    const io = getIO();
    io.of('/user').to(`user:${userId}`).emit('USER:ORDER_FILLED', {
      order: { ...order, status: 'filled', executed_price: executionPrice },
      position,
      execution: {
        requested_price: referencePrice,
        executed_price: executionPrice,
        spread: spreadAmount,
        slippage: Math.abs(executionPrice - referencePrice),
      },
    });
  } catch (err) {}

  // ── Step 6: Update Redis exposure tracking ──
  await updateExposure(symbol, side, quantity);

  // ── Step 7: Invalidate Wallet Cache ──
  try {
    const cache = require('../cache');
    cache.delete(`wallet:${userId}`);
  } catch (err) {}

  // Sync positions in execution engine
  try {
    const { syncPositions } = require('../../ws/executionEngine');
    syncPositions();
  } catch (err) {}

  console.log(`✅ Limit Order Filled: ${side} ${quantity}x ${symbol} @ ${executionPrice} [${orderId}]`);
  
  sendPushNotification(userId, {
    title: '🟢 Limit Order Filled',
    body: `Your order to ${side.toUpperCase()} ${quantity} ${symbol} was filled at ${executionPrice}.`,
    url: '/positions'
  }).catch(err => console.error('Limit order push failed:', err.message));

  return { orderId, positionId: position.id, executionPrice };
}

/**
 * Process a Stop Loss / Take Profit squareoff
 */
async function executeSlTp(data) {
  const { positionId, exitPrice, triggerType } = data;

  // 1. Fetch position
  const { data: position, error: fetchErr } = await supabaseAdmin
    .from('positions')
    .select('*, instrument:instruments(*)')
    .eq('id', positionId)
    .single();

  if (fetchErr || !position) throw new Error('Position not found: ' + (fetchErr?.message || ''));
  if (position.status !== 'open' && position.status !== 'OPEN') {
    console.log(`⚠️ Position ${positionId} is already closed/closing. Ignoring SL/TP trigger.`);
    return;
  }

  const {
    user_id: userId,
    symbol,
    side,
    quantity,
    entry_price: entryPrice,
    instrument,
    margin_used: marginUsed,
    total_swap_fees: totalSwapFees,
    routing
  } = position;

  // Assuming 0.05% spread markup for calculation
  const spreadAmount = exitPrice * 0.0005;

  let grossPnl = 0;
  if (side === 'long' || side === 'BUY') {
    grossPnl = (exitPrice - entryPrice) * quantity;
  } else {
    grossPnl = (entryPrice - exitPrice) * quantity;
  }

  const charges = 0; // Brokerage and swap/holding fees set to 0
  const netPnl = grossPnl;

  // 2. Close position atomically via DB RPC
  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('close_position_atomic', {
    p_user_id: userId,
    p_position_id: positionId,
    p_exit_price: parseFloat(exitPrice),
    p_gross_pnl: parseFloat(grossPnl),
    p_net_pnl: parseFloat(netPnl),
    p_charges: 0,
    p_spread_revenue: 0,
    p_swap_revenue: 0,
    p_close_reason: triggerType.toLowerCase()
  });

  if (rpcErr) throw new Error('Failed to atomically close position via RPC: ' + rpcErr.message);

  // 5. Notify user
  try {
    const io = getIO();
    io.of('/user').to(`user:${userId}`).emit('USER:ORDER_FILLED', {
      position: { ...position, status: 'closed', current_price: exitPrice, pnl: netPnl },
      execution: {
        executed_price: exitPrice,
        reason: triggerType,
        quantity: quantity,
        side: (position.side || 'buy').toLowerCase() === 'buy' ? 'sell' : 'buy'
      },
    });
  } catch (err) {}

  // 6. Update exposure (reversing the position)
  // Reversing the quantity because we are closing
  await updateExposure(symbol, side === 'long' || side === 'BUY' ? 'sell' : 'buy', quantity);

  // 7. Invalidate Wallet Cache
  try {
    const cache = require('../cache');
    cache.delete(`wallet:${userId}`);
  } catch (err) {}

  console.log(`✅ ${triggerType} Executed: ${symbol} @ ${exitPrice} PNL: ${netPnl} [Pos: ${positionId}]`);
  
  sendPushNotification(userId, {
    title: triggerType === 'STOP_LOSS' ? '🛑 Stop Loss Hit' : '🎯 Target Hit',
    body: `${symbol} position closed at ${exitPrice} (trigger: ${triggerType === 'STOP_LOSS' ? 'SL' : 'TGT'}). PnL: ₹${netPnl.toFixed(2)}`,
    url: '/history'
  }).catch(err => console.error('SL/TP push failed:', err.message));

  return { positionId, exitPrice, netPnl, triggerType };
}

// ── Worker Event Logging ──
executionWorker.on('completed', (job, result) => {
  console.log(`✅ Job [${job.id}] completed:`, result);
});

executionWorker.on('failed', (job, err) => {
  console.error(`❌ Job [${job?.id}] failed:`, err.message);
});

executionWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

module.exports = { executionWorker };
