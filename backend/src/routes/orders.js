const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { enqueueOrder } = require('../core/queues/orderQueue');
const { validateOrder, recordOrderPlaced } = require('../core/risk/validator');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { getDynamicMarginRequired, getMinQuantity } = require('../core/risk/marginCalculator');

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
    let { symbol, side, order_type, quantity, price, trigger_price, stop_loss, take_profit, is_bracket, product_type } = req.body;
    const userId = req.user.id;
    const profile = req.user.profile;
    // Default to 'intraday' for safety; client must explicitly pass 'overnight' to carry forward
    const resolvedProductType = product_type === 'overnight' ? 'overnight' : 'intraday';

    // ── Validations ──
    if (!symbol || !side || !order_type || quantity === undefined || quantity === null) {
      return res.status(400).json({ error: 'symbol, side, order_type, and quantity are required' });
    }

    quantity = Number(quantity);
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a valid positive number.' });
    }

    if (order_type === 'limit') {
      if (price === undefined || price === null || isNaN(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: 'Limit price must be a valid positive number.' });
      }
    }

    if (order_type === 'stop_loss') {
      if (trigger_price === undefined || trigger_price === null || isNaN(Number(trigger_price)) || Number(trigger_price) <= 0) {
        return res.status(400).json({ error: 'Trigger price must be a valid positive number.' });
      }
    }

    // Bracket order requires BOTH stop_loss and take_profit
    if (is_bracket && (!stop_loss || !take_profit)) {
      return res.status(400).json({ error: 'Bracket orders require both Stop Loss and Target price.' });
    }

    // Bracket order stop_loss validation: ensure SL/TGT ordering is logical for the given side
    if (is_bracket && order_type === 'stop_loss' && trigger_price) {
      const trigPx = parseFloat(trigger_price);
      const slPx = parseFloat(stop_loss);
      const tgtPx = parseFloat(take_profit);
      if (side === 'buy') {
        if (slPx >= trigPx) return res.status(400).json({ error: 'Bracket BUY stop-loss order: Stop Loss must be below the trigger price.' });
        if (tgtPx <= trigPx) return res.status(400).json({ error: 'Bracket BUY stop-loss order: Target must be above the trigger price.' });
      } else {
        if (slPx <= trigPx) return res.status(400).json({ error: 'Bracket SELL stop-loss order: Stop Loss must be above the trigger price.' });
        if (tgtPx >= trigPx) return res.status(400).json({ error: 'Bracket SELL stop-loss order: Target must be below the trigger price.' });
      }
    }

    // Feed health is checked passively — orders always proceed
    // Price data comes from multiple providers (Finnhub + Binance)

    // Check if trading is enabled for user
    if (!profile.trading_enabled) {
      return res.status(403).json({ error: 'Trading is disabled for your account. Contact support.' });
    }

    // ── Fetch instrument, wallet, restrictions & system settings in PARALLEL ──
    const cache = require('../core/cache');
    const symbolUpper = (symbol || '').toUpperCase();
    const symbolKey = `instrument:${symbolUpper}`;
    const walletKey = `wallet:${userId}`;
    const settingsKey = 'sys:vdp_settings';

    const { getClientRestrictions } = require('../core/risk/clientRestrictions');

    let instrument = cache.get(symbolKey);
    let wallet = cache.get(walletKey);
    let cachedSettings = cache.get(settingsKey);

    const promises = [
      getClientRestrictions(userId),
    ];

    if (!instrument) {
      promises.push(
        supabaseAdmin.from('instruments').select('*').eq('symbol', symbolUpper).eq('is_active', true).maybeSingle()
          .then(res => {
            if (res.data) cache.set(symbolKey, res.data, 300000); // 5-min TTL
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
            if (res.data) cache.set(walletKey, res.data, 30000); // 30s TTL
            return res.data;
          })
      );
    } else {
      promises.push(Promise.resolve(wallet));
    }

    if (!cachedSettings) {
      promises.push(
        supabaseAdmin.from('system_settings').select('key, value').in('key', ['news_spread_multiplier', 'vdp_execution_delay_ms', 'vdp_asymmetric_delay_enabled'])
          .then(res => {
            if (res.data) {
              const parsed = {};
              res.data.forEach(s => { parsed[s.key] = s.value; });
              cache.set(settingsKey, parsed, 30000); // 30s TTL
              return parsed;
            }
            return null;
          }).catch(() => null)
      );
    } else {
      promises.push(Promise.resolve(cachedSettings));
    }

    const [restrictions, instData, walletData, settingsData] = await Promise.all(promises);
    instrument = instData;
    wallet = walletData;
    cachedSettings = settingsData;

    // ── Risk Engine Pre-Trade Validation (reuses pre-fetched restrictions & instrument) ──
    const riskCheck = await validateOrder({
      userId,
      symbol: symbolUpper,
      side,
      quantity,
      price: order_type === 'limit' ? price : null,
      restrictions,
      instrument,
    });
    if (!riskCheck.allowed) {
      return res.status(403).json({ error: riskCheck.reason });
    }

    if (!instrument) return res.status(404).json({ error: 'Instrument not found or inactive' });
    if (!instrument.trading_enabled) return res.status(403).json({ error: 'Trading disabled for this instrument' });
    if (side === 'buy' && !instrument.buy_enabled) return res.status(403).json({ error: 'Buying disabled for this instrument' });
    if (side === 'sell' && !instrument.sell_enabled) return res.status(403).json({ error: 'Selling disabled for this instrument' });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // Options segment specific validations
    if (instrument.segment === 'fo_options') {
      const { validateOptionsOrder } = require('../core/risk/optionsValidator');
      const optCheck = validateOptionsOrder({
        instrument,
        side,
        quantity,
        product_type: resolvedProductType,
        profile,
        wallet
      });

      if (!optCheck.valid) {
        return res.status(400).json({ error: optCheck.error });
      }
    }

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

    // ── Process system settings ──
    let newsMultiplier = 1.0;
    let vdpDelayMs = 0;
    let vdpAsymmetric = false;

    if (cachedSettings) {
      newsMultiplier = parseFloat(cachedSettings['news_spread_multiplier']) || 1.0;
      vdpDelayMs     = parseInt(cachedSettings['vdp_execution_delay_ms'])   || 0;
      vdpAsymmetric  = cachedSettings['vdp_asymmetric_delay_enabled'] === 'true' || cachedSettings['vdp_asymmetric_delay_enabled'] === true;
    }

    const sp = spreadProfile || { base_spread_pct: 0.05, slippage_min_pct: 0, slippage_max_pct: 0.05, execution_delay_min_ms: 0, execution_delay_max_ms: 200, house_favor_pct: 70 };

    // Reference price from instrument. Prioritize real-time price from Redis cache,
    // falling back to instrument.last_price (which can be up to 60s stale in the LRU cache).
    let referencePrice = instrument.last_price || 0;
    let bidPrice = referencePrice;
    let askPrice = referencePrice;

    try {
      const { getCachedPrice } = require('../core/pnl/mtmCalculator');
      const cached = await getCachedPrice(symbol.toUpperCase());
      if (cached && cached.ltp) {
        referencePrice = cached.ltp;
        bidPrice = cached.bid || cached.ltp;
        askPrice = cached.ask || cached.ltp;
      }
    } catch (e) {
      console.warn('Redis cache lookup failed for order price:', e.message);
    }

    if (referencePrice <= 0) {
      return res.status(400).json({ error: 'No price available for this instrument. Market data may be loading.' });
    }

    // Determine effective unit quantity (for options: numLots * lot_size; for others: quantity)
    const isOptions = instrument.segment === 'fo_options';
    const lotSize = instrument.lot_size || (instrument.underlying_symbol === 'BANKNIFTY' ? 30 : 65);
    const effectiveQuantity = isOptions ? (quantity * lotSize) : quantity;

    // ── Minimum quantity check (enforce ₹400/$400 minimum capital per trade for non-options) ──
    if (!isOptions) {
      const instrumentWithLivePrice = { ...instrument, last_price: referencePrice };
      const minQty = getMinQuantity(instrumentWithLivePrice, product_type);
      if (quantity < minQty) {
        const isUSD = ['US', 'FOREX', 'INDEX', 'INTL', 'CRYPTO'].includes(instrument.exchange);
        const currSymbol = isUSD ? '$' : '₹';
        return res.status(400).json({
          error: `Minimum quantity for ${symbol} is ${minQty} (min ${currSymbol}400 capital required)`,
          min_quantity: minQty
        });
      }
    }

    // Apply spread markup from tier, scaled by newsMultiplier
    let spreadAmount = referencePrice * ((sp.base_spread_pct * newsMultiplier) / 100);
    
    // Apply slippage (per-user custom override or random within range, biased towards house)
    let slippageAmount = 0;
    if (profile.custom_slippage_ticks && parseFloat(profile.custom_slippage_ticks) > 0) {
      const tickSize = parseFloat(instrument.tick_size) || 0.05;
      slippageAmount = parseFloat(profile.custom_slippage_ticks) * tickSize;
    } else {
      const slippageRange = sp.slippage_max_pct - sp.slippage_min_pct;
      const slippagePct = sp.slippage_min_pct + (Math.random() * slippageRange);
      slippageAmount = referencePrice * (slippagePct / 100);
    }
    
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
    const orderValue = effectiveQuantity * executionPrice;
    const multiplier = (restrictions && restrictions.leverage_multiplier) ? parseFloat(restrictions.leverage_multiplier) : 1.0;
    
    // Calculate dynamic margin required based on product type
    // Options require 100% upfront premium (no leverage multiplier)
    const dynamicMarginRequiredPct = isOptions ? 100 : getDynamicMarginRequired(instrument, product_type);
    let marginRequired = isOptions ? orderValue : ((orderValue * (dynamicMarginRequiredPct / 100)) / (multiplier || 1.0));


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
        // Cache the ceiling message (60s TTL) — rarely changes
        const ceilingMsgKey = 'sys:ceiling_message';
        let msg = cache.get(ceilingMsgKey);
        if (!msg) {
          try {
            const { data: ceilingSetting } = await supabaseAdmin
              .from('system_settings')
              .select('value')
              .eq('key', 'client_message_at_ceiling')
              .single();
            msg = ceilingSetting ? JSON.parse(ceilingSetting.value) : 'Trading paused due to market conditions.';
            cache.set(ceilingMsgKey, msg, 60000); // 60s TTL
          } catch (e) {
            msg = 'Trading paused due to market conditions.';
          }
        }
        return res.status(403).json({ error: msg });
      }
    }

    // ── Execution Delay ──
    // Base delay calculation
    let executionDelay = order_type === 'market' ? 0 : (sp.execution_delay_min_ms + Math.floor(Math.random() * (sp.execution_delay_max_ms - sp.execution_delay_min_ms)));
    
    // Virtual Dealer execution delay (applied if not asymmetric, or if asymmetric and side is buy)
    if (vdpDelayMs > 0) {
      if (!vdpAsymmetric || side === 'buy') {
        executionDelay += vdpDelayMs;
      }
    }
    
    // Per-user custom execution delay override (seconds to milliseconds)
    if (profile.custom_execution_delay_s && parseFloat(profile.custom_execution_delay_s) > 0) {
      executionDelay += parseFloat(profile.custom_execution_delay_s) * 1000;
    }

    // ── Generate idempotency key ──
    const idempotencyKey = uuidv4();

    // ── Fast Path for Market Orders ──
    if (order_type === 'market') {
      if (executionDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, executionDelay));

        // After the execution delay, if VDP Asymmetric Logic is active, apply asymmetric slippage
        if (vdpDelayMs > 0 && vdpAsymmetric) {
          try {
            const { getCachedPrice } = require('../core/pnl/mtmCalculator');
            const newCached = await getCachedPrice(symbol.toUpperCase());
            if (newCached && newCached.ltp) {
              const postDelayLtp = newCached.ltp;
              const postDelayBid = newCached.bid || postDelayLtp;
              const postDelayAsk = newCached.ask || postDelayLtp;

              // Recalculate execution price for the post-delay price
              const newSpreadAmount = postDelayLtp * ((sp.base_spread_pct * newsMultiplier) / 100);
              let newSlippageAmount = 0;
              if (profile.custom_slippage_ticks && parseFloat(profile.custom_slippage_ticks) > 0) {
                const tickSize = parseFloat(instrument.tick_size) || 0.05;
                newSlippageAmount = parseFloat(profile.custom_slippage_ticks) * tickSize;
              } else {
                const slippageRange = sp.slippage_max_pct - sp.slippage_min_pct;
                const slippagePct = sp.slippage_min_pct + (Math.random() * slippageRange);
                newSlippageAmount = postDelayLtp * (slippagePct / 100);
              }

              let postDelayExecPrice;
              if (side === 'buy') {
                postDelayExecPrice = postDelayAsk + (newSpreadAmount / 2);
                postDelayExecPrice += houseFavors ? newSlippageAmount : -newSlippageAmount * 0.3;
              } else {
                postDelayExecPrice = postDelayBid - (newSpreadAmount / 2);
                postDelayExecPrice -= houseFavors ? newSlippageAmount : -newSlippageAmount * 0.3;
              }
              postDelayExecPrice = Math.round(postDelayExecPrice * 10000) / 10000;

              // Asymmetric Logic:
              // BUY side: execute at the HIGHER (worse) price between pre-delay and post-delay
              // SELL side: execute at the LOWER (worse) price between pre-delay and post-delay
              let appliedAsymmetric = false;
              if (side === 'buy' && postDelayExecPrice > executionPrice) {
                executionPrice = postDelayExecPrice;
                referencePrice = postDelayLtp;
                bidPrice = postDelayBid;
                askPrice = postDelayAsk;
                spreadAmount = newSpreadAmount;
                appliedAsymmetric = true;
              } else if (side === 'sell' && postDelayExecPrice < executionPrice) {
                executionPrice = postDelayExecPrice;
                referencePrice = postDelayLtp;
                bidPrice = postDelayBid;
                askPrice = postDelayAsk;
                spreadAmount = newSpreadAmount;
                appliedAsymmetric = true;
              }

              if (appliedAsymmetric) {
                // Re-calculate the margin required for this new price
                const newOrderValue = quantity * executionPrice;
                marginRequired = (newOrderValue * (dynamicMarginRequiredPct / 100)) / (multiplier || 1.0);
                console.log(`[VDP] Asymmetric logic applied for ${symbol}. Price adjusted to worse rate: ${executionPrice}`);
              }
            }
          } catch (err) {
            console.warn('Failed to execute VDP asymmetric slippage checks:', err.message);
          }
        }
      }
      const { executeMarketOrderSync } = require('../core/orderExecutor');
      const execResult = await executeMarketOrderSync({
        userId,
        symbol: instrument.symbol,
        side,
        quantity: effectiveQuantity,
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
        productType: resolvedProductType,
        bidPrice,
        askPrice,
        restrictions, // Pass pre-fetched restrictions to avoid a second lookup inside the executor
      });

      // Record order against user's daily count AFTER successful execution (non-blocking)
      recordOrderPlaced(userId).catch(() => {});

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
      productType: resolvedProductType,
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

    const { isKillSwitchActive, isUserFrozen } = require('../core/risk/validator');
    const [killActive, userFrozen] = await Promise.all([
      isKillSwitchActive(),
      isUserFrozen(req.user.id),
    ]);
    if (killActive) {
      return res.status(403).json({ error: 'Trading is temporarily halted (kill switch active).' });
    }
    if (userFrozen) {
      return res.status(403).json({ error: 'Your account has been frozen. Contact support.' });
    }

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

    // 1b. Run full risk validation on the modified order
    const { validateOrder } = require('../core/risk/validator');
    const riskCheck = await validateOrder({
      userId,
      symbol: order.symbol,
      side: order.side,
      quantity,
      price,
    });
    if (!riskCheck.allowed) {
      return res.status(403).json({ error: riskCheck.reason });
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
    const dynamicMarginRequiredPct = getDynamicMarginRequired(instrument, order.product_type);
    const newMarginRequired = (orderValue * (dynamicMarginRequiredPct / 100)) / (multiplier || 1.0);
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

    // 5. Update order record in Supabase FIRST, then adjust margin
    // This ordering prevents a state where margin was adjusted but the order wasn't updated.
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
      // DB update failed — roll back the margin change we already applied
      if (marginDiff > 0) {
        // We blocked extra margin — release it back
        try {
          await supabaseAdmin.rpc('release_margin', {
            p_user_id: userId,
            p_amount: marginDiff,
          });
        } catch (e) {
          console.warn('Rollback margin release failed:', e.message);
        }
      } else if (marginDiff < 0) {
        // We released margin — re-block it
        try {
          await supabaseAdmin.rpc('block_margin', {
            p_user_id: userId,
            p_margin_amount: Math.abs(marginDiff),
          });
        } catch (e) {
          console.warn('Rollback margin re-block failed:', e.message);
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
