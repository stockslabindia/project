require('dotenv').config();
const axios = require('axios');
const { supabaseAdmin } = require('../src/config/supabase');
const { redisClient } = require('../src/redis/client');
const { fyersFeed, FYERS_SYMBOL_MAP } = require('../src/services/fyersFeed');

// Segment-to-provider mappings (same as priceEngine/symbolMap)
const SEGMENT_PROVIDER = {
  'nse_equity': 'fyers',
  'bse_equity': 'fyers',
  'fo_futures': 'fyers',
  'fo_options': 'fyers',
  'mcx': 'fyers',
  'crypto': 'binance',
  'forex': 'yahoo',
  'us_equity': 'yahoo',
  'global_indices': 'yahoo'
};

// Help helper to resolve Fyers symbol format
function getFyersSymbol(symbol, segment) {
  const upper = symbol.toUpperCase().trim();
  if (FYERS_SYMBOL_MAP[upper]) return FYERS_SYMBOL_MAP[upper];
  
  if (segment === 'nse_equity') {
    return `NSE:${upper}-EQ`;
  }
  if (segment === 'bse_equity') {
    return `BSE:${upper}-EQ`;
  }
  if (segment === 'mcx') {
    // MCX symbol format: e.g. "MCX:GOLD26AUGFUT". Fyers master resolver will already map contracts
    // We fall back to the mapped symbol if fyersFeed has it, or just use symbol directly
    return `MCX:${upper}FUT`; 
  }
  return null;
}

// Convert Yahoo Finance format
function getYahooSymbol(symbol, segment) {
  const upper = symbol.toUpperCase().trim();
  if (segment === 'forex') {
    // GBPUSD -> GBPUSD=X, USDINR -> USDINR=X
    return `${upper}=X`;
  }
  if (upper === 'SPX500') return '^GSPC';
  if (upper === 'NASDAQ') return '^IXIC';
  if (upper === 'NASDAQ100') return '^NDX';
  return upper;
}

// Sleep utility to respect rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let targetSymbols = null;
  let targetSegment = null;
  let daysToFetch = 30;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--symbols' && args[i + 1]) {
      targetSymbols = args[i + 1].split(',').map(s => s.trim().toUpperCase());
    } else if (args[i] === '--segment' && args[i + 1]) {
      targetSegment = args[i + 1].trim().toLowerCase();
    } else if (args[i] === '--days' && args[i + 1]) {
      daysToFetch = parseInt(args[i + 1]) || 30;
    }
  }

  console.log(`Starting historical OHLC backfill for ${daysToFetch} days...`);

  try {
    // 1. Load active instruments
    let query = supabaseAdmin
      .from('instruments')
      .select('symbol, segment, name, is_active')
      .eq('is_active', true);

    if (targetSymbols) {
      query = query.in('symbol', targetSymbols);
      console.log(`Filtering for specific symbols: ${targetSymbols.join(', ')}`);
    } else if (targetSegment) {
      query = query.eq('segment', targetSegment);
      console.log(`Filtering for specific segment: ${targetSegment}`);
    }

    const { data: instruments, error } = await query;
    if (error) throw error;

    console.log(`Found ${instruments.length} active instruments to backfill.`);

    // 2. Resolve Fyers authentication and dynamic symbol mappings if needed for Indian markets
    let fyersToken = null;
    let fyersAppId = process.env.FYERS_APP_ID;
    const hasIndianMarkets = instruments.some(inst => SEGMENT_PROVIDER[inst.segment] === 'fyers');

    if (hasIndianMarkets) {
      console.log('Initializing Fyers feed service for symbol mappings and auth...');
      const ok = await fyersFeed.start();
      if (ok) {
        fyersToken = fyersFeed.accessToken;
        fyersFeed.stop(); // Stop WS connection so script can exit cleanly
        console.log('Fyers initialization succeeded.');
      } else {
        console.warn('❌ Fyers initialization failed. Indian stock charts backfill will be skipped.');
      }
    }

    // 3. Process each instrument
    let successCount = 0;
    let failCount = 0;

    for (let index = 0; index < instruments.length; index++) {
      const inst = instruments[index];
      const provider = SEGMENT_PROVIDER[inst.segment] || 'yahoo';
      
      console.log(`[${index + 1}/${instruments.length}] Fetching ${inst.symbol} (${inst.segment}) from ${provider}...`);

      let candles = [];

      try {
        if (provider === 'fyers') {
          if (!fyersToken) {
            console.log(`Skipping Fyers symbol ${inst.symbol} (auth token missing)`);
            continue;
          }
          candles = await fetchFyersCandles(inst, fyersAppId, fyersToken, daysToFetch);
        } else if (provider === 'binance') {
          candles = await fetchBinanceCandles(inst.symbol, daysToFetch);
        } else if (provider === 'yahoo') {
          const yahooSymbol = getYahooSymbol(inst.symbol, inst.segment);
          candles = await fetchYahooCandles(yahooSymbol, inst.symbol, daysToFetch);
        }

        if (candles.length > 0) {
          // Bulk upsert into public.ohlc_1m
          console.log(`Fetched ${candles.length} candles for ${inst.symbol}. Upserting to Supabase...`);
          
          const BATCH_SIZE = 500;
          for (let i = 0; i < candles.length; i += BATCH_SIZE) {
            const batch = candles.slice(i, i + BATCH_SIZE);
            const { error: upsertErr } = await supabaseAdmin
              .from('ohlc_1m')
              .upsert(batch, { onConflict: 'symbol,bucket_time' });

            if (upsertErr) {
              console.error(`❌ Upsert error for ${inst.symbol} batch starting at ${i}:`, upsertErr.message);
            }
          }
          
          successCount++;
          console.log(`✅ Backfilled ${inst.symbol} successfully.`);
        } else {
          console.log(`⚠️ No candles found for ${inst.symbol}.`);
          failCount++;
        }
      } catch (err) {
        console.error(`❌ Failed to backfill ${inst.symbol}:`, err.message);
        failCount++;
      }

      // Throttle requests (e.g. 500ms delay) to avoid slamming third-party endpoints
      await sleep(500);
    }

    console.log(`\nBackfill finished!`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

  } catch (err) {
    console.error('Fatal backfill error:', err);
  } finally {
    await redisClient.quit();
    process.exit(0);
  }
}

/**
 * Fetch historical 1m candles from Fyers Historical Data API
 */
async function fetchFyersCandles(inst, appId, token, days) {
  const fyersSymbol = getFyersSymbol(inst.symbol, inst.segment);
  if (!fyersSymbol) {
    console.warn(`No Fyers symbol mapping for ${inst.symbol}`);
    return [];
  }

  // Set date ranges
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const formatDateStr = (d) => d.toISOString().split('T')[0];

  const params = {
    symbol: fyersSymbol,
    resolution: '1',
    date_format: '1',
    range_from: formatDateStr(fromDate),
    range_to: formatDateStr(toDate),
    cont_flag: '1'
  };

  const appIdShort = appId.split('-')[0];
  const url = 'https://api-t1.fyers.in/data/history';

  try {
    const res = await axios.get(url, {
      params,
      headers: {
        'Authorization': `${appIdShort}:${token}`
      },
      timeout: 10000
    });

    if (res.data?.s === 'ok' && Array.isArray(res.data.candles)) {
      return res.data.candles.map(c => ({
        symbol: inst.symbol.toUpperCase(),
        timeframe: '1m',
        bucket_time: new Date(c[0] * 1000).toISOString(),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseInt(c[5]) || 0
      }));
    } else {
      console.warn(`Fyers API returned non-OK status for ${fyersSymbol}:`, res.data);
    }
  } catch (err) {
    console.error(`Fyers API Request error for ${fyersSymbol}:`, err.response?.data || err.message);
  }
  return [];
}

/**
 * Fetch historical 1m candles from Binance API
 */
async function fetchBinanceCandles(symbol, days) {
  const bnSymbol = symbol.toUpperCase().trim();
  const candles = [];
  
  // Binance returns max 1000 candles per request.
  // 30 days = 30 * 1440 = 43,200 candles.
  // For safety and speed, we fetch the latest 1000 candles (approx 16 hours of history)
  // or fetch in small batches. Let's do 2 requests of 1000 candles (~33 hours of 1m data).
  let startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  // Cap at latest 3000 candles to keep script running reasonably fast
  const MAX_CANDLES = 2000;
  let fetched = 0;

  try {
    while (fetched < MAX_CANDLES) {
      const url = 'https://api.binance.com/api/v3/klines';
      const res = await axios.get(url, {
        params: {
          symbol: bnSymbol,
          interval: '1m',
          limit: 1000,
          startTime
        },
        timeout: 10000
      });

      if (!Array.isArray(res.data) || res.data.length === 0) break;

      const mapped = res.data.map(c => ({
        symbol: symbol.toUpperCase(),
        timeframe: '1m',
        bucket_time: new Date(c[0]).toISOString(),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: Math.floor(parseFloat(c[5]))
      }));

      candles.push(...mapped);
      fetched += res.data.length;

      if (res.data.length < 1000) break;
      
      // Update startTime for next batch (last candle time + 1ms)
      startTime = res.data[res.data.length - 1][0] + 1;
      await sleep(100); // small throttle
    }
  } catch (err) {
    console.error(`Binance API Request error for ${bnSymbol}:`, err.message);
  }
  return candles;
}

/**
 * Fetch historical 1m candles from Yahoo Finance v8 chart API
 */
async function fetchYahooCandles(ticker, internalSymbol, days) {
  // Yahoo allows max 30 days for 1m interval
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
  try {
    const res = await axios.get(url, {
      params: {
        interval: '1m',
        range: `${Math.min(days, 30)}d`,
        includePrePost: 'false'
      },
      timeout: 10000
    });

    const result = res.data?.chart?.result?.[0];
    if (!result || !result.timestamp) return [];

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    if (!quotes || !quotes.open) return [];

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      // Yahoo can return null for some index fields if there are gaps
      if (
        quotes.open[i] === null || 
        quotes.high[i] === null || 
        quotes.low[i] === null || 
        quotes.close[i] === null
      ) continue;

      candles.push({
        symbol: internalSymbol.toUpperCase(),
        timeframe: '1m',
        bucket_time: new Date(timestamps[i] * 1000).toISOString(),
        open: parseFloat(quotes.open[i]),
        high: parseFloat(quotes.high[i]),
        low: parseFloat(quotes.low[i]),
        close: parseFloat(quotes.close[i]),
        volume: parseInt(quotes.volume?.[i] || 0)
      });
    }

    return candles;
  } catch (err) {
    console.error(`Yahoo Finance API Request error for ${ticker}:`, err.message);
  }
  return [];
}

run();
