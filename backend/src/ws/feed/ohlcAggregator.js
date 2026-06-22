/**
 * OHLC Aggregator
 * 
 * Builds 1-minute candles in memory from normalized ticks.
 * At the turn of each minute (SS:00), flushes completed candles to Postgres
 * and caches them in Redis for fast historical chart reads.
 * 
 * This works alongside the existing candleAggregator.js (which handles
 * in-memory multi-timeframe candles for the WebSocket API).
 * This module adds persistence so candles survive server restarts.
 */

const { redisClient } = require('../../redis/client');
const { supabaseAdmin } = require('../../config/supabase');

// In-memory buffer: { symbol: { open, high, low, close, volume, bucketTime } }
const activeBuckets = {};
const pendingDbCandles = [];
const BUCKET_MS = 60 * 1000; // 1-minute buckets

/**
 * Process a normalized tick into the 1m OHLC bucket
 */
function processTick(tick) {
  if (!tick || !tick.symbol) return;
  const symbol = tick.symbol.toUpperCase().trim();
  const { ltp, timestamp } = tick;
  const bucketTime = Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;

  if (!activeBuckets[symbol]) {
    activeBuckets[symbol] = {
      bucketTime,
      open: ltp,
      high: ltp,
      low: ltp,
      close: ltp,
      volume: 1,
    };
    return;
  }

  const bucket = activeBuckets[symbol];

  // Same minute — update OHLC
  if (bucket.bucketTime === bucketTime) {
    bucket.high = Math.max(bucket.high, ltp);
    bucket.low = Math.min(bucket.low, ltp);
    bucket.close = ltp;
    bucket.volume += 1;
  } else {
    // New minute started — flush the old bucket and start a new one
    flushBucket(symbol, bucket);

    activeBuckets[symbol] = {
      bucketTime,
      open: ltp,
      high: ltp,
      low: ltp,
      close: ltp,
      volume: 1,
    };
  }
}

/**
 * Flush a completed 1m candle to Redis + Postgres
 */
async function flushBucket(symbol, bucket) {
  const candle = {
    symbol,
    timeframe: '1m',
    bucket_time: new Date(bucket.bucketTime).toISOString(),
    open: bucket.open,
    high: bucket.high,
    low: bucket.low,
    close: bucket.close,
    volume: bucket.volume,
  };

  // 1. Cache in Redis (sorted set by timestamp for fast range queries)
  try {
    const pipeline = redisClient.pipeline();
    pipeline.zadd(
      `ohlc:${symbol}:1m`,
      bucket.bucketTime,
      JSON.stringify(candle)
    );
    // Keep only last 500 candles in Redis (trim old ones)
    pipeline.zremrangebyrank(`ohlc:${symbol}:1m`, 0, -501);
    await pipeline.exec();
  } catch (err) {
    // Redis down — candle still gets persisted to Postgres below
  }

  // 2. Queue for Postgres bulk upsert
  pendingDbCandles.push(candle);

  // 3. Emit candle update to /market WebSocket room
  try {
    const { getIO } = require('../socketServer');
    const io = getIO();
    if (io) {
      io.of('/market').to(`feed:${symbol}`).emit('MARKET:CANDLE', {
        symbol,
        timeframe: '1m',
        candle: {
          time: bucket.bucketTime / 1000, // Unix epoch seconds
          open: bucket.open,
          high: bucket.high,
          low: bucket.low,
          close: bucket.close,
          volume: bucket.volume
        }
      });
    }
  } catch (err) {
    // Socket server may not be initialized yet or not imported correctly in test runs
  }
}

/**
 * Get historical 1m candles from Redis (fast) with Postgres fallback
 */
async function getHistoricalCandles(symbol, count = 200) {
  // Try Redis first
  try {
    const data = await redisClient.zrange(`ohlc:${symbol}:1m`, -count, -1);
    if (data && data.length > 0) {
      return data.map(d => JSON.parse(d));
    }
  } catch (err) {}

  // Fallback to Postgres
  try {
    const { data, error } = await supabaseAdmin
      .from('ohlc_1m')
      .select('*')
      .eq('symbol', symbol)
      .order('bucket_time', { ascending: false })
      .limit(count);

    if (!error && data) {
      return data.reverse();
    }
  } catch (err) {}

  return [];
}

/**
 * Safety flush: Run on a timer to ensure no candle stays in memory
 * longer than 2 minutes (handles edge cases where no new tick arrives).
 */
function startSafetyFlush() {
  setInterval(() => {
    const now = Date.now();
    const currentBucket = Math.floor(now / BUCKET_MS) * BUCKET_MS;

    for (const [symbol, bucket] of Object.entries(activeBuckets)) {
      // If the bucket is from a previous minute, flush it
      if (bucket.bucketTime < currentBucket) {
        flushBucket(symbol, bucket);
        // Reset to empty — next tick will create a new bucket
        delete activeBuckets[symbol];
      }
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Flush pending candles to Postgres in batch
 */
async function flushPendingCandlesToDb() {
  if (pendingDbCandles.length === 0) return;
  
  const rawCandles = [...pendingDbCandles];
  pendingDbCandles.length = 0; // Clear the queue

  // Deduplicate by symbol + bucket_time, keeping the latest one, normalizing case and whitespace
  const uniqueCandlesMap = new Map();
  rawCandles.forEach(c => {
    if (!c.symbol) return;
    const normSymbol = c.symbol.toUpperCase().trim();
    c.symbol = normSymbol; // Ensure the stored symbol is normalized
    const key = `${normSymbol}_${c.bucket_time}`;
    uniqueCandlesMap.set(key, c);
  });
  
  const candlesToFlush = Array.from(uniqueCandlesMap.values());

  const BATCH_SIZE = 100;
  for (let i = 0; i < candlesToFlush.length; i += BATCH_SIZE) {
    const batch = candlesToFlush.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabaseAdmin
        .from('ohlc_1m')
        .upsert(batch, { onConflict: 'symbol,bucket_time' });
      if (error) {
        console.error(`[OHLC DB BATCH FLUSH] Error flushing batch of ${batch.length} candles:`, error.message);
      }
    } catch (err) {
      console.error(`[OHLC DB BATCH FLUSH] Exception during flush:`, err.message);
    }
    // Short delay to avoid slamming the DB pool
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * Initialize the OHLC aggregator
 */
function initOHLCAggregator() {
  startSafetyFlush();
  // Flush pending candles to database every 5 seconds
  setInterval(flushPendingCandlesToDb, 5000);
  console.log('📊 OHLC 1m Aggregator started (flush every minute boundary, batch DB upsert every 5s)');
}

module.exports = { processTick, getHistoricalCandles, initOHLCAggregator };
