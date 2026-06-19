const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { getNormalizerStats } = require('../ws/feed/normalizer');
const { getIO } = require('../ws/socketServer');

const { authenticateUser } = require('../middleware/auth');

/**
 * GET /api/instruments/debug
 * Server-side diagnostics for WebSocket connections and normalizer activity.
 */
router.get('/debug', async (req, res) => {
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
 * Get historical candles from ohlc_1m
 */
router.get('/:symbol/candles', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const limit = parseInt(req.query.limit) || 100;
    
    // We fetch the latest candles and order by bucket_time descending
    const { data, error } = await supabaseAdmin
      .from('ohlc_1m')
      .select('bucket_time, open, high, low, close, volume')
      .eq('symbol', symbol)
      .order('bucket_time', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    
    // Map bucket_time to timestamp for compatibility and sort ascending for charts
    const candles = (data || [])
      .map(c => ({
        timestamp: c.bucket_time,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseInt(c.volume)
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ symbol, candles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch historical candles' });
  }
});

module.exports = router;
