const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { getNormalizerStats } = require('../ws/feed/normalizer');
const { getIO } = require('../ws/socketServer');

const { authenticateUser, authenticateAdmin } = require('../middleware/auth');

/**
 * GET /api/instruments/debug
 * Server-side diagnostics for WebSocket connections and normalizer activity.
 */
router.get('/debug', authenticateAdmin, async (req, res) => {
  try {
    let wsClients = 0;
    let wsRooms = [];
    try {
      const io = getIO();
      wsClients = io.of('/market').sockets.size;
      for (const [roomName, clients] of io.of('/market').adapter.rooms.entries()) {
        if (roomName.startsWith('feed:')) {
          wsRooms.push({ room: roomName, clients: clients.size });
        }
      }
    } catch (e) {
      wsClients = `Error: ${e.message}`;
    }

    // Decode the service role key to see its actual role
    let serviceRoleInKey = "unknown";
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (key && key.includes('.')) {
        const payload = Buffer.from(key.split('.')[1], 'base64').toString();
        serviceRoleInKey = JSON.parse(payload).role;
      }
    } catch (e) {}

    let anonRoleInKey = "unknown";
    try {
      const key = process.env.SUPABASE_ANON_KEY;
      if (key && key.includes('.')) {
        const payload = Buffer.from(key.split('.')[1], 'base64').toString();
        anonRoleInKey = JSON.parse(payload).role;
      }
    } catch (e) {}

    res.json({
      normalizerStats: getNormalizerStats(),
      wsClients,
      wsRooms,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasFinnhubKey: !!process.env.FINNHUB_API_KEY,
        serviceKeyRoleDecoded: serviceRoleInKey,
        anonKeyRoleDecoded: anonRoleInKey,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const segment = req.query.segment; // optional filter
    const cache = require('../core/cache');
    const cacheKey = 'instruments:active';
    
    // Check in-memory cache first (extremely fast)
    let data = cache.get(cacheKey);

    if (!data) {
      // Check Redis cache (persistent across server restarts)
      try {
        const { redisClient } = require('../redis/client');
        const redisKey = 'instruments:active_list';
        const cached = await redisClient.get(redisKey);
        if (cached) {
          data = JSON.parse(cached);
          cache.set(cacheKey, data, 300000); // sync to memory cache
        }
      } catch (cacheErr) {}
    }

    if (!data) {
      const { fetchAllActiveInstruments } = require('../config/supabase');
      data = await fetchAllActiveInstruments('*');
      
      // Save to memory cache
      cache.set(cacheKey, data, 300000); // 5 minutes TTL
      
      // Save to Redis cache
      try {
        const { redisClient } = require('../redis/client');
        const redisKey = 'instruments:active_list';
        await redisClient.setex(redisKey, 3600, JSON.stringify(data)); // 1 hour TTL
      } catch (cacheErr) {}
    }

    // Clone the cached array before mutating (filtering/sorting)
    let result = [...data];

    if (segment) {
      result = result.filter(i => i.segment === segment);
    }

    // Sort by symbol
    result.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.json({ instruments: result || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instruments: ' + err.message });
  }
});

/**
 * GET /api/instruments/:symbol
 * Get single instrument by symbol
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('instruments')
      .select('*')
      .eq('symbol', req.params.symbol.toUpperCase())
      .single();

    if (error || !data) return res.status(404).json({ error: 'Instrument not found' });
    res.json({ instrument: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instrument' });
  }
});

/**
 * GET /api/instruments/:symbol/candles
 * Get historical candles from ohlc_1m with timeframe aggregation
 */
router.get('/:symbol/candles', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const timeframeStr = req.query.timeframe || '5m';
    const limit = Math.min(parseInt(req.query.limit) || 300, 1000);

    const TIMEFRAME_MINUTES = {
      '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
      '1M': 1, '5M': 5, '15M': 15, '30M': 30, '1H': 60, '4H': 240, '1D': 1440, '1W': 10080,
      'd': 1440, 'D': 1440, 'w': 10080, 'W': 10080, 'm': 43200, 'M': 43200
    };

    const intervalMinutes = TIMEFRAME_MINUTES[timeframeStr] || 5;
    const dbLimit = Math.min(limit * intervalMinutes, 30000);
    
    // We fetch the latest 1m candles and order by bucket_time descending
    const { data, error } = await supabaseAdmin
      .from('ohlc_1m')
      .select('bucket_time, open, high, low, close, volume')
      .eq('symbol', symbol)
      .order('bucket_time', { ascending: false })
      .limit(dbLimit);

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) {
      return res.json({ symbol, timeframe: timeframeStr, candles: [] });
    }

    // Map bucket_time to timestamp for compatibility and sort ascending for aggregation
    const rawCandles = data
      .map(c => ({
        timestamp: c.bucket_time,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume)
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Helper to get bucket start time based on timeframe alignment
    function getBucketTime(timeMs, intervalMin) {
      if (intervalMin === 10080) { // 1w: Align to Monday 00:00 UTC
        const date = new Date(timeMs);
        const day = date.getUTCDay();
        const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff, 0, 0, 0, 0));
        return monday.getTime();
      } else if (intervalMin === 1440) { // 1d: Align to UTC day start
        const date = new Date(timeMs);
        const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        return dayStart.getTime();
      } else if (intervalMin === 43200) { // 1M: Align to calendar Month start
        const date = new Date(timeMs);
        const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
        return monthStart.getTime();
      } else {
        const intervalMs = intervalMin * 60 * 1000;
        return Math.floor(timeMs / intervalMs) * intervalMs;
      }
    }

    // Aggregate raw 1m candles into the requested timeframe
    const aggregated = [];
    let currentBucket = null;

    for (const candle of rawCandles) {
      const timeMs = new Date(candle.timestamp).getTime();
      const bucketTimeMs = getBucketTime(timeMs, intervalMinutes);

      if (!currentBucket || currentBucket.timeMs !== bucketTimeMs) {
        if (currentBucket) {
          aggregated.push({
            time: currentBucket.timeMs / 1000, // Lightweight charts expects Unix epoch seconds
            open: currentBucket.open,
            high: currentBucket.high,
            low: currentBucket.low,
            close: currentBucket.close,
            volume: currentBucket.volume
          });
        }
        currentBucket = {
          timeMs: bucketTimeMs,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        };
      } else {
        currentBucket.high = Math.max(currentBucket.high, candle.high);
        currentBucket.low = Math.min(currentBucket.low, candle.low);
        currentBucket.close = candle.close;
        currentBucket.volume += candle.volume;
      }
    }

    if (currentBucket) {
      aggregated.push({
        time: currentBucket.timeMs / 1000,
        open: currentBucket.open,
        high: currentBucket.high,
        low: currentBucket.low,
        close: currentBucket.close,
        volume: currentBucket.volume
      });
    }

    // Return the latest candles up to the requested limit
    const sliced = aggregated.slice(-limit);

    res.json({ symbol, timeframe: timeframeStr, candles: sliced });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch historical candles' });
  }
});

module.exports = router;
