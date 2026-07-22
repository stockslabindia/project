/**
 * Price Engine
 * 
 * Central market data broker that connects to multiple FREE feed providers:
 * - Fyers (Indian Stocks & Indices — real-time live feed)
 * - NSE India Direct (Fallback — Yahoo Finance 15-min delayed)
 * - Finnhub (US Stocks, Forex, Commodities — FREE with API key)
 * - Binance (Crypto — FREE, no key needed)
 * 
 * Throttles and broadcasts live ticks to active Socket.IO rooms,
 * and feeds ticks into the backend candle, execution, and risk pipelines.
 */

const { nseFeed } = require('../services/nseFeed');
const { fyersFeed } = require('../services/fyersFeed');
const { shoonyaFeed } = require('../services/shoonyaFeed');
const { finnhubFeed } = require('../services/finnhubFeed');
const { binanceFeed } = require('../services/binanceFeed');
const { loadFromDatabase: loadSymbolMap, getInstrumentsBySegment, getInstrumentDetails, SEGMENT_PROVIDER } = require('../services/symbolMap');
const candleAggregator = require('./candleAggregator');
const executionEngine = require('./executionEngine');
const { getIO } = require('./socketServer');
const { cacheTickPrice } = require('../core/pnl/mtmCalculator');
const { processTick: processOHLC } = require('./feed/ohlcAggregator');
const { updateAnchor, startAnimator, stopAnimator, getAnimatorStats } = require('./priceAnimator');
const { feedLogger } = require('../core/monitoring/logger');

let mockInterval = null;
let lastLiveTickTime = 0;
let activeIndianFeed = 'fyers'; // Can be 'shoonya' or 'fyers'

// ── Tick throttle: max 1 emit per symbol per 250ms ──
// Prevents flooding the Socket.IO bus when providers send high-frequency updates.
const TICK_THROTTLE_MS = 250;
const lastEmitTime = new Map(); // symbol → timestamp

// ── Track per-symbol last known prices (for stale detection) ──
const lastKnownPrices = new Map(); // symbol → { price, timestamp }

// ── Pending DB updates (batched every 5s to avoid hammering Supabase) ──
const pendingDbUpdates = new Map(); // symbol → tick data
let dbFlushInterval = null;
const DB_FLUSH_INTERVAL_MS = process.env.NODE_ENV === 'production' ? 5000 : 60000; // Flush to DB every 5 seconds (60s in dev)

/**
 * Handle a normalized tick from any source
 */
function handleTick(tick) {
  if (!tick || !tick.symbol) return;

  // Track live tick timestamps
  if (!tick._debug || tick._debug.source !== 'local_simulator') {
    lastLiveTickTime = Date.now();
  }

  // Update last known price
  lastKnownPrices.set(tick.symbol, {
    price: tick.price || tick.ltp,
    timestamp: Date.now(),
    source: tick._debug?.source || 'unknown',
  });

  // ── Indian MCX Live Conversions (derive INR prices from USD international ticks) ──
  if (SEGMENT_PROVIDER['mcx'] !== 'fyers' && (tick.symbol === 'XAUUSD' || tick.symbol === 'XAGUSD' || tick.symbol === 'CRUDEOIL_USD' || tick.symbol === 'NATURALGAS_USD' || tick.symbol === 'COPPER_USD')) {
    setImmediate(() => {
      try {
        const usdinrData = lastKnownPrices.get('USDINR');
        const usdinr = usdinrData ? parseFloat(usdinrData.price) : 83.50; // fallback to 83.50
        const usdPrice = parseFloat(tick.price || tick.ltp);
        
        let inrSymbol = '';
        let inrPrice = 0;
        let tickSize = 1;
        
        if (tick.symbol === 'XAUUSD') {
          inrSymbol = 'GOLD';
          // Gold Spot: USD per troy ounce. 1 troy ounce = 31.1035 grams. MCX GOLD contract is per 10 grams.
          inrPrice = (usdPrice / 31.1035) * 10 * usdinr;
          tickSize = 1;
        } else if (tick.symbol === 'XAGUSD') {
          inrSymbol = 'SILVER';
          // Silver Spot: USD per troy ounce. MCX SILVER contract is per kg.
          inrPrice = (usdPrice / 31.1035) * 1000 * usdinr;
          tickSize = 1;
        } else if (tick.symbol === 'CRUDEOIL_USD') {
          inrSymbol = 'CRUDEOIL';
          // Crude Oil: USD per barrel. MCX Crude contract is per barrel in INR.
          inrPrice = usdPrice * usdinr;
          tickSize = 1;
        } else if (tick.symbol === 'NATURALGAS_USD') {
          inrSymbol = 'NATURALGAS';
          // Natural Gas: USD per mmBtu. MCX Natural Gas contract is per mmBtu in INR.
          inrPrice = usdPrice * usdinr;
          tickSize = 0.1;
        } else if (tick.symbol === 'COPPER_USD') {
          inrSymbol = 'COPPER';
          // Copper: USD per pound (lb) internationally. 1 lb = 0.453592 kg. MCX Copper contract is per kg in INR.
          inrPrice = (usdPrice / 0.453592) * usdinr;
          tickSize = 0.05;
        }
        
        if (inrSymbol && inrPrice > 0) {
          // Round to nearest tick_size
          inrPrice = Math.round(inrPrice / tickSize) * tickSize;
          
          const inrTick = {
            symbol: inrSymbol,
            exchange: 'MCX',
            price: inrPrice,
            ltp: inrPrice,
            bid: inrPrice,
            ask: inrPrice,
            high: tick.high ? Math.round((parseFloat(tick.high) * (inrPrice / usdPrice))) : inrPrice,
            low: tick.low ? Math.round((parseFloat(tick.low) * (inrPrice / usdPrice))) : inrPrice,
            open: tick.open ? Math.round((parseFloat(tick.open) * (inrPrice / usdPrice))) : inrPrice,
            prev_close: tick.prev_close ? Math.round((parseFloat(tick.prev_close) * (inrPrice / usdPrice))) : inrPrice,
            change: 0,
            change_percent: tick.change_percent || tick.changePercent || 0,
            changePercent: tick.changePercent || tick.change_percent || 0,
            volume: 0,
            timestamp: Date.now(),
            _debug: { source: 'mcx_derived', providerSymbol: tick.symbol },
          };
          
          handleTick(inrTick);
        }
      } catch (err) {
        feedLogger.error(`MCX derived tick failed for ${tick.symbol}: ${err.message}`);
      }
    });
  }

  // 1. Update price animator anchor (the animator is the sole Socket.IO emitter)
  //    This prevents double-emission: once here + once from animator on every real tick.
  if (!tick._debug || tick._debug.source !== 'local_simulator') {
    updateAnchor(tick);
  }

  // Immediately broadcast to native WebSocket clients only (lightweight, binary-friendly)
  // Socket.IO clients receive the tick via the animator at the next 250ms interval.
  try {
    const { broadcastPriceTicks } = require('./nativeWsServer');
    broadcastPriceTicks([tick]);
  } catch (err) {}

  // 2. Queue for periodic DB flush (only for live data, not simulator)
  if (!tick._debug || tick._debug.source !== 'local_simulator') {
    let hasSubscribers = false;
    try {
      const io = getIO();
      if (io) {
        const marketRoom = io.of('/market').adapter.rooms.get(`feed:${tick.symbol}`);
        const adminRoom = io.of('/admin').adapter.rooms.get(`admin:feed:${tick.symbol}`);
        hasSubscribers = (marketRoom && marketRoom.size > 0) || (adminRoom && adminRoom.size > 0);
      }
    } catch (e) {}

    const now = Date.now();
    const lastUpdate = lastKnownPrices.get(`${tick.symbol}_db`) || 0;
    
    // Update if there are subscribers, or if it's been > 60s for non-subscribed
    if (hasSubscribers || (now - lastUpdate > 60000)) {
      lastKnownPrices.set(`${tick.symbol}_db`, now);
      pendingDbUpdates.set(tick.symbol, {
        last_price: tick.ltp || tick.price,
        bid_price: tick.bid || tick.ltp || tick.price,
        ask_price: tick.ask || tick.ltp || tick.price,
        day_open: tick.open || 0,
        day_high: tick.high || 0,
        day_low: tick.low || 0,
        change_amount: tick.change || 0,
        change_percent: tick.changePercent || tick.change_percent || 0,
        volume: Math.floor(tick.volume || 0),
        last_price_update: new Date(now).toISOString(),
      });
    }
  }

  // 3. Heavy pipeline processing (candles, limits, risk, margin) handled asynchronously
  setImmediate(() => {
    try {
      candleAggregator.processTickForCandles(tick);
      processOHLC(tick);
      executionEngine.evaluateTick(tick);
      cacheTickPrice(tick.symbol, tick.ltp || tick.price, tick.bid || tick.price, tick.ask || tick.price);
    } catch (err) {
      feedLogger.error(`Pipeline execution failed for ${tick.symbol}: ${err.message}`);
    }
  });
}

/**
 * Flush pending price updates to database in batch
 * Runs every DB_FLUSH_INTERVAL_MS to avoid hammering Supabase
 */
async function flushPricesToDb() {
  if (pendingDbUpdates.size === 0) return;

  try {
    const { supabaseAdmin } = require('../config/supabase');
    const updates = new Map(pendingDbUpdates);
    pendingDbUpdates.clear();

    const updateEntries = Array.from(updates.entries());
    
    // Convert map entries to list of objects for bulk upsert, validating that required fields are present
    const payload = [];
    const skippedEntries = [];

    for (const [symbol, data] of updateEntries) {
      if (!symbol || symbol === 'undefined' || symbol === 'null') {
        skippedEntries.push({ symbol, reason: 'invalid/falsy symbol' });
        continue;
      }

      const details = getInstrumentDetails(symbol);
      const name = details?.name || symbol;
      const segment = details?.segment || 'nse_equity';

      if (!name || name === 'undefined' || name === 'null') {
        skippedEntries.push({ symbol, name, reason: 'invalid/falsy name' });
        continue;
      }

      payload.push({
        symbol,
        name,
        segment,
        ...data
      });
    }

    if (skippedEntries.length > 0) {
      feedLogger.warn(`[DB FLUSH] Skipped ${skippedEntries.length} invalid entries from batch flush. Sample: ${JSON.stringify(skippedEntries.slice(0, 5))}`);
    }

    let successCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      try {
        const { error } = await supabaseAdmin
          .from('instruments')
          .upsert(batch, { onConflict: 'symbol' });
        
        if (error) {
          errorCount += batch.length;
          feedLogger.error(`[DB FLUSH] Bulk upsert error for batch of ${batch.length}: ${error.message}`);
        } else {
          successCount += batch.length;
        }
      } catch (err) {
        errorCount += batch.length;
        feedLogger.error(`[DB FLUSH] Bulk upsert exception: ${err.message}`);
      }
      
      // Short delay between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (errorCount > 0) {
      feedLogger.warn(`[DB FLUSH] Bulk update complete. ${successCount} updated successfully, ${errorCount} failed out of ${updateEntries.length} symbols.`);
    }
  } catch (err) {
    feedLogger.error(`[DB FLUSH] Failed to flush prices: ${err.message}`);
  }
}

let openPositionSymbols = new Set();
let pendingOrderSymbols = new Set();

// Periodically fetch open positions and pending limit orders to simulate and track them for feeds
setInterval(async () => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const [positionsRes, ordersRes] = await Promise.all([
      supabaseAdmin
        .from('positions')
        .select('symbol')
        .in('status', ['OPEN', 'open']),
      supabaseAdmin
        .from('orders')
        .select('symbol')
        .eq('status', 'pending')
        .eq('order_type', 'limit')
    ]);

    if (positionsRes.data) {
      openPositionSymbols = new Set(positionsRes.data.map(p => p.symbol.toUpperCase()));
    }
    if (ordersRes.data) {
      pendingOrderSymbols = new Set(ordersRes.data.map(o => o.symbol.toUpperCase()));
    }
  } catch (err) {
    // Fail silent
  }
}, 30000);

let dynamicSymbolTimer = null;

/**
 * Periodically rebuild the list of required symbols to poll/subscribe
 * based on watched list, open positions, pending limit orders, and popular instruments.
 */
function startDynamicSymbolPolling() {
  if (dynamicSymbolTimer) clearInterval(dynamicSymbolTimer);

  const updateSymbols = async () => {
    const isFyersActive = fyersFeed.status === 'CONNECTED';
    const isShoonyaActive = shoonyaFeed.status === 'CONNECTED';
    const isNseActive = nseFeed.status === 'CONNECTED';
    
    if (!isFyersActive && !isNseActive && !isShoonyaActive) return;

    const watched = getWatchedSymbols();
    const pendingOrders = pendingOrderSymbols;

    const popular = new Set([
      'NIFTY50', 'BANKNIFTY', 'SENSEX',
      'GOLD', 'SILVER', 'CRUDEOIL', 'NATURALGAS', 'COPPER',
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDINR',
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT',
      'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS', 'SBIN'
    ]);

    const activeSymbols = new Set();
    for (const sym of watched) activeSymbols.add(sym);
    for (const sym of openPositionSymbols) activeSymbols.add(sym);
    for (const sym of pendingOrders) activeSymbols.add(sym);
    for (const sym of popular) activeSymbols.add(sym);

    const symbolsToTrack = [];
    const indicesToTrack = [];

    for (const sym of activeSymbols) {
      if (sym === 'NIFTY50' || sym === 'BANKNIFTY' || sym === 'SENSEX') {
        indicesToTrack.push(sym);
      } else {
        const details = getInstrumentDetails(sym);
        if (details && (
          details.segment === 'nse_equity' || 
          details.segment === 'bse_equity' || 
          details.segment === 'fo_futures' || 
          details.segment === 'fo_options' || 
          details.segment === 'mcx'
        )) {
          symbolsToTrack.push(sym);
        }
      }
    }

    const allTargetSymbols = [...new Set([...symbolsToTrack, ...indicesToTrack])];

    // Manage Subscriptions based on Active Indian Feed
    if (activeIndianFeed === 'shoonya' && isShoonyaActive) {
      // Unsubscribe everything from Fyers to save bandwidth
      if (isFyersActive) {
        const currentFyers = Array.from(fyersFeed.subscribedSymbols);
        if (currentFyers.length > 0) fyersFeed.unsubscribe(currentFyers).catch(()=>{});
      }
      
      const currentSubscribed = shoonyaFeed.subscribedSymbols;
      const toSubscribe = allTargetSymbols.filter(sym => !currentSubscribed.has(sym));
      const toUnsubscribe = Array.from(currentSubscribed).filter(sym => !allTargetSymbols.includes(sym) && !popular.has(sym));

      if (toSubscribe.length > 0) shoonyaFeed.subscribe(toSubscribe).catch(()=>{});
      if (toUnsubscribe.length > 0) shoonyaFeed.unsubscribe(toUnsubscribe).catch(()=>{});

    } else if (activeIndianFeed === 'fyers' && isFyersActive) {
      // Unsubscribe everything from Shoonya
      if (isShoonyaActive) {
        const currentShoonya = Array.from(shoonyaFeed.subscribedSymbols);
        if (currentShoonya.length > 0) shoonyaFeed.unsubscribe(currentShoonya).catch(()=>{});
      }

      // Manage Fyers dynamic subscriptions
      const currentSubscribed = fyersFeed.subscribedSymbols; // Set of internal symbols

      // Find symbols to subscribe
      const toSubscribe = allTargetSymbols.filter(sym => !currentSubscribed.has(sym));
      
      // Find symbols to unsubscribe (but keep popular ones always subscribed to avoid thrashing)
      const toUnsubscribe = Array.from(currentSubscribed).filter(sym => {
        return !allTargetSymbols.includes(sym) && !popular.has(sym);
      });

      if (toSubscribe.length > 0) {
        try {
          await fyersFeed.subscribe(toSubscribe);
        } catch (err) {
          feedLogger.error(`[PRICE ENGINE] Fyers dynamic subscribe failed: ${err.message}`);
        }
      }
      if (toUnsubscribe.length > 0) {
        try {
          await fyersFeed.unsubscribe(toUnsubscribe);
        } catch (err) {
          feedLogger.error(`[PRICE ENGINE] Fyers dynamic unsubscribe failed: ${err.message}`);
        }
      }
    } else if (isNseActive && !isFyersActive && !isShoonyaActive) {
      // Update nseFeed properties for Yahoo polling fallback
      nseFeed.activeSymbols = [...new Set(symbolsToTrack)];
      nseFeed.indexSymbols = [...new Set(indicesToTrack)];
    }
  };

  // Run immediately and then every 10 seconds
  updateSymbols();
  dynamicSymbolTimer = setInterval(updateSymbols, 10000);
}

function getWatchedSymbols() {
  const watched = new Set();
  
  // 1. Get from Native WS Server
  try {
    const { roomSubscriptions } = require('./nativeWsServer');
    if (roomSubscriptions) {
      for (const [symbol, subs] of roomSubscriptions.entries()) {
        if (subs && subs.size > 0) {
          watched.add(symbol.toUpperCase());
        }
      }
    }
  } catch (e) {}

  // 2. Get from Socket.IO rooms
  try {
    const io = getIO();
    if (io) {
      const marketRooms = io.of('/market').adapter.rooms;
      const adminRooms = io.of('/admin').adapter.rooms;
      
      if (marketRooms) {
        for (const roomName of marketRooms.keys()) {
          if (roomName.startsWith('feed:')) {
            const sym = roomName.replace('feed:', '').toUpperCase();
            const subs = marketRooms.get(roomName);
            if (subs && subs.size > 0) {
              watched.add(sym);
            }
          }
        }
      }

      if (adminRooms) {
        for (const roomName of adminRooms.keys()) {
          if (roomName.startsWith('admin:feed:')) {
            const sym = roomName.replace('admin:feed:', '').toUpperCase();
            const subs = adminRooms.get(roomName);
            if (subs && subs.size > 0) {
              watched.add(sym);
            }
          }
        }
      }
    }
  } catch (e) {}

  return watched;
}

/**
 * Local Simulator - strictly used in development fallback ONLY
 */
async function startMockFeed() {
  // NEVER run mock simulator in production — the user explicitly does not want fake data.
  if (process.env.NODE_ENV === 'production') {
    feedLogger.info('Production mode — mock simulator disabled.');
    return;
  }

  try {
    const { fetchAllActiveInstruments } = require('../config/supabase');
    
    // Load active instruments
    const instruments = await fetchAllActiveInstruments('symbol, last_price');
      
    if (!instruments || instruments.length === 0) {
      feedLogger.warn('Mock Feed: No active instruments found in DB.');
      return;
    }

    const prices = {};
    instruments.forEach(i => {
      prices[i.symbol] = parseFloat(i.last_price) || 100;
    });

    const popularSymbols = new Set([
      'NIFTY50', 'BANKNIFTY', 'SENSEX',
      'GOLD', 'SILVER', 'CRUDEOIL', 'NATURALGAS', 'COPPER',
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDINR',
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT',
      'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS', 'SBIN'
    ]);

    feedLogger.info(`Development Backup: Simulated ${instruments.length} active instruments loaded.`);

    mockInterval = setInterval(() => {
      // Only simulate if no live feed ticks have arrived in the last 10 seconds
      const isLiveFeedOffline = (Date.now() - lastLiveTickTime) > 10000;
      if (!isLiveFeedOffline) return;

      const watched = getWatchedSymbols();

      instruments.forEach(inst => {
        const symUpper = inst.symbol.toUpperCase();
        
        // Only simulate watched symbols, popular symbols, or symbols with active positions
        const shouldSimulate = watched.has(symUpper) || popularSymbols.has(symUpper) || openPositionSymbols.has(symUpper);
        if (!shouldSimulate) return;

        const currentPrice = prices[inst.symbol];
        const changePct = (Math.random() - 0.5) * 0.0006; // Micro price changes
        const changeAmount = currentPrice * changePct;
        const newPrice = Math.max(0.1, +(currentPrice + changeAmount).toFixed(2));
        prices[inst.symbol] = newPrice;

        const spread = newPrice * 0.0005;
        const bid = +(newPrice - spread / 2).toFixed(2);
        const ask = +(newPrice + spread / 2).toFixed(2);

        const tick = {
          symbol: inst.symbol,
          exchange: 'NSE',
          price: newPrice,
          ltp: newPrice,
          bid,
          ask,
          change: +(newPrice - (inst.last_price || newPrice)).toFixed(2),
          changePercent: +((newPrice - (inst.last_price || newPrice)) / (inst.last_price || newPrice) * 100).toFixed(2),
          timestamp: Date.now(),
          _debug: { source: 'local_simulator' }
        };

        handleTick(tick);
      });
    }, 1000);

  } catch (err) {
    feedLogger.error('Failed to initialize local backup simulator:', err);
  }
}

let watchdogInterval = null;

/**
 * Initialize the Price Engine
 */
async function initPriceEngine() {
  feedLogger.info('═══════════════════════════════════════════════');
  feedLogger.info('  Initializing Multi-Provider Price Engine');
  feedLogger.info('  All providers are FREE — zero cost');
  feedLogger.info('═══════════════════════════════════════════════');

  // 1. Load symbol mappings from database
  await loadSymbolMap();

  // Get instruments by segment to route to the right provider
  const segmented = getInstrumentsBySegment();
  
  const nseEquities = segmented['nse_equity'] || [];
  const bseEquities = segmented['bse_equity'] || [];
  const foFutures = segmented['fo_futures'] || [];
  const foOptions = segmented['fo_options'] || [];
  const mcxSymbols = segmented['mcx'] || [];

  const indianSymbols = [...new Set([...nseEquities, ...bseEquities, ...foFutures, ...foOptions, ...mcxSymbols])];
  const indianIndices = ['NIFTY50', 'BANKNIFTY'];

  // ── Start Shoonya Real-Time Feed ──
  let isShoonyaStarted = false;
  if (process.env.SHOONYA_USER_ID && process.env.SHOONYA_API_KEY) {
    feedLogger.info(`[PRICE ENGINE] 🇮🇳 Attempting to start Shoonya Real-Time Feed...`);
    shoonyaFeed.on('tick', handleTick);
    
    shoonyaFeed.on('status', (newStatus) => {
      feedLogger.info(`[PRICE ENGINE] Shoonya Feed status change: ${newStatus}`);
      try {
        const io = getIO();
        if (io) io.of('/market').emit('MARKET:FEED_STATUS', getFeedStatus());
      } catch (err) {}
    });

    isShoonyaStarted = await shoonyaFeed.start();
  }

  // ── Start Fyers Real-Time Feed ──
  let isFyersStarted = false;
  if (process.env.FYERS_USER_ID && process.env.FYERS_TOTP_SECRET && process.env.FYERS_PIN) {
    feedLogger.info(`[PRICE ENGINE] 🇮🇳 Attempting to start Fyers Real-Time Feed...`);
    fyersFeed.on('tick', handleTick);

    // Broadcast status to Socket.IO clients on status change
    fyersFeed.on('status', (newStatus) => {
      feedLogger.info(`[PRICE ENGINE] Fyers Feed status change: ${newStatus}`);
      try {
        const io = getIO();
        if (io) {
          io.of('/market').emit('MARKET:FEED_STATUS', getFeedStatus());
        }
      } catch (err) {}
    });

    isFyersStarted = await fyersFeed.start();
  }

  // Fallback to Yahoo (nseFeed) is strictly disabled per production requirements
  // We only rely on the real-time Feeds to prevent delayed price arbitrage.
  if (!isFyersStarted && !isShoonyaStarted && (indianSymbols.length > 0 || indianIndices.length > 0)) {
    feedLogger.warn(`[PRICE ENGINE] ⚠️ Indian Feeds are offline. Yahoo fallback is DISABLED to prevent delayed price arbitrage. Prices will remain static.`);
  }

  // ── US Stocks, Forex, Commodities: Finnhub (FREE with API key) ──
  const finnhubApiKey = process.env.FINNHUB_API_KEY || '';
  const forexSymbols = segmented['forex'] || [];
  const usEquities = segmented['us_equity'] || [];
  
  if (finnhubApiKey && finnhubApiKey !== 'your_finnhub_api_key_here') {
    feedLogger.info('[PRICE ENGINE] 🌍 Starting Finnhub feed (FREE — US stocks, forex, commodities)');
    finnhubFeed.on('tick', handleTick);
    await finnhubFeed.start(finnhubApiKey);
  } else {
    if (forexSymbols.length > 0 || usEquities.length > 0) {
      feedLogger.warn('[PRICE ENGINE] ⚠️ FINNHUB_API_KEY missing — US stocks & forex feed disabled');
      feedLogger.warn('[PRICE ENGINE] Get a free API key at https://finnhub.io');
    }
  }

  // ── Crypto: Binance (FREE, no key needed) ──
  feedLogger.info('[PRICE ENGINE] ₿ Starting Binance feed (FREE — no key needed)');
  binanceFeed.on('tick', handleTick);
  binanceFeed.start();

  // Start dynamic polling now that feeds are initialized
  startDynamicSymbolPolling();

  // 4. Always boot dev simulator as backup (it enforces dev env check internally)
  startMockFeed();

  // 5. Watchdog — monitor feed health
  watchdogInterval = setInterval(() => {
    const timeSinceLastTick = Date.now() - lastLiveTickTime;

    // Log health status every 60s
    if (timeSinceLastTick > 60000) {
      feedLogger.warn(`[WATCHDOG] No live ticks received in ${Math.round(timeSinceLastTick / 1000)}s`);

      // Try reconnecting Finnhub if it's been > 2 minutes
      if (timeSinceLastTick > 120000 && finnhubApiKey) {
        feedLogger.warn('[WATCHDOG] Attempting Finnhub reconnect...');
        finnhubFeed.stop();
        finnhubFeed.start(finnhubApiKey);
      }
    }

    // Fyers watchdog
    if (process.env.FYERS_USER_ID && process.env.FYERS_TOTP_SECRET && process.env.FYERS_PIN) {
      if (fyersFeed.status === 'CONNECTED') {
        const now = Date.now();
        const lastFyersTick = fyersFeed.stats.lastTickTime;
        const fyersTickAge  = lastFyersTick ? (now - lastFyersTick) : (now - lastLiveTickTime);

        if (fyersTickAge > 60000) {
          const { checkMarketHours } = require('../core/risk/marketHours');
          checkMarketHours('nse_equity').then((hoursCheck) => {
            if (hoursCheck.open) {
              feedLogger.warn(`[WATCHDOG] Fyers Feed has not sent ticks in ${Math.round(fyersTickAge / 1000)}s during market hours. Triggering reconnect...`);
              fyersFeed.resetCircuitBreaker().catch((err) => {
                feedLogger.error(`[WATCHDOG] Fyers resetCircuitBreaker failed: ${err.message}`);
              });
            }
          }).catch((err) => {
            feedLogger.error(`[WATCHDOG] Fyers check market hours failed: ${err.message}`);
          });
        }
      } else if (fyersFeed.status === 'ERROR' || fyersFeed.status === 'DISCONNECTED') {
        // Auto-reconnect if offline during market hours
        const { checkMarketHours } = require('../core/risk/marketHours');
        checkMarketHours('nse_equity').then((hoursCheck) => {
          if (hoursCheck.open) {
            feedLogger.info(`[WATCHDOG] Fyers is offline (${fyersFeed.status}) during market hours. Attempting restart...`);
            fyersFeed.start().then((success) => {
              if (success) {
                feedLogger.info('[WATCHDOG] Fyers Feed restarted successfully.');
                if (nseFeed && typeof nseFeed.stop === 'function') {
                  feedLogger.info('[WATCHDOG] Stopping Yahoo Finance fallback feed since Fyers is active.');
                  nseFeed.stop();
                }
              } else {
                feedLogger.warn('[WATCHDOG] Fyers restart attempt failed. Will retry next cycle.');
              }
            }).catch((err) => {
              feedLogger.error(`[WATCHDOG] Fyers restart error: ${err.message}`);
            });
          }
        }).catch((err) => {
          feedLogger.error(`[WATCHDOG] Fyers market hours check failed: ${err.message}`);
        });
      }
    }
  }, 30000);

  // 6. Start periodic DB price flush (updates instruments table with live prices)
  dbFlushInterval = setInterval(flushPricesToDb, DB_FLUSH_INTERVAL_MS);
  feedLogger.info(`[PRICE ENGINE] 💾 DB price flush active (every ${DB_FLUSH_INTERVAL_MS / 1000}s)`);

  // 7. Start high-frequency price animator (makes UI feel like Zerodha)
  startAnimator();

  // 8. Log summary
  feedLogger.info('═══════════════════════════════════════════════');
  feedLogger.info('  Price Engine Initialized — ALL FREE');
  feedLogger.info(`  🇮🇳 NSE India: ${(nseEquities.length + bseEquities.length) > 0 ? 'ACTIVE' : 'NO SYMBOLS'} (free, no key)`);
  feedLogger.info(`  🌍 Finnhub:   ${finnhubApiKey ? 'ACTIVE' : 'DISABLED (no key)'} (free tier)`);
  feedLogger.info(`  ₿  Binance:   ACTIVE (free, no key)`);
  feedLogger.info(`  💾 DB Flush:  every ${DB_FLUSH_INTERVAL_MS / 1000}s`);
  feedLogger.info(`  ⚡ Animator:  ~7-8 ticks/sec per symbol (Zerodha-speed)`);
  feedLogger.info(`  🔧 Dev Sim:   ${process.env.NODE_ENV !== 'production' ? 'STANDBY' : 'DISABLED'}`);
  feedLogger.info('═══════════════════════════════════════════════');
}

/**
 * Stop Price Engine
 */
function stopPriceEngine() {
  if (dynamicSymbolTimer) {
    clearInterval(dynamicSymbolTimer);
    dynamicSymbolTimer = null;
  }
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  if (dbFlushInterval) {
    clearInterval(dbFlushInterval);
    dbFlushInterval = null;
  }
  // Final flush before shutdown
  flushPricesToDb();
  stopAnimator();
  fyersFeed.stop();
  shoonyaFeed.stop();
  nseFeed.stop();
  finnhubFeed.stop();
  binanceFeed.stop();
  feedLogger.info('Price Engine shut down successfully.');
}

/**
 * Get feed status for health checks
 */
function getFeedStatus() {
  return {
    shoonya: shoonyaFeed.getStatus(),
    fyers:   fyersFeed.getStatus(),
    nse: nseFeed.getStatus(),
    finnhub: finnhubFeed.getStatus(),
    binance: binanceFeed.getStatus(),
    activeIndianFeed,
    lastLiveTickAge: Date.now() - lastLiveTickTime,
    totalSymbolsTracked: lastKnownPrices.size,
  };
}

function setActiveIndianFeed(provider) {
  if (provider === 'shoonya' || provider === 'fyers') {
    activeIndianFeed = provider;
    feedLogger.info(`[PRICE ENGINE] Active Indian Feed switched to ${provider.toUpperCase()}`);
    // Trigger polling immediately to apply unsubscriptions/subscriptions
    if (dynamicSymbolTimer) {
      clearInterval(dynamicSymbolTimer);
      startDynamicSymbolPolling();
    }
    
    // Broadcast updated status
    try {
      const io = getIO();
      if (io) io.of('/market').emit('MARKET:FEED_STATUS', getFeedStatus());
    } catch (err) {}
    
    return true;
  }
  return false;
}

module.exports = {
  initPriceEngine,
  stopPriceEngine,
  getFeedStatus,
  setActiveIndianFeed,
  stopPriceSimulation: stopPriceEngine, // maintaining legacy naming compatibility
  handleTick
};
