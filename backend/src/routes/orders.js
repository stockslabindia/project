const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { enqueueOrder } = require('../core/queues/orderQueue');
const { validateOrder, recordOrderPlaced } = require('../core/risk/validator');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const tradeLimiter = rateLimit({
  windowMs: 10000, // 10 seconds
  max: 5, // 5 requests
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many trade actions. Please wait a few seconds before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticateUser);

/**
 * POST /api/orders
 * Place a new order (THE CORE DABBA LOGIC)
 * Now queues to BullMQ for async execution instead of blocking the API.
 */
router.post('/', tradeLimiter, async (req, res) => {
  try {
    const { symbol, side, order_type, quantity, price, trigger_price, stop_loss, take_profit, is_bracket } = req.body;
    const userId = req.user.id;
    const profile = req.user.profile;

    // ── Validations ──
    if (!symbol || !side || !order_type || !quantity) {
      return res.status(400).json({ error: 'symbol, side, order_type, and quantity are required' });
    }

    // Bracket order requires BOTH stop_loss and take_profit
    if (is_bracket && (!stop_loss || !take_profit)) {
      return res.status(400).json({ error: 'Bracket orders require both Stop Loss and Target price.' });
    }

    // Feed health is checked passively — orders always proceed
    // Price data comes from multiple providers (Finnhub + Binance)

    // Check if trading is enabled for user
    if (!profile.trading_enabled) {
      return res.status(403).json({ error: 'Trading is disabled for your account. Contact support.' });
    }

    // ── Risk Engine Pre-Trade Validation (Redis-first) ──
    const riskCheck = await validateOrder({
      userId,
      symbol: (symbol || '').toUpperCase(),
      side,
      quantity,
      price: order_type === 'limit' ? price : null,
    });
    if (!riskCheck.allowed) {
      return res.status(403).json({ error: riskCheck.reason });
    }

    // ── Fetch instrument, wallet, and spread profile with LRU Caching ──
    const cache = require('../core/cache');
    const symbolKey = `instrument:${symbol.toUpperCase()}`;
    const walletKey = `wallet:${userId}`;

    let instrument = cache.get(symbolKey);
    let wallet = cache.get(walletKey);

    if (!instrument || !wallet) {
      const promises = [];
      
      if (!instrument) {
        promises.push(
          supabaseAdmin.from('instruments').select('*').eq('symbol', symbol.toUpperCase()).eq('is_active', true).single()
            .then(res => {
              if (res.data) cache.set(symbolKey, res.data, 60000); // 60s TTL
              return res.data;
            })
        );
      } else {
        promises.push(Promise.resolve(instrument));
      }

      if (!wallet) {
        promises.push(
          supabaseAdmin.from('wallets').select('*').eq('user_id', userId).single()
            .then(res => {
              if (res.data) cache.set(walletKey, res.data, 5000); // 5s TTL
              return res.data;
            })
        );
      } else {
        promises.push(Promise.resolve(wallet));
      }

      const [instData, walletData] = await Promise.all(promises);
      instrument = instData;
      wallet = walletData;
    }

    if (!instrument) return res.status(404).json({ error: 'Instrument not found or inactive' });
    if (!instrument.trading_enabled) return res.status(403).json({ error: 'Trading disabled for this instrument' });
    if (side === 'buy' && !instrument.buy_enabled) return res.status(403).json({ error: 'Buying disabled for this instrument' });
    if (side === 'sell' && !instrument.sell_enabled) return res.status(403).json({ error: 'Selling disabled for this instrument' });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // Fetch spread profile (LRU cached)
    const spreadKey = `spread:${profile.tier}:${instrument.segment}`;
    let spreadProfile = cache.get(spreadKey);
    
    if (!spreadProfile) {
      const { data } = await supabaseAdmin
        .from('spread_profiles')
        .select('*')
        .eq('tier', profile.tier)
        .eq('segment', instrument.segment)
        .single();
      
      spreadProfile = data;
      if (data) {
        cache.set(spreadKey, data, 300000); // 5m TTL
      }
    }

    const sp = spreadProfile || { base_spread_pct: 0.05, slippage_min_pct: 0, slippage_max_pct: 0.05, execution_delay_min_ms: 0, execution_delay_max_ms: 200, house_favor_pct: 70 };

    // Reference price from instrument (continuously updated by price engine ticks)
    const referencePrice = instrument.last_price || 0;
    if (referencePrice <= 0) {
      return res.status(400).json({ error: 'No price available for this instrument. Market data may be loading.' });
    }
    const bidPrice = referencePrice;
    const askPrice = referencePrice;

    // Apply spread markup from tier
    const spreadAmount = referencePrice * (sp.base_spread_pct / 100);
    // Apply slippage (random within range, biased towards house)
    const slippageRange = sp.slippage_max_pct - sp.slippage_min_pct;
    const slippagePct = sp.slippage_min_pct + (Math.random() * slippageRange);
    const slippageAmount = referencePrice * (slippagePct / 100);
    const houseFavors = Math.random() * 100 < sp.house_favor_pct;

    let executionPrice;
    if (side === 'buy') {
      executionPrice = askPrice + (spreadAmount / 2); // buyer pays higher
      executionPrice += houseFavors ? slippageAmount : -slippageAmount * 0.3;
    } else {
      executionPrice = bidPrice - (spreadAmount / 2); // seller gets lower
      executionPrice -= houseFavors ? slippageAmount : -slippageAmount * 0.3;
    }

    executionPrice = Math.round(executionPrice * 10000) / 10000;

    // ── Margin calculation & Atomic Block ──
    const orderValue = quantity * executionPrice;
    const { getClientRestrictions } = require('../core/risk/clientRestrictions');
    const restrictions = await getClientRestrictions(userId);
    const multiplier = (restrictions && restrictions.leverage_multiplier) ? parseFloat(restrictions.leverage_multiplier) : 1.0;
    const marginRequired = (orderValue * (instrument.margin_required / 100)) / (multiplier || 1.0);

    // Limit orders block margin before queueing; market orders handle it inside executeMarketOrderSync
    if (order_type !== 'market') {
      const { error: marginErr } = await supabaseAdmin.rpc('block_margin', {
        p_user_id: userId,
        p_margin_amount: marginRequired,
      });

      if (marginErr) {
        return res.status(400).json({
          error: 'Insufficient margin',
          required: marginRequired,
          details: marginErr.message
        });
      }
    }

    // ── Check profit ceiling ──
    if (profile.profit_ceiling_enabled) {
      const dailyCap = profile.max_daily_profit;
      if (wallet.today_pnl >= dailyCap) {
        const { data: ceilingSetting } = await supabaseAdmin
          .from('system_settings')
          .select('value')
          .eq('key', 'client_message_at_ceiling')
          .single();

        const msg = ceilingSetting ? JSON.parse(ceilingSetting.value) : 'Trading paused due to market conditions.';
        return res.status(403).json({ error: msg });
      }
    }

    // ── Execution Delay (0 for market orders, random for limit/sl/tp queues) ──
    const executionDelay = order_type === 'market' ? 0 : (sp.execution_delay_min_ms + Math.floor(Math.random() * (sp.execution_delay_max_ms - sp.execution_delay_min_ms)));

    // ── Generate idempotency key ──
    const idempotencyKey = uuidv4();

    // ── Fast Path for Market Orders ──
    if (order_type === 'market') {
      const { executeMarketOrderSync } = require('../core/orderExecutor');
      const execResult = await executeMarketOrderSync({
        userId,
        symbol: instrument.symbol,
        side,
        quantity,
        instrumentId: instrument.id,
        instrument: {
          margin_required: instrument.margin_required,
          segment: instrument.segment,
        },
        marginRequired,
        executionPrice,
        referencePrice,
        spreadAmount,
        executionDelay: 0,
        stopLoss: stop_loss || null,
        takeProfit: take_profit || null,
        isBracketOrder: is_bracket === true,
        bidPrice,
        askPrice,
      });

      // Record order against user's daily count AFTER successful execution
      await recordOrderPlaced(userId).catch(() => {});

      return res.status(200).json({
        message: is_bracket ? 'Bracket order executed successfully' : 'Order executed successfully',
        order: execResult.order,
        position: execResult.position,
        newBalance: execResult.newBalance,
        status: 'filled',
        is_bracket: is_bracket === true,
      });
    }

    // ── Queue the order for async execution (limit, sl, tp) ──
    const jobName = 'execute_limit_order';
    const priority = 5;

    const job = await enqueueOrder(jobName, {
      idempotencyKey,
      userId,
      symbol: instrument.symbol,
      side,
      orderType: order_type,
      quantity,
      price: order_type === 'limit' ? price : null,
      triggerPrice: order_type === 'stop_loss' ? trigger_price : null,
      instrumentId: instrument.id,
      instrument: {
        margin_required: instrument.margin_required,
        segment: instrument.segment,
      },
      marginRequired,
      executionPrice,
      referencePrice,
      spreadAmount,
      executionDelay,
      stopLoss: stop_loss || null,
      takeProfit: take_profit || null,
      isBracketOrder: is_bracket === true,
      bidPrice,
      askPrice,
    }, { priority });

    // Record order against user's daily count AFTER successful enqueue
    await recordOrderPlaced(userId).catch(() => {});

    // Return immediately for queued orders — the worker will process and notify via Socket.IO
    return res.status(202).json({
      message: is_bracket ? 'Bracket order accepted for execution' : 'Order accepted for execution',
      jobId: job.id,
      idempotencyKey,
      status: 'queued',
      is_bracket: is_bracket === true,
      estimatedExecution: {
        price: executionPrice,
        spread: spreadAmount,
        delay_ms: executionDelay,
      },
    });

  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

/**
 * GET /api/orders
 * Get user's orders
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status; // 'pending', 'filled', etc.
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ orders: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * DELETE /api/orders/:id
 * Cancel a pending order
 */
router.delete('/:id', tradeLimiter, async (req, res) => {
  try {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .eq('status', 'pending')
      .single();

    if (!order) return res.status(404).json({ error: 'Pending order not found' });

    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: 'User cancelled' })
      .eq('id', order.id);

    // Release blocked margin atomically
    if (order.margin_blocked > 0) {
      try {
        await supabaseAdmin.rpc('release_margin', {
          p_user_id: req.user.id,
          p_amount: order.margin_blocked,
        });
      } catch (e) {
        console.warn('Margin release failed:', e.message);
      }
    }

    try {
      const { syncLimitOrders } = require('../ws/executionEngine');
      syncLimitOrders();
    } catch (err) {}

    res.json({ message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

/**
 * PUT /api/orders/:id
 * Modify a pending limit or stop_loss order
 */
router.put('/:id', tradeLimiter, async (req, res) => {
  try {
    const { quantity, price, stop_loss, take_profit } = req.body;
    const userId = req.user.id;
    const orderId = req.params.id;

    if (!quantity || !price || isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: 'Valid quantity and price are required' });
    }

    // 1. Fetch the order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*, instrument:instruments(*)')
      .eq('id', orderId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'Pending order not found' });
    }

    const instrument = order.instrument;
    if (!instrument) {
      return res.status(404).json({ error: 'Instrument not found' });
    }

    // 2. Validate Stop Loss and Target if this is a bracket order
    const updateData = {
      quantity,
      updated_at: new Date().toISOString()
    };

    if (order.is_bracket_order) {
      const finalSl = stop_loss !== undefined ? (stop_loss === '' || stop_loss === null ? null : parseFloat(stop_loss)) : order.stop_loss;
      const finalTgt = take_profit !== undefined ? (take_profit === '' || take_profit === null ? null : parseFloat(take_profit)) : order.take_profit;

      if (!finalSl || !finalTgt) {
        return res.status(400).json({ error: 'Both Stop Loss and Target are required for Bracket Orders.' });
      }

      const side = (order.side || '').toLowerCase();
      if (side === 'buy') {
        if (finalSl >= price) return res.status(400).json({ error: 'Stop Loss must be below limit price for BUY.' });
        if (finalTgt <= price) return res.status(400).json({ error: 'Target must be above limit price for BUY.' });
      } else {
        if (finalSl <= price) return res.status(400).json({ error: 'Stop Loss must be above limit price for SELL.' });
        if (finalTgt >= price) return res.status(400).json({ error: 'Target must be below limit price for SELL.' });
      }

      updateData.stop_loss = finalSl;
      updateData.take_profit = finalTgt;
    }

    // 3. Calculate new margin required
    const orderValue = quantity * price;
    const { getClientRestrictions } = require('../core/risk/clientRestrictions');
    const restrictions = await getClientRestrictions(userId);
    const multiplier = (restrictions && restrictions.leverage_multiplier) ? parseFloat(restrictions.leverage_multiplier) : 1.0;
    const newMarginRequired = (orderValue * (instrument.margin_required / 100)) / (multiplier || 1.0);
    const oldMarginBlocked = parseFloat(order.margin_blocked || 0);
    const marginDiff = newMarginRequired - oldMarginBlocked;

    // 4. Adjust blocked margin
    if (marginDiff > 0) {
      // Need to block more margin
      const { error: blockErr } = await supabaseAdmin.rpc('block_margin', {
        p_user_id: userId,
        p_margin_amount: marginDiff,
      });

      if (blockErr) {
        return res.status(400).json({
          error: 'Insufficient margin for modification',
          required: marginDiff,
          details: blockErr.message
        });
      }
    } else if (marginDiff < 0) {
      // Need to release margin
      try {
        await supabaseAdmin.rpc('release_margin', {
          p_user_id: userId,
          p_amount: Math.abs(marginDiff),
        });
      } catch (e) {
        console.warn('Margin release failed during modify:', e.message);
      }
    }

    // 5. Update order record in Supabase
    updateData.margin_required = newMarginRequired;
    updateData.margin_blocked = newMarginRequired;

    if (order.order_type === 'limit') {
      updateData.price = price;
    } else if (order.order_type === 'stop_loss') {
      updateData.trigger_price = price;
    }

    const { data: updatedOrder, error: updateErr } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) {
      // Rollback margin block if update failed
      if (marginDiff > 0) {
        try {
          await supabaseAdmin.rpc('release_margin', {
            p_user_id: userId,
            p_amount: marginDiff,
          });
        } catch (e) {
          console.warn('Rollback margin release failed:', e.message);
        }
      }
      return res.status(500).json({ error: 'Failed to update order in database: ' + updateErr.message });
    }

    // 5. Invalidate cache
    try {
      const cache = require('../core/cache');
      cache.delete(`wallet:${userId}`);
    } catch (err) {}

    // 6. Sync with the execution engine memory
    try {
      const { syncLimitOrders } = require('../ws/executionEngine');
      syncLimitOrders();
    } catch (err) {}

    res.json({
      message: 'Order modified successfully',
      order: updatedOrder
    });

  } catch (err) {
    console.error('Modify order error:', err);
    res.status(500).json({ error: 'Failed to modify order' });
  }
});

module.exports = router;
