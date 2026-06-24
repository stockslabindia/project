/**
 * Unified Symbol Map
 * 
 * Maps internal instrument symbols (e.g., 'RELIANCE', 'AAPL', 'BTCUSDT')
 * to the correct provider-specific symbols for Finnhub and Binance.
 * 
 * Loads mappings from Supabase instruments table on startup,
 * with comprehensive hardcoded fallbacks for all known instruments.
 */

const { feedLogger } = require('../core/monitoring/logger');

// ── Segment-to-provider routing ──
// Determines which feed provider handles each instrument segment
const SEGMENT_PROVIDER = {
  'nse_equity': 'fyers',
  'bse_equity': 'fyers',
  'fo_futures': 'fyers',
  'fo_options': 'fyers',
  'forex': 'finnhub',
  'mcx': 'fyers',
  'crypto': 'binance',
  'us_equity': 'finnhub',
  'global_indices': 'finnhub',
};

// ── Finnhub symbol mappings ──
// Internal symbol → Finnhub symbol
const FINNHUB_MAP = {
  // Indian Equities (NSE) — Finnhub uses SYMBOL.NS format for Indian stocks via REST
  // For WebSocket, Finnhub may use exchange:symbol format
  'RELIANCE': 'RELIANCE.NS',
  'HDFCBANK': 'HDFCBANK.NS',
  'TCS': 'TCS.NS',
  'INFY': 'INFY.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'WIPRO': 'WIPRO.NS',
  'BAJFINANCE': 'BAJFINANCE.NS',
  'SBIN': 'SBIN.NS',
  'TATAMOTORS': 'TATAMOTORS.NS',
  'KOTAKBANK': 'KOTAKBANK.NS',
  'HINDUNILVR': 'HINDUNILVR.NS',
  'LT': 'LT.NS',
  'MARUTI': 'MARUTI.NS',
  'ADANIENT': 'ADANIENT.NS',
  'SUNPHARMA': 'SUNPHARMA.NS',
  'ITC': 'ITC.NS',
  'HCLTECH': 'HCLTECH.NS',
  'AXISBANK': 'AXISBANK.NS',
  'ONGC': 'ONGC.NS',
  'NTPC': 'NTPC.NS',
  'TATASTEEL': 'TATASTEEL.NS',
  'POWERGRID': 'POWERGRID.NS',
  'ULTRACEMCO': 'ULTRACEMCO.NS',
  'COALINDIA': 'COALINDIA.NS',
  'BAJAJFINSV': 'BAJAJFINSV.NS',
  'M&M': 'M&M.NS',
  'TITAN': 'TITAN.NS',
  'GRASIM': 'GRASIM.NS',
  'JSWSTEEL': 'JSWSTEEL.NS',
  'TECHM': 'TECHM.NS',
  'HINDALCO': 'HINDALCO.NS',
  'EICHERMOT': 'EICHERMOT.NS',
  'NESTLEIND': 'NESTLEIND.NS',
  'BHARTIARTL': 'BHARTIARTL.NS',
  'ASIANPAINT': 'ASIANPAINT.NS',
  'HEROMOTOCO': 'HEROMOTOCO.NS',
  'TATACONSUM': 'TATACONSUM.NS',
  'BRITANNIA': 'BRITANNIA.NS',
  'BPCL': 'BPCL.NS',
  'CIPLA': 'CIPLA.NS',
  'DRREDDY': 'DRREDDY.NS',
  'SBILIFE': 'SBILIFE.NS',
  'HDFCLIFE': 'HDFCLIFE.NS',
  'APOLLOHOSP': 'APOLLOHOSP.NS',
  'DIVISLAB': 'DIVISLAB.NS',
  'TATAMTRDVR': 'TATAMTRDVR.NS',
  'BAJAJ-AUTO': 'BAJAJ-AUTO.NS',
  'LTIM': 'LTIM.NS',
  'UPL': 'UPL.NS',
  'ADANIPORTS': 'ADANIPORTS.NS',
  'SHRIRAMFIN': 'SHRIRAMFIN.NS',
  'PNB': 'PNB.NS',
  'BOB': 'BANKBARODA.NS',
  'CANBK': 'CANBK.NS',
  'IDFCFIRSTB': 'IDFCFIRSTB.NS',
  'FEDERALBNK': 'FEDERALBNK.NS',
  'BANDHANBNK': 'BANDHANBNK.NS',
  'AUROPHARMA': 'AUROPHARMA.NS',
  'ZOMATO': 'ZOMATO.NS',
  'JIOFIN': 'JIOFIN.NS',
  'PAYTM': 'PAYTM.NS',
  'NYKAA': 'NYKAA.NS',
  'HAL': 'HAL.NS',
  'BEL': 'BEL.NS',
  'IRFC': 'IRFC.NS',
  'RVNL': 'RVNL.NS',
  'MAZDOCK': 'MAZDOCK.NS',
  'SUZLON': 'SUZLON.NS',
  'TRENT': 'TRENT.NS',
  'CHOLAFIN': 'CHOLAFIN.NS',
  'TORNTPHARM': 'TORNTPHARM.NS',
  'TVSMOTOR': 'TVSMOTOR.NS',
  'GODREJCP': 'GODREJCP.NS',
  'PIDILITIND': 'PIDILITIND.NS',
  'HAVELLS': 'HAVELLS.NS',
  'INDIGO': 'INDIGO.NS',
  'SIEMENS': 'SIEMENS.NS',
  'CUMMINSIND': 'CUMMINSIND.NS',
  'SRF': 'SRF.NS',
  'DLF': 'DLF.NS',
  'MACROTECH': 'MACROTECH.NS',
  'LODHA': 'MACROTECH.NS',
  'PRESTIGE': 'PRESTIGE.NS',
  'OBEROIRLTY': 'OBEROIRLTY.NS',
  'MRF': 'MRF.NS',
  'APOLLOTYRE': 'APOLLOTYRE.NS',
  'CEATLTD': 'CEATLTD.NS',
  'SENSEX': 'BSE:SENSEX',

  // Indian Indices
  'NIFTY50': '^NSEI',
  'BANKNIFTY': '^NSEBANK',

  // US Stocks (Finnhub uses ticker directly for US equities)
  'AAPL': 'AAPL',
  'MSFT': 'MSFT',
  'GOOGL': 'GOOGL',
  'AMZN': 'AMZN',
  'TSLA': 'TSLA',
  'META': 'META',
  'NVDA': 'NVDA',
  'AMD': 'AMD',
  'NFLX': 'NFLX',
  'INTC': 'INTC',
  'JPM': 'JPM',
  'V': 'V',
  'WMT': 'WMT',
  'DIS': 'DIS',
  'BA': 'BA',
  'CSCO': 'CSCO',
  'PFE': 'PFE',
  'KO': 'KO',
  'PEP': 'PEP',
  'NKE': 'NKE',
  'PYPL': 'PYPL',
  'UBER': 'UBER',
  'CRM': 'CRM',
  'ORCL': 'ORCL',
  'ADBE': 'ADBE',
  'AVGO': 'AVGO',
  'COST': 'COST',
  'ABNB': 'ABNB',
  'SQ': 'SQ',
  'SNAP': 'SNAP',
  'SHOP': 'SHOP',
  'COIN': 'COIN',
  'PLTR': 'PLTR',
  'RIVN': 'RIVN',
  'SOFI': 'SOFI',
  'MRNA': 'MRNA',
  'JNJ': 'JNJ',
  'XOM': 'XOM',
  'CVX': 'CVX',
  'HD': 'HD',
  'MA': 'MA',
  'UNH': 'UNH',
  'BAC': 'BAC',
  'ABBV': 'ABBV',
  'MCD': 'MCD',
  'LLY': 'LLY',
  'SBUX': 'SBUX',
  'GS': 'GS',
  'QCOM': 'QCOM',
  'MS': 'MS',

  // Forex (Finnhub uses OANDA format for forex WebSocket)
  'EURUSD': 'OANDA:EUR_USD',
  'GBPUSD': 'OANDA:GBP_USD',
  'USDJPY': 'OANDA:USD_JPY',
  'USDCHF': 'OANDA:USD_CHF',
  'AUDUSD': 'OANDA:AUD_USD',
  'USDINR': 'OANDA:USD_INR',
  'USDCAD': 'OANDA:USD_CAD',
  'NZDUSD': 'OANDA:NZD_USD',
  'EURJPY': 'OANDA:EUR_JPY',
  'GBPJPY': 'OANDA:GBP_JPY',

  // Commodities (via Finnhub)
  'XAUUSD': 'OANDA:XAU_USD',
  'XAGUSD': 'OANDA:XAG_USD',
  'CRUDEOIL_USD': 'OANDA:BCO_USD',
  'NATURALGAS_USD': 'OANDA:NATGAS_USD',
  'COPPER_USD': 'OANDA:XCU_USD',

  // Global Indices (Finnhub quote endpoint) — all verified live
  // USA
  'SPX500':     '^GSPC',      // S&P 500
  'NASDAQ':     '^IXIC',      // NASDAQ Composite
  'NASDAQ100':  '^NDX',       // NASDAQ 100
  'DJI':        '^DJI',       // Dow Jones Industrial Average
  'RUSSELL2000': '^RUT',      // Russell 2000
  'VIX':        '^VIX',       // CBOE Volatility Index
  // Europe
  'FTSE100':    '^FTSE',      // FTSE 100 (UK)
  'DAX':        '^GDAXI',     // DAX (Germany)
  'CAC40':      '^FCHI',      // CAC 40 (France)
  'AEX':        '^AEX',       // AEX (Netherlands)
  'SMI':        '^SSMI',      // SMI (Switzerland)
  'OMXS30':     '^OMX',       // OMX Stockholm 30 (Sweden)
  // Asia-Pacific
  'NIKKEI':     '^N225',      // Nikkei 225 (Japan)
  'HANGSENG':   '^HSI',       // Hang Seng (Hong Kong)
  'ASX200':     '^AXJO',      // ASX 200 (Australia)
  'KOSPI':      '^KS11',      // KOSPI (South Korea)
  'SSE':        '000001.SS',  // Shanghai Composite (China)
  'SZSE':       '399001.SZ',  // Shenzhen Composite (China)
  'STRAITS':    '^STI',       // Straits Times Index (Singapore)
  'TAIEX':      '^TWII',      // TAIEX (Taiwan)
  // Americas
  'IBOVESPA':   '^BVSP',      // Ibovespa (Brazil)
  'TSX':        '^GSPTSE',    // TSX Composite (Canada)
  // India
  'SENSEX_IDX': 'BSE:SENSEX', // BSE Sensex (via Finnhub; Fyers covers SENSEX directly)
};

// ── Binance symbol mappings ──
// Internal symbol → Binance lowercase stream symbol
const BINANCE_MAP = {
  'BTCUSDT': 'btcusdt',
  'ETHUSDT': 'ethusdt',
  'BNBUSDT': 'bnbusdt',
  'SOLUSDT': 'solusdt',
  'XRPUSDT': 'xrpusdt',
  'ADAUSDT': 'adausdt',
  'DOTUSDT': 'dotusdt',
  'DOGEUSDT': 'dogeusdt',
  'AVAXUSDT': 'avaxusdt',
  'MATICUSDT': 'maticusdt',
  'LINKUSDT': 'linkusdt',
  'UNIUSDT': 'uniusdt',
  'LTCUSDT': 'ltcusdt',
  'ATOMUSDT': 'atomusdt',
  'ETCUSDT': 'etcusdt',
  'NEARUSDT': 'nearusdt',
  'APTUSDT': 'aptusdt',
  'ARBUSDT': 'arbusdt',
  'OPUSDT': 'opusdt',
  'SHIBUSDT': 'shibusdt',
  'PEPEUSDT': 'pepeusdt',

  // Alternate naming support
  'BITCOIN': 'btcusdt',
  'ETHEREUM': 'ethusdt',
  'BNB': 'bnbusdt',
  'SOLANA': 'solusdt',
  'RIPPLE': 'xrpusdt',
  'CARDANO': 'adausdt',
  'DOGECOIN': 'dogeusdt',
};

// ── Reverse maps (built dynamically) ──
const FINNHUB_REVERSE = {};
const BINANCE_REVERSE = {};

for (const [internal, provider] of Object.entries(FINNHUB_MAP)) {
  FINNHUB_REVERSE[provider] = internal;
  FINNHUB_REVERSE[provider.toUpperCase()] = internal;
  FINNHUB_REVERSE[provider.toLowerCase()] = internal;
}

// Build Binance reverse map — canonical entries first, then aliases only if not already set
// This ensures btcusdt → BTCUSDT (not BITCOIN)
for (const [internal, provider] of Object.entries(BINANCE_MAP)) {
  // Canonical entries (e.g., BTCUSDT → btcusdt) always take priority
  const isCanonical = internal.endsWith('USDT');
  if (isCanonical || !BINANCE_REVERSE[provider]) {
    BINANCE_REVERSE[provider] = internal;
  }
  if (isCanonical || !BINANCE_REVERSE[provider.toUpperCase()]) {
    BINANCE_REVERSE[provider.toUpperCase()] = internal;
  }
}

// ── Active instruments (populated from DB on startup) ──
let activeInstruments = [];
const activeInstrumentsMap = new Map();
let instrumentsBySegment = {};

/**
 * Load active instruments from Supabase and enrich the maps
 */
async function loadFromDatabase() {
  try {
    const { redisClient } = require('../redis/client');
    const cacheKey = 'symbols:active_instruments';
    
    let cachedData = null;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        cachedData = JSON.parse(cached);
        feedLogger.info(`[SYMBOL MAP] Loaded instruments from Redis cache`);
      }
    } catch (cacheErr) {
      feedLogger.warn(`[SYMBOL MAP] Redis cache read failed: ${cacheErr.message}`);
    }

    let data = cachedData;
    if (!data) {
      const { fetchAllActiveInstruments } = require('../config/supabase');
      data = await fetchAllActiveInstruments('symbol, segment, name, is_active, last_price');
      
      try {
        await redisClient.setex(cacheKey, 3600, JSON.stringify(data)); // Cache for 1 hour
        feedLogger.info(`[SYMBOL MAP] Cached instruments in Redis`);
      } catch (cacheErr) {}
    }

    if (data && data.length > 0) {
      activeInstruments = data;
      activeInstrumentsMap.clear();
      
      // Group by segment
      instrumentsBySegment = {};
      data.forEach(inst => {
        if (inst.symbol) {
          activeInstrumentsMap.set(inst.symbol.toUpperCase().trim(), inst);
        }
        const seg = inst.segment || 'unknown';
        if (!instrumentsBySegment[seg]) instrumentsBySegment[seg] = [];
        instrumentsBySegment[seg].push(inst.symbol);
      });

      feedLogger.info(`Symbol map loaded ${data.length} active instruments from database`);
      feedLogger.info(`Segments: ${Object.keys(instrumentsBySegment).join(', ')}`);
    }
  } catch (err) {
    feedLogger.error(`Symbol map DB load failed: ${err.message}`);
  }
}

/**
 * Get the provider name for an internal symbol
 * @param {string} symbol - Internal symbol
 * @returns {'finnhub'|'binance'|null}
 */
function getProvider(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase().trim();
  
  // Try to infer from segment in DB first (source of truth)
  const inst = activeInstruments.find(i => i.symbol === upper);
  if (inst && inst.segment) {
    return SEGMENT_PROVIDER[inst.segment] || (BINANCE_MAP[upper] ? 'binance' : 'finnhub');
  }

  // Check Binance first (crypto)
  if (BINANCE_MAP[upper]) return 'binance';
  
  // Check Finnhub
  if (FINNHUB_MAP[upper]) return 'finnhub';
  
  // Default: try Finnhub
  return 'finnhub';
}

/**
 * Get Finnhub symbol for an internal symbol
 * @param {string} symbol - Internal symbol
 * @returns {string|null}
 */
function toFinnhubSymbol(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase().trim();
  if (FINNHUB_MAP[upper]) return FINNHUB_MAP[upper];
  
  // Exclude non-NSE segments (like MCX commodities, Crypto) from dynamic NSE stock fallback
  const inst = activeInstruments.find(i => i.symbol === upper);
  if (inst && inst.segment !== 'nse_equity') {
    return null;
  }
  
  // Dynamic fallback for newly added NSE stocks (purely alphabetical symbols)
  const isNseFormat = /^[A-Z\-]+$/.test(upper);
  if (isNseFormat) {
    return `${upper}.NS`;
  }
  return null;
}

/**
 * Get Binance stream symbol for an internal symbol
 * @param {string} symbol - Internal symbol
 * @returns {string|null}
 */
function toBinanceSymbol(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase().trim();
  return BINANCE_MAP[upper] || null;
}

/**
 * Convert a Finnhub symbol back to internal symbol
 * @param {string} finnhubSymbol 
 * @returns {string|null}
 */
function fromFinnhubSymbol(finnhubSymbol) {
  if (!finnhubSymbol) return null;
  if (FINNHUB_REVERSE[finnhubSymbol]) return FINNHUB_REVERSE[finnhubSymbol];
  const upper = finnhubSymbol.toUpperCase();
  if (FINNHUB_REVERSE[upper]) return FINNHUB_REVERSE[upper];
  
  // Handle dynamic NSE symbols (ending in .NS)
  if (upper.endsWith('.NS')) {
    return upper.slice(0, -3);
  }
  return null;
}

/**
 * Convert a Binance stream symbol back to internal symbol
 * @param {string} binanceSymbol 
 * @returns {string|null}
 */
function fromBinanceSymbol(binanceSymbol) {
  if (!binanceSymbol) return null;
  return BINANCE_REVERSE[binanceSymbol] || BINANCE_REVERSE[binanceSymbol.toUpperCase()] || null;
}

/**
 * Get all Finnhub symbols that should be subscribed to
 * @returns {string[]}
 */
function getAllFinnhubSymbols() {
  const symbols = new Set();
  
  // From active instruments
  for (const inst of activeInstruments) {
    const provider = getProvider(inst.symbol);
    if (provider === 'finnhub') {
      const fhSym = toFinnhubSymbol(inst.symbol);
      if (fhSym) symbols.add(fhSym);
    }
  }

  // Always include key indices
  symbols.add(FINNHUB_MAP['NIFTY50']);
  symbols.add(FINNHUB_MAP['BANKNIFTY']);

  // Always include raw USD feeds for derived INR MCX commodities
  symbols.add(FINNHUB_MAP['CRUDEOIL_USD']);
  symbols.add(FINNHUB_MAP['NATURALGAS_USD']);
  symbols.add(FINNHUB_MAP['COPPER_USD']);

  return Array.from(symbols).filter(Boolean);
}

/**
 * Get all Binance symbols that should be subscribed to
 * @returns {string[]}
 */
function getAllBinanceSymbols() {
  const symbols = new Set();
  
  // From active instruments
  for (const inst of activeInstruments) {
    const provider = getProvider(inst.symbol);
    if (provider === 'binance') {
      const bnSym = toBinanceSymbol(inst.symbol);
      if (bnSym) symbols.add(bnSym);
    }
  }

  return Array.from(symbols).filter(Boolean);
}

/**
 * Get all active instrument symbols
 * @returns {string[]}
 */
function getActiveSymbols() {
  return activeInstruments.map(i => i.symbol);
}

/**
 * Get instruments grouped by segment
 * @returns {Object}
 */
function getInstrumentsBySegment() {
  return { ...instrumentsBySegment };
}

function getInstrumentDetails(symbol) {
  if (!symbol) return null;
  return activeInstrumentsMap.get(symbol.toUpperCase().trim()) || null;
}

module.exports = {
  loadFromDatabase,
  getProvider,
  toFinnhubSymbol,
  toBinanceSymbol,
  fromFinnhubSymbol,
  fromBinanceSymbol,
  getAllFinnhubSymbols,
  getAllBinanceSymbols,
  getActiveSymbols,
  getInstrumentsBySegment,
  getInstrumentDetails,
  SEGMENT_PROVIDER,
};
