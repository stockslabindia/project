const { redisClient } = require('../../redis/client');
const { supabaseAdmin } = require('../../config/supabase');

/**
 * Risk Validator — Pre-Trade Validation Engine
 * 
 * Runs BEFORE an order is queued to BullMQ.
 * Checks:
 *   1. Global kill switch (Redis-first, DB fallback)
 *   2. Symbol-level exposure limits
 *   3. User margin sufficiency
 *   4. User-level position limits
 *   5. Symbol trading status
 *   6. [NEW] Per-user daily order count limit
 *   7. [NEW] Per-user max position size (qty per order)
 *   8. [NEW] Per-user max open positions
 */

// ── Redis Key Conventions ──
// risk:kill_switch                → '1' or '0'
// risk:symbol_disabled:{SYMBOL}  → '1' if disabled
// exp:symbol:{SYMBOL}            → Net exposure (sum of all user quantities, +buy -sell)
// exp:user:{USER_ID}             → Total margin used by user
// risk:max_exposure:{SYMBOL}     → Max allowed net exposure for a symbol
// risk:limits:{USER_ID}          → Cached user trading limits (JSON, 5-min TTL)
// risk:user_daily_orders:{USER_ID}:{DATE}  → Int counter, TTL to midnight

/**
 * Check if the global kill switch is active
 */
async function isKillSwitchActive() {
  try {
    const val = await redisClient.get('risk:kill_switch');
    if (val === '1') return true;
  } catch (err) {
    // Redis down — fall through to DB check
  }

  // Fallback to Postgres: Check both global_kill_switch and trading_enabled
  try {
    const { data: killSwitch } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'global_kill_switch')
      .single();

    if (killSwitch && (killSwitch.value === 'true' || killSwitch.value === true)) {
      return true;
    }

    const { data: tradingEnabled } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'trading_enabled')
      .single();

    if (tradingEnabled && (tradingEnabled.value === 'false' || tradingEnabled.value === false || tradingEnabled.value === '"false"')) {
      return true;
    }
  } catch (err) {
    // Fall silent and assume healthy to avoid locking trading on DB error
  }

  return false;
}

/**
 * Check if a symbol is disabled for trading
 */
async function isSymbolDisabled(symbol) {
  try {
    const val = await redisClient.get(`risk:symbol_disabled:${symbol}`);
    if (val === '1') return true;
  } catch (err) {}
  return false;
}

/**
 * Get the current net exposure for a symbol across all users
 */
async function getSymbolExposure(symbol) {
  try {
    const val = await redisClient.get(`exp:symbol:${symbol}`);
    return parseFloat(val) || 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Get the max allowed exposure for a symbol
 */
async function getMaxExposure(symbol) {
  try {
    const val = await redisClient.get(`risk:max_exposure:${symbol}`);
    if (val) return parseFloat(val);
  } catch (err) {}
  // Default: no limit (Infinity)
  return Infinity;
}

/**
 * Update exposure after a trade executes
 */
async function updateExposure(symbol, side, quantity) {
  const delta = side === 'buy' ? quantity : -quantity;
  try {
    const key = `exp:symbol:${symbol}`;
    await redisClient.incrbyfloat(key, delta);
    await redisClient.expire(key, 86400); // 24h TTL, resets on every trade
  } catch (err) {
    console.error('Failed to update exposure in Redis:', err.message);
  }
}

/**
 * Freeze a user (block all trading)
 */
async function freezeUser(userId) {
  try {
    await redisClient.set(`risk:user_frozen:${userId}`, '1');
  } catch (err) {}
}

/**
 * Check if user is frozen
 */
async function isUserFrozen(userId) {
  try {
    const val = await redisClient.get(`risk:user_frozen:${userId}`);
    return val === '1';
  } catch (err) {}
  return false;
}

/**
 * Unfreeze a user
 */
async function unfreezeUser(userId) {
  try {
    await redisClient.del(`risk:user_frozen:${userId}`);
  } catch (err) {}
}

// ── User Trading Limits ──────────────────────────────────────

/**
 * Fetch user-specific trading limits from DB with Redis caching (5-min TTL).
 * Returns null if no limits are configured (meaning no restrictions apply).
 */
async function getUserTradingLimits(userId) {
  const cacheKey = `risk:limits:${userId}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached !== null) {
      return cached === 'null' ? null : JSON.parse(cached);
    }
  } catch (err) {
    // Redis error — fall through to DB
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_trading_limits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // Returns null if no row (not an error)

    if (error) {
      console.warn(`[RiskValidator] Could not fetch trading limits for ${userId}:`, error.message);
      return null;
    }

    // Cache the result — even "no limits" is cached to prevent DB hammering
    try {
      // ioredis uses setex(key, ttlSeconds, value), NOT set(key, value, { EX })
      await redisClient.setex(cacheKey, 300, data ? JSON.stringify(data) : 'null'); // 5-min TTL
    } catch (err) {}

    return data || null;
  } catch (err) {
    console.error('[RiskValidator] getUserTradingLimits failed:', err.message);
    return null;
  }
}

/**
 * Invalidate user trading limits cache (call after admin updates limits)
 */
async function invalidateLimitsCache(userId) {
  try {
    await redisClient.del(`risk:limits:${userId}`);
  } catch (err) {}
}

/**
 * Increment the user's daily order counter and return new count.
 * The key auto-expires at the next midnight IST (UTC+5:30).
 */
async function incrementDailyOrderCount(userId) {
  // Use IST date (UTC+5:30) so the counter resets at midnight Indian Standard Time
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + istOffset).toISOString().slice(0, 10); // YYYY-MM-DD (IST)
  const key = `risk:user_daily_orders:${userId}:${istDate}`;
  try {
    const count = await redisClient.incr(key);
    // Set TTL to 24h if this is the first increment today
    if (count === 1) {
      await redisClient.expire(key, 86400);
    }
    return count;
  } catch (err) {
    console.error('[RiskValidator] Failed to increment daily order count:', err.message);
    return 0;
  }
}

/**
 * Get the user's current daily order count.
 */
async function getDailyOrderCount(userId) {
  // Use IST date (UTC+5:30) so the counter is consistent with incrementDailyOrderCount
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + istOffset).toISOString().slice(0, 10);
  const key = `risk:user_daily_orders:${userId}:${istDate}`;
  try {
    const val = await redisClient.get(key);
    return parseInt(val) || 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Get the user's current open position count.
 * Reads from DB — this is a low-frequency check so no Redis needed.
 */
async function getOpenPositionCount(userId) {
  try {
    const { count, error } = await supabaseAdmin
      .from('positions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['open', 'OPEN']);

    if (error) return 0;
    return count || 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Full pre-trade validation
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
async function validateOrder(orderData) {
  const { userId, symbol, side, quantity, price } = orderData;

  // 1. Kill switch
  if (await isKillSwitchActive()) {
    return { allowed: false, reason: 'Trading is temporarily halted (kill switch active).' };
  }

  // 2. Symbol disabled
  if (await isSymbolDisabled(symbol)) {
    return { allowed: false, reason: `Trading is disabled for ${symbol}.` };
  }

  // 3. User frozen
  if (await isUserFrozen(userId)) {
    return { allowed: false, reason: 'Your account has been frozen. Contact support.' };
  }

  // 3b. Market Hours and Holiday Calendar Check
  const cache = require('../cache');
  const symbolKey = `instrument:${symbol.toUpperCase()}`;
  let inst = cache.get(symbolKey);
  if (!inst) {
    try {
      const { data } = await supabaseAdmin
        .from('instruments')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();
      inst = data;
      if (inst) {
        cache.set(symbolKey, inst, 60000); // Cache for 60s
      }
    } catch (err) {
      console.warn('[RiskValidator] Failed to query instrument for hours validation:', err.message);
    }
  }

  if (inst) {
    if (!inst.trading_enabled) {
      return { allowed: false, reason: `Trading is disabled for ${symbol}.` };
    }
    const { checkMarketHours } = require('./marketHours');
    const hoursCheck = await checkMarketHours(inst.segment);
    if (!hoursCheck.open) {
      return { allowed: false, reason: hoursCheck.reason || 'Market is currently closed for this segment.' };
    }
  }

  // 3c. Client Restrictions Check
  try {
    const { getClientRestrictions } = require('./clientRestrictions');
    const restrictions = await getClientRestrictions(userId);
    if (restrictions) {
      if (restrictions.trading === false) {
        return { allowed: false, reason: 'Trading is currently blocked for your account. Contact support.' };
      }

      if (inst) {
        const segmentLower = (inst.segment || '').toLowerCase();
        if (restrictions.options === false && segmentLower.includes('option')) {
          return { allowed: false, reason: 'Options trading is disabled for your account.' };
        }
        if (restrictions.mcx === false && segmentLower === 'mcx') {
          return { allowed: false, reason: 'MCX commodity trading is disabled for your account.' };
        }
      }

      if (restrictions.max_order_value !== null) {
        const orderPrice = price || inst?.last_price || 0;
        if (orderPrice > 0) {
          const orderValue = quantity * orderPrice;
          if (orderValue > restrictions.max_order_value) {
            return {
              allowed: false,
              reason: `Order value (₹${orderValue.toLocaleString('en-IN')}) exceeds your maximum allowed single order value of ₹${restrictions.max_order_value.toLocaleString('en-IN')}.`
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[RiskValidator] Client restrictions check error:', err.message);
  }

  // 4. Symbol exposure check
  const currentExposure = await getSymbolExposure(symbol);
  const maxExposure = await getMaxExposure(symbol);
  const projectedExposure = side === 'buy'
    ? currentExposure + quantity
    : currentExposure - quantity;

  if (Math.abs(projectedExposure) > maxExposure) {
    return {
      allowed: false,
      reason: `Exposure limit reached for ${symbol}. Current: ${currentExposure}, Max: ${maxExposure}.`,
    };
  }

  // 5. Per-user trading limits (daily orders, position size, open positions)
  const limits = await getUserTradingLimits(userId);
  if (limits) {
    // 5a. Max position size (qty per order)
    if (limits.max_position_size !== null && quantity > limits.max_position_size) {
      return {
        allowed: false,
        reason: `Order quantity (${quantity}) exceeds your maximum allowed position size of ${limits.max_position_size} units.`,
      };
    }

    // 5b. Daily order count limit
    if (limits.daily_order_limit !== null) {
      const dailyCount = await getDailyOrderCount(userId);
      if (dailyCount >= limits.daily_order_limit) {
        return {
          allowed: false,
          reason: `Daily order limit reached (${limits.daily_order_limit} orders/day). Your limit resets at midnight.`,
        };
      }
    }

    // 5c. Max concurrent open positions
    if (limits.max_open_positions !== null) {
      const openCount = await getOpenPositionCount(userId);
      if (openCount >= limits.max_open_positions) {
        return {
          allowed: false,
          reason: `You have reached the maximum allowed open positions (${limits.max_open_positions}). Close an existing position before placing a new one.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Increment daily order counter after a successful order is accepted.
 * Call this AFTER validateOrder() returns allowed:true, from the order route.
 */
async function recordOrderPlaced(userId) {
  await incrementDailyOrderCount(userId);
}

// ── Admin Emergency Controls ──

/**
 * Activate the global kill switch
 */
async function activateKillSwitch() {
  await redisClient.set('risk:kill_switch', '1');
  console.log('🚨 KILL SWITCH ACTIVATED — All trading halted.');
}

/**
 * Deactivate the global kill switch
 */
async function deactivateKillSwitch() {
  await redisClient.del('risk:kill_switch');
  console.log('✅ Kill switch deactivated — Trading resumed.');
}

/**
 * Disable a specific symbol
 */
async function disableSymbol(symbol) {
  await redisClient.set(`risk:symbol_disabled:${symbol}`, '1');
  console.log(`🚫 Symbol ${symbol} disabled for trading.`);
}

/**
 * Enable a specific symbol
 */
async function enableSymbol(symbol) {
  await redisClient.del(`risk:symbol_disabled:${symbol}`);
  console.log(`✅ Symbol ${symbol} enabled for trading.`);
}

/**
 * Set max exposure for a symbol
 */
async function setMaxExposure(symbol, maxQty) {
  await redisClient.set(`risk:max_exposure:${symbol}`, String(maxQty));
  console.log(`📊 Max exposure for ${symbol} set to ${maxQty}.`);
}

module.exports = {
  validateOrder,
  recordOrderPlaced,
  updateExposure,
  isKillSwitchActive,
  isSymbolDisabled,
  isUserFrozen,
  freezeUser,
  unfreezeUser,
  activateKillSwitch,
  deactivateKillSwitch,
  disableSymbol,
  enableSymbol,
  setMaxExposure,
  getSymbolExposure,
  getUserTradingLimits,
  invalidateLimitsCache,
  getDailyOrderCount,
  getOpenPositionCount,
};
