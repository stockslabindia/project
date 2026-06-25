/**
 * High-Frequency Price Animator
 * 
 * This is the SECRET SAUCE that makes dabba trading apps feel like Zerodha.
 * 
 * Between real price ticks (which come every 2-5 seconds from NSE/Binance),
 * this module generates realistic micro-price-movements at HIGH FREQUENCY
 * (every 100-150ms = 6-10 updates per second) so the UI feels alive.
 * 
 * How it works:
 * 1. Real ticks from NSE/Binance set the "anchor price" for each symbol
 * 2. The animator runs at 100-150ms intervals
 * 3. For each symbol that has active watchers, it generates a tiny random
 *    variation (±0.01% to ±0.05%) around the anchor price
 * 4. These micro-ticks are emitted via Socket.IO to make the UI flicker
 * 5. When a NEW real tick arrives, the anchor resets to the actual market price
 * 
 * This is EXACTLY how tradex1.live, markettrade.live, and other dabba platforms
 * achieve their "Zerodha-like" price speed.
 */

const { feedLogger } = require('../core/monitoring/logger');
const { redisClient } = require('../redis/client');
// NOTE: socketServer is required lazily inside the interval to avoid circular dependency:
// nativeWsServer → priceAnimator → socketServer → (various)

// ── Configuration ──
const ANIMATION_INTERVAL_MS = 250;     // ~4 updates per second (natural, not fake)
const MICRO_VARIATION_PCT = 0.00008;   // ±0.008% max variation from anchor
const SPREAD_VARIATION_PCT = 0.00004;  // Bid/ask spread micro-variation

// Only animate these exchanges — Finnhub (US/Forex/Indices) included to ensure smooth price movement
const ANIMATABLE_EXCHANGES = new Set(['NSE', 'NSE_INDEX', 'CRYPTO', 'BINANCE', 'MCX', 'US', 'FOREX', 'INDEX']);

// ── Segment Configuration ──
const segmentSettings = {
  nse_stocks: true,
  mcx: true,
  forex: true,
  crypto: true,
  us_stocks: true,
  global_indices: true
};

function getSegmentForExchange(exchange) {
  if (!exchange) return 'nse_stocks';
  const ex = exchange.toUpperCase();
  if (ex === 'MCX') return 'mcx';
  if (ex === 'FOREX') return 'forex';
  if (ex === 'CRYPTO' || ex === 'BINANCE') return 'crypto';
  if (ex === 'US') return 'us_stocks';
  if (ex === 'INDEX' || ex === 'NSE_INDEX') return 'global_indices';
  return 'nse_stocks'; // Default to nse_stocks (e.g. NSE, BSE)
}

function getSegmentSettings() {
  return { ...segmentSettings };
}

async function updateSegmentSetting(segment, enabled) {
  if (segmentSettings[segment] !== undefined) {
    segmentSettings[segment] = !!enabled;
    feedLogger.info(`[ANIMATOR] Segment '${segment}' animator set to: ${enabled ? 'ON' : 'OFF'}`);
    try {
      if (redisClient) {
        await redisClient.set('animator:segment_settings', JSON.stringify(segmentSettings));
      }
    } catch (err) {
      feedLogger.warn(`[ANIMATOR] Failed to save settings to Redis: ${err.message}`);
    }
    return true;
  }
  return false;
}

async function initSettings() {
  try {
    if (redisClient) {
      const cached = await redisClient.get('animator:segment_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        Object.assign(segmentSettings, parsed);
        feedLogger.info(`[ANIMATOR] Loaded segment settings from Redis: ${JSON.stringify(segmentSettings)}`);
      }
    }
  } catch (err) {
    feedLogger.warn(`[ANIMATOR] Failed to load settings from Redis: ${err.message}`);
  }
}

// ── State ──
const anchorPrices = new Map();   // symbol → { price, bid, ask, high, low, open, prev_close, change, changePct, volume, exchange, timestamp }
const watchedSymbols = new Set(); // symbols that currently have at least one active subscriber
let animatorInterval = null;
let tickCount = 0;

/**
 * Update the anchor price for a symbol (called when a REAL tick arrives)
 * @param {Object} tick - Real tick from NSE/Binance/Finnhub
 */
function updateAnchor(tick) {
  if (!tick || !tick.symbol) return;

  const price = tick.ltp || tick.price;
  if (!price || price <= 0) return;

  anchorPrices.set(tick.symbol, {
    price,
    bid: tick.bid || price,
    ask: tick.ask || price,
    bid_qty: tick.bid_qty || 0,
    ask_qty: tick.ask_qty || 0,
    high: tick.high || price,
    low: tick.low || price,
    open: tick.open || price,
    prev_close: tick.prev_close || 0,
    change: tick.change || 0,
    changePct: tick.changePercent || tick.change_percent || 0,
    volume: tick.volume || 0,
    exchange: tick.exchange || 'NSE',
    lastRealTick: Date.now(),
    // Track the "drift" — how far the animated price has moved from anchor
    currentAnimatedPrice: price,
  });
}

/**
 * Track a subscription change for a symbol.
 * Called by nativeWsServer when a client subscribes/unsubscribes.
 */
function addWatcher(symbol) {
  if (symbol) watchedSymbols.add(symbol.toUpperCase());
}

function removeWatcher(symbol) {
  if (symbol) watchedSymbols.delete(symbol.toUpperCase());
}


/**
 * Check if market is currently open in IST
 */
function isMarketOpen(exchange) {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const day = istTime.getDay();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (exchange === 'NSE' || exchange === 'NSE_INDEX') {
    if (day === 0 || day === 6) return false; // Weekend closed
    const startMins = 9 * 60 + 15; // 09:15
    const endMins = 15 * 60 + 30; // 15:30
    return timeInMinutes >= startMins && timeInMinutes <= endMins;
  }
  
  if (exchange === 'MCX') {
    if (day === 0 || day === 6) return false; // Weekend closed
    const startMins = 9 * 60; // 09:00
    const endMins = 23 * 60 + 30; // 23:30
    return timeInMinutes >= startMins && timeInMinutes <= endMins;
  }

  if (exchange === 'US') {
    const usTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const usDay = usTime.getDay();
    if (usDay === 0 || usDay === 6) return false; // Weekend closed
    const usTimeInMinutes = usTime.getHours() * 60 + usTime.getMinutes();
    const startMins = 9 * 60 + 30; // 09:30 AM EST
    const endMins = 16 * 60;       // 04:00 PM EST
    return usTimeInMinutes >= startMins && usTimeInMinutes <= endMins;
  }

  if (exchange === 'INDEX' || exchange === 'FOREX' || exchange === 'INTL') {
    const usTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const usDay = usTime.getDay();
    // Freeze Forex and Global Indices during US Weekends
    if (usDay === 0 || usDay === 6) return false;
    return true;
  }
  
  return true; // Crypto open 24/7 or unhandled markets
}

/**
 * Start the high-frequency price animator
 */
async function startAnimator() {
  if (animatorInterval) return;

  // Load animator segment settings from Redis
  await initSettings();

  // Preload initial anchor prices from DB to ensure every active instrument
  // can start animating immediately on startup without waiting for a live tick.
  try {
    const { fetchAllActiveInstruments } = require('../config/supabase');
    const instruments = await fetchAllActiveInstruments('symbol, last_price, bid_price, ask_price, day_high, day_low, day_open, prev_close, change_amount, change_percent, volume, exchange');
    if (instruments && instruments.length > 0) {
      instruments.forEach(i => {
        const price = parseFloat(i.last_price);
        if (price > 0 && !anchorPrices.has(i.symbol)) {
          anchorPrices.set(i.symbol, {
            price,
            bid: parseFloat(i.bid_price) || price,
            ask: parseFloat(i.ask_price) || price,
            high: parseFloat(i.day_high) || price,
            low: parseFloat(i.day_low) || price,
            open: parseFloat(i.day_open) || price,
            prev_close: parseFloat(i.prev_close) || 0,
            change: parseFloat(i.change_amount) || 0,
            changePct: parseFloat(i.change_percent) || 0,
            volume: parseInt(i.volume) || 0,
            exchange: i.exchange || 'NSE',
            lastRealTick: Date.now(),
            currentAnimatedPrice: price,
          });
        }
      });
      feedLogger.info(`[ANIMATOR] Preloaded ${instruments.length} initial anchor prices from database.`);
    }
  } catch (err) {
    feedLogger.error(`[ANIMATOR] Preloading anchors failed: ${err.message}`);
  }

  feedLogger.info(`[ANIMATOR] 🚀 Starting high-frequency price animator (${Math.round(1000 / ANIMATION_INTERVAL_MS)} ticks/sec per symbol)`);

  animatorInterval = setInterval(() => {
    try {
      const { getIO } = require('./socketServer'); // lazy to avoid circular dep
      const io = getIO();
      const marketNs = io.of('/market');
      const adminNs = io.of('/admin');

      // Get all rooms that actually have connected clients
      const marketRooms = marketNs.adapter?.rooms;
      const adminRooms = adminNs.adapter?.rooms;
      
      const { roomSubscriptions, broadcastPriceTicks } = require('./nativeWsServer');

      // Collect all active symbols with connected watchers
      const symbolsToAnimate = new Set(watchedSymbols);

      if (marketRooms) {
        for (const roomName of marketRooms.keys()) {
          if (roomName.startsWith('feed:')) {
            const subs = marketRooms.get(roomName);
            if (subs && subs.size > 0) {
              symbolsToAnimate.add(roomName.replace('feed:', '').toUpperCase());
            }
          }
        }
      }

      if (adminRooms) {
        for (const roomName of adminRooms.keys()) {
          if (roomName.startsWith('admin:feed:')) {
            const subs = adminRooms.get(roomName);
            if (subs && subs.size > 0) {
              symbolsToAnimate.add(roomName.replace('admin:feed:', '').toUpperCase());
            }
          }
        }
      }

      for (const symbol of symbolsToAnimate) {
        const anchor = anchorPrices.get(symbol);
        if (!anchor) continue;

        const marketRoomName = `feed:${symbol}`;
        const adminRoomName = `admin:feed:${symbol}`;

        // Check if anyone is watching in either namespace
        const hasMarketWatchers = marketRooms?.has(marketRoomName) && (marketRooms.get(marketRoomName)?.size || 0) > 0;
        const hasAdminWatchers = adminRooms?.has(adminRoomName) && (adminRooms.get(adminRoomName)?.size || 0) > 0;
        
        // Native WS subscribers check
        const nativeSubscribers = roomSubscriptions?.get(symbol);
        const hasNativeWatchers = nativeSubscribers && nativeSubscribers.size > 0;

        // Skip animation for exchanges that aren't approved (e.g., Finnhub)
        if (!ANIMATABLE_EXCHANGES.has(anchor.exchange)) continue;

        // Skip if market is closed
        if (!isMarketOpen(anchor.exchange)) continue;

        // Generate realistic micro-variation
        const microTick = generateMicroTick(symbol, anchor);
        if (!microTick) continue;

        // Emit to the rooms
        if (hasMarketWatchers) marketNs.to(marketRoomName).emit('MARKET:TICK', microTick);
        if (hasAdminWatchers) adminNs.to(adminRoomName).emit('MARKET:TICK', microTick);
        if (hasMarketWatchers || hasNativeWatchers) {
          try {
            broadcastPriceTicks([microTick]);
          } catch (e) {}
        }
        tickCount++;
      }
    } catch (err) {
      // Silently skip — don't let animator errors crash the server
    }
  }, ANIMATION_INTERVAL_MS);
}

/**
 * Generate a realistic micro-tick variation from the anchor price
 */
function generateMicroTick(symbol, anchor) {
  const basePrice = anchor.currentAnimatedPrice || anchor.price;
  if (!basePrice || basePrice <= 0) return null;

  const segment = getSegmentForExchange(anchor.exchange);
  if (!segmentSettings[segment]) {
    // Animator is OFF for this segment.
    // Return a flat tick with the exact live anchor price directly.
    anchor.currentAnimatedPrice = anchor.price;
    const change = anchor.prev_close > 0 ? +(anchor.price - anchor.prev_close).toFixed(getDecimalPlaces(anchor.price)) : anchor.change;
    const changePct = anchor.prev_close > 0 ? +((anchor.price - anchor.prev_close) / anchor.prev_close * 100).toFixed(2) : anchor.changePct;

    return {
      symbol,
      exchange: anchor.exchange,
      price: anchor.price,
      ltp: anchor.price,
      bid: anchor.bid || anchor.price,
      ask: anchor.ask || anchor.price,
      bid_qty: anchor.bid_qty || 0,
      ask_qty: anchor.ask_qty || 0,
      spread: anchor.ask && anchor.bid ? +(anchor.ask - anchor.bid).toFixed(getDecimalPlaces(anchor.price)) : 0,
      high: anchor.high || anchor.price,
      low: anchor.low || anchor.price,
      open: anchor.open,
      prev_close: anchor.prev_close,
      change,
      change_percent: changePct,
      changePercent: changePct,
      volume: anchor.volume,
      timestamp: Date.now(),
      _debug: { source: 'animator_bypass', anchorPrice: anchor.price },
    };
  }

  // Generate random micro-movement
  // Use a slight mean-reversion toward anchor price to prevent drift
  const driftFromAnchor = (basePrice - anchor.price) / anchor.price;
  const meanReversion = -driftFromAnchor * 0.3; // Pull back toward anchor

  // Random walk component
  const randomWalk = (Math.random() - 0.5) * 2 * MICRO_VARIATION_PCT;

  // Combined movement
  const totalMovement = randomWalk + meanReversion;
  const newPrice = +(basePrice * (1 + totalMovement)).toFixed(getDecimalPlaces(basePrice));

  // Update the animated price state
  anchor.currentAnimatedPrice = newPrice;

  // Calculate bid/ask with micro-spread
  const spreadVariation = basePrice * SPREAD_VARIATION_PCT;
  const bid = +(newPrice - spreadVariation * (0.5 + Math.random() * 0.5)).toFixed(getDecimalPlaces(basePrice));
  const ask = +(newPrice + spreadVariation * (0.5 + Math.random() * 0.5)).toFixed(getDecimalPlaces(basePrice));

  // Update high/low if the animated price exceeds
  const high = Math.max(anchor.high, newPrice);
  const low = Math.min(anchor.low, newPrice);

  // Calculate change from previous close
  const change = anchor.prev_close > 0 ? +(newPrice - anchor.prev_close).toFixed(getDecimalPlaces(basePrice)) : anchor.change;
  const changePct = anchor.prev_close > 0 ? +((newPrice - anchor.prev_close) / anchor.prev_close * 100).toFixed(2) : anchor.changePct;

  return {
    symbol,
    exchange: anchor.exchange,
    price: newPrice,
    ltp: newPrice,
    bid,
    ask,
    bid_qty: anchor.bid_qty ? Math.max(1, Math.floor(anchor.bid_qty * (0.8 + Math.random() * 0.4))) : Math.floor(Math.random() * 200) + 10,
    ask_qty: anchor.ask_qty ? Math.max(1, Math.floor(anchor.ask_qty * (0.8 + Math.random() * 0.4))) : Math.floor(Math.random() * 200) + 10,
    spread: +(ask - bid).toFixed(getDecimalPlaces(basePrice)),
    high,
    low,
    open: anchor.open,
    prev_close: anchor.prev_close,
    change,
    change_percent: changePct,
    changePercent: changePct,
    volume: anchor.volume,
    timestamp: Date.now(),
    _debug: { source: 'animator', anchorPrice: anchor.price },
  };
}

/**
 * Determine appropriate decimal places based on price magnitude
 */
function getDecimalPlaces(price) {
  if (price >= 1000) return 2;
  if (price >= 10) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 6;
  return 10; // For micro-priced tokens like PEPE/SHIB
}

/**
 * Stop the animator
 */
function stopAnimator() {
  if (animatorInterval) {
    clearInterval(animatorInterval);
    animatorInterval = null;
  }
  feedLogger.info(`[ANIMATOR] Stopped. Total micro-ticks emitted: ${tickCount}`);
}

/**
 * Get animator stats
 */
function getAnimatorStats() {
  return {
    running: !!animatorInterval,
    anchorSymbols: anchorPrices.size,
    totalMicroTicks: tickCount,
    intervalMs: ANIMATION_INTERVAL_MS,
    ticksPerSecond: Math.round(1000 / ANIMATION_INTERVAL_MS),
  };
}

module.exports = {
  updateAnchor,
  addWatcher,
  removeWatcher,
  startAnimator,
  stopAnimator,
  getAnimatorStats,
  getSegmentSettings,
  updateSegmentSetting,
};
