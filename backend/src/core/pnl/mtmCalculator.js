const { redisClient } = require('../../redis/client');
const { supabaseAdmin } = require('../../config/supabase');
const { getIO } = require('../../ws/socketServer');
const { sendPushNotification } = require('../../services/pushNotifier');
const { sendMarginCallWarning } = require('../../core/telegram/alerts/riskAlerts');
/**
 * MTM (Mark-to-Market) PNL Calculator
 * 
 * Runs as a background interval that:
 * 1. Fetches all open positions
 * 2. Calculates unrealized PNL using latest ticks from Redis (batched MGET)
 * 3. Pushes updated PNL to each user via Socket.IO /user namespace
 * 4. Updates Redis hash for admin dashboard reads (pipeline for efficiency)
 * 
 * Optimizations:
 * - Batched tick fetches with MGET (one round-trip for all symbols)
 * - Dead-band filter: skips emit if PNL hasn't changed by > ₹0.01
 * - Redis pipeline for all HSET writes (one round-trip)
 * - TTL applied to pnl: cache keys (30s auto-expiry)
 */

const CALC_INTERVAL_MS = 1000; // Recalculate every 1 second
const TICK_TTL_SECONDS = 30;   // Tick cache expires after 30s (stale protection)
const PNL_TTL_SECONDS = 30;    // PNL cache expires after 30s
const PNL_DEADBAND = 0.01;     // Only broadcast if PNL change > ₹0.01

let isRunning = false;

// Track last broadcasted PNL per user to detect meaningful changes
const lastBroadcastedPnl = new Map(); // userId → totalUnrealizedPnl

/**
 * Store latest tick price in Redis for PNL lookups
 * Uses HSET with a TTL — ensures stale data auto-expires
 */
async function cacheTickPrice(symbol, ltp, bid, ask) {
  try {
    const pipeline = redisClient.pipeline();
    pipeline.hset(`tick:${symbol}`, {
      ltp: String(ltp),
      bid: String(bid || ltp),
      ask: String(ask || ltp),
      ts: String(Date.now()),
    });
    pipeline.expire(`tick:${symbol}`, TICK_TTL_SECONDS);
    await pipeline.exec();
  } catch (err) {
    // Redis not available — skip caching
  }
}

/**
 * Get the latest cached price from Redis
 */
async function getCachedPrice(symbol) {
  try {
    const data = await redisClient.hgetall(`tick:${symbol}`);
    if (data && data.ltp) {
      return {
        ltp: parseFloat(data.ltp),
        bid: parseFloat(data.bid),
        ask: parseFloat(data.ask),
        ts: parseInt(data.ts),
      };
    }
  } catch (err) {}
  return null;
}

/**
 * Batch-fetch tick prices for multiple symbols using Redis MGET.
 * Returns { symbol → { ltp, bid, ask, ts } }
 */
async function batchGetTickPrices(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const uniqueSymbols = [...new Set(symbols)];
  const priceMap = {};

  try {
    // Use pipeline to HGETALL all symbols in one round-trip
    const pipeline = redisClient.pipeline();
    uniqueSymbols.forEach(sym => pipeline.hgetall(`tick:${sym}`));
    const results = await pipeline.exec();

    results.forEach(([err, data], i) => {
      if (!err && data && data.ltp) {
        priceMap[uniqueSymbols[i]] = {
          ltp: parseFloat(data.ltp),
          bid: parseFloat(data.bid),
          ask: parseFloat(data.ask),
          ts: parseInt(data.ts),
        };
      }
    });
  } catch (err) {
    // Fallback to individual fetches if pipeline fails
    for (const sym of uniqueSymbols) {
      priceMap[sym] = await getCachedPrice(sym);
    }
  }

  return priceMap;
}

/**
 * Run one PNL calculation cycle
 */
let cachedSettings = { marginCallLevel: 50, stopOutLevel: 0, autoLiquidationEnabled: true };
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 10000; // 10 seconds cache TTL

/**
 * Gets liquidation stop-out and margin call settings dynamically from DB
 */
async function getLiquidationSettings() {
  const now = Date.now();
  if (now - lastSettingsFetchTime < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }
  try {
    const { data: sysSettings } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', ['margin_call_level', 'stop_out_level', 'auto_liquidation_enabled']);
      
    if (sysSettings) {
      let marginCall = 50;
      let stopOut = 0;
      let autoLiquidation = true;
      sysSettings.forEach(s => {
        let valStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        let parsedVal = parseFloat(valStr.replace(/"/g, ''));
        if (s.key === 'auto_liquidation_enabled') {
          autoLiquidation = valStr.replace(/"/g, '') === 'true';
        } else if (!isNaN(parsedVal)) {
          if (s.key === 'margin_call_level') marginCall = parsedVal;
          if (s.key === 'stop_out_level') stopOut = parsedVal;
        }
      });
      cachedSettings = { marginCallLevel: marginCall, stopOutLevel: stopOut, autoLiquidationEnabled: autoLiquidation };
      lastSettingsFetchTime = now;
    }
  } catch (err) {
    // Fail silent and use cached
  }
  return cachedSettings;
}

/**
 * Auto-Liquidates all open positions for a user at current market prices
 */
async function liquidateUserPositions(userId, userPositions, tickMap) {
  try {
    for (const pos of userPositions) {
      const tick = tickMap[pos.symbol];
      if (!tick) continue;

      const exitPrice = pos.side === 'BUY' || pos.side === 'long' ? (tick.bid || tick.ltp) : (tick.ask || tick.ltp);

      const { data: dbPos, error: fetchErr } = await supabaseAdmin
        .from('positions')
        .select('*')
        .eq('id', pos.id)
        .single();

      if (fetchErr || !dbPos || dbPos.status !== 'open') continue;

      let grossPnl = 0;
      if (dbPos.side === 'long' || dbPos.side === 'BUY') {
        grossPnl = (exitPrice - dbPos.entry_price) * dbPos.quantity;
      } else {
        grossPnl = (dbPos.entry_price - exitPrice) * dbPos.quantity;
      }
      
      const swapFees = 0; // Swap/overnight holding fees disabled
      const netPnl = Math.round((grossPnl - swapFees) * 100) / 100;

      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('close_position_atomic', {
        p_user_id: userId,
        p_position_id: dbPos.id,
        p_exit_price: parseFloat(exitPrice),
        p_gross_pnl: parseFloat(grossPnl),
        p_net_pnl: parseFloat(netPnl),
        p_charges: 0,
        p_spread_revenue: 0,
        p_swap_revenue: 0,
        p_close_reason: 'stop_out'
      });

      if (rpcErr) {
        console.error(`Failed to atomically close position ${dbPos.id} via RPC during liquidation:`, rpcErr.message);
        continue;
      }

      console.log(`🛑 Liquidation executed: Closed ${dbPos.symbol} position ${dbPos.id} for user ${userId} at ${exitPrice}`);
    }

    try {
      const cache = require('../cache');
      cache.delete(`wallet:${userId}`);
    } catch (err) {}

    let io;
    try {
      const { getIO } = require('../../ws/socketServer');
      io = getIO();
      if (io) {
        io.of('/user').to(`user:${userId}`).emit('USER:ORDER_FILLED', {
          userId,
          message: 'Stop-out liquidation executed: balance depleted.'
        });
      }
    } catch (_) {}

    await supabaseAdmin.from('audit_logs').insert({
      admin_id: null,
      action: 'auto_liquidation',
      target_type: 'user',
      target_id: userId,
      description: `Account auto-liquidated (Stop-out) due to balance depletion. All open positions closed.`,
      ip_address: '127.0.0.1'
    });

  } catch (err) {
    console.error(`Failed to liquidate user ${userId}:`, err.message);
  }
}

/**
 * Run one PNL calculation cycle
 */
async function calculateMTM() {
  if (isRunning) return; // Prevent overlap
  isRunning = true;

  try {
    // Fetch all open positions (including total_swap_fees to calculate net unrealized PNL)
    const { data: positions, error } = await supabaseAdmin
      .from('positions')
      .select('id, user_id, symbol, side, quantity, entry_price, margin_used, total_swap_fees')
      .in('status', ['OPEN', 'open']);

    if (error || !positions || positions.length === 0) {
      isRunning = false;
      return;
    }

    // Fetch liquidation parameters and wallets of active users
    const activeUserIds = [...new Set(positions.map(p => p.user_id))];
    const [
      { marginCallLevel, stopOutLevel, autoLiquidationEnabled },
      { data: wallets }
    ] = await Promise.all([
      getLiquidationSettings(),
      supabaseAdmin.from('wallets').select('user_id, balance, used_margin').in('user_id', activeUserIds)
    ]);

    const walletMap = {};
    (wallets || []).forEach(w => {
      walletMap[w.user_id] = w;
    });

    // ── OPTIMIZATION: Batch all tick fetches in one Redis round-trip ──
    const symbols = positions.map(p => p.symbol);
    const tickMap = await batchGetTickPrices(symbols);

    // Group by user for efficient broadcasting
    const userPnlMap = {};

    for (const pos of positions) {
      const tick = tickMap[pos.symbol];
      if (!tick) continue;

      const currentPrice = tick.ltp;
      let grossPnl = 0;

      if (pos.side === 'long' || pos.side === 'BUY') {
        grossPnl = (currentPrice - pos.entry_price) * pos.quantity;
      } else {
        grossPnl = (pos.entry_price - currentPrice) * pos.quantity;
      }

      // Net Unrealized PNL = Gross Profit - Accrued Swap Fees (disabled/set to 0)
      const swapFees = 0; // Swap/overnight holding fees disabled
      const unrealizedPnl = Math.round((grossPnl - swapFees) * 100) / 100;

      // Aggregate per user
      if (!userPnlMap[pos.user_id]) {
        userPnlMap[pos.user_id] = {
          totalUnrealizedPnl: 0,
          totalMarginUsed: 0,
          positions: [],
        };
      }

      userPnlMap[pos.user_id].totalUnrealizedPnl += unrealizedPnl;
      userPnlMap[pos.user_id].totalMarginUsed += pos.margin_used || 0;
      userPnlMap[pos.user_id].positions.push({
        id: pos.id,
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: pos.entry_price,
        currentPrice,
        unrealizedPnl,
        swapFees,
      });
    }

    // ── OPTIMIZATION: Use Redis pipeline for all HSET writes ──
    let io;
    try { io = getIO(); } catch (_) {}

    const redisPipeline = redisClient.pipeline();

    for (const [userId, pnlData] of Object.entries(userPnlMap)) {
      pnlData.totalUnrealizedPnl = Math.round(pnlData.totalUnrealizedPnl * 100) / 100;

      const wallet = walletMap[userId];
      if (wallet) {
        const balance = parseFloat(wallet.balance) || 0;
        const usedMargin = parseFloat(pnlData.totalMarginUsed) || 0;
        const equity = balance + pnlData.totalUnrealizedPnl;
        
        let marginLevel = 100;
        if (usedMargin > 0) {
          marginLevel = (equity / usedMargin) * 100;
        }

        // 🛑 Auto-Liquidation Check: Equity <= 0 or Margin Level <= stopOutLevel
        if (autoLiquidationEnabled && (equity <= 0 || (stopOutLevel > 0 && marginLevel <= stopOutLevel))) {
          console.warn(`🛑 Stop-out triggered for user ${userId}. Equity: ₹${equity}, Margin Level: ${marginLevel.toFixed(2)}%`);
          await liquidateUserPositions(userId, pnlData.positions, tickMap);
          continue;
        }

        // ⚠️ Margin Call Warning Check
        const hasWarning = marginLevel <= marginCallLevel;
        pnlData.marginCallWarning = hasWarning ? {
          equity,
          usedMargin,
          marginLevel,
          marginCallLevel
        } : null;

        if (hasWarning) {
          if (io) {
            io.of('/user').to(`user:${userId}`).emit('USER:MARGIN_CALL_WARNING', {
              equity,
              usedMargin,
              marginLevel,
              marginCallLevel
            });
          }
          try {
            const hasWarned = await redisClient.get(`warn:margin:${userId}`);
            if (!hasWarned) {
              await supabaseAdmin.from('audit_logs').insert({
                admin_id: null,
                action: 'margin_call',
                target_type: 'user',
                target_id: userId,
                description: `Margin Call warning triggered. Margin Level: ${marginLevel.toFixed(2)}%, Equity: ₹${equity.toFixed(2)}, Required Margin: ₹${usedMargin.toFixed(2)}`,
                ip_address: '127.0.0.1'
              });

              sendPushNotification(userId, {
                title: '⚠️ Margin Call Alert',
                body: `Your margin level has dropped to ${marginLevel.toFixed(2)}% (required: ${marginCallLevel}%). Please deposit funds or close positions to avoid auto-liquidation.`,
                url: '/wallet'
              }).catch(err => console.error('Margin call push warning failed:', err.message));

              const { data: userProfile } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', userId).single();
              if (userProfile) {
                sendMarginCallWarning(userProfile, marginLevel.toFixed(2), pnlData.totalUnrealizedPnl.toFixed(2));
              }

              await redisClient.setex(`warn:margin:${userId}`, 300, 'true'); // cache warning status for 5 mins
            }
          } catch (_) {}
        }
      }

      // ── DEAD-BAND FILTER: Only emit if PNL changed by > ₹0.01 ──
      const lastPnl = lastBroadcastedPnl.get(userId);
      const changed = lastPnl === undefined || Math.abs(pnlData.totalUnrealizedPnl - lastPnl) > PNL_DEADBAND;

      if (changed && io) {
        io.of('/user').to(`user:${userId}`).emit('USER:PNL_UPDATE', pnlData);
        lastBroadcastedPnl.set(userId, pnlData.totalUnrealizedPnl);
      }

      // Cache in Redis for admin dashboard reads (pipelined)
      if (changed) {
        redisPipeline.hset(`pnl:${userId}`, {
          totalPnl: String(pnlData.totalUnrealizedPnl),
          marginUsed: String(pnlData.totalMarginUsed),
          positionCount: String(pnlData.positions.length),
          updatedAt: String(Date.now()),
        });
        redisPipeline.expire(`pnl:${userId}`, PNL_TTL_SECONDS);
      }
    }

    await redisPipeline.exec();

  } catch (err) {
    console.error('MTM calculation error:', err.message);
  }

  isRunning = false;
}

/**
 * Start the MTM calculator background loop
 */
function startMTMCalculator() {
  console.log(`📊 MTM Calculator started (interval: ${CALC_INTERVAL_MS}ms, deadband: ₹${PNL_DEADBAND})`);
  setInterval(calculateMTM, CALC_INTERVAL_MS);
}

module.exports = { startMTMCalculator, cacheTickPrice, getCachedPrice, calculateMTM };
