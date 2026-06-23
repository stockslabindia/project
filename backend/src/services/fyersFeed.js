/**
 * Fyers Market Data Feed Service
 *
 * Provides real-time 0-lag Indian market data via Fyers WebSocket API.
 *
 * Authentication flow (fully automated, zero manual steps):
 *   1. POST /vagator/v2/send_login_otp   → request_key
 *   2. POST /vagator/v2/verify_otp        → verified request_key  (uses TOTP)
 *   3. POST /vagator/v2/verify_pin        → access_token (JWT)
 *   4. If APP_ID is set: POST /api/v3/token → final access_token
 *
 * The access_token is cached in Redis and refreshed automatically at 06:00 IST daily.
 *
 * Emits the same 'tick' events as the legacy feed so priceEngine.js needs
 * zero changes on the consumption side.
 *
 * Tick format emitted:
 *   { symbol, price, ltp, bid, ask, high, low, open, prev_close,
 *     change, changePercent, volume, timestamp, _debug }
 */

'use strict';

const crypto       = require('crypto');
const EventEmitter = require('events');
const path         = require('path');
const { feedLogger } = require('../core/monitoring/logger');
const { redisClient }  = require('../redis/client');

// ── Fyers SDK data socket ──
const { fyersDataSocket } = require('fyers-api-v3');

// ── Endpoints ──
const VAGATOR_BASE = 'https://api-t2.fyers.in/vagator/v2';
const TOKEN_URL    = 'https://api-t1.fyers.in/api/v3/token';
const VALIDATE_URL = 'https://api-t1.fyers.in/api/v3/validate-authcode';

// ── Redis key for token caching ──
const REDIS_TOKEN_KEY   = 'fyers:access_token';
const REDIS_SYMBOLS_KEY = 'fyers:fyers_symbol_map';

// ── Static Fyers symbol map: internal symbol → Fyers symbol ──
const FYERS_SYMBOL_MAP = {
  // Indices
  'NIFTY50':    'NSE:NIFTY50-INDEX',
  'NIFTY':      'NSE:NIFTY50-INDEX',
  'BANKNIFTY':  'NSE:NIFTYBANK-INDEX',
  'SENSEX':     'BSE:SENSEX-INDEX',

  // NSE Equities (common Nifty 50 stocks)
  'RELIANCE':   'NSE:RELIANCE-EQ',
  'HDFCBANK':   'NSE:HDFCBANK-EQ',
  'TCS':        'NSE:TCS-EQ',
  'INFY':       'NSE:INFY-EQ',
  'ICICIBANK':  'NSE:ICICIBANK-EQ',
  'WIPRO':      'NSE:WIPRO-EQ',
  'BAJFINANCE': 'NSE:BAJFINANCE-EQ',
  'SBIN':       'NSE:SBIN-EQ',
  'TATAMOTORS': 'NSE:TATAMOTORS-EQ',
  'KOTAKBANK':  'NSE:KOTAKBANK-EQ',
  'HINDUNILVR': 'NSE:HINDUNILVR-EQ',
  'LT':         'NSE:LT-EQ',
  'MARUTI':     'NSE:MARUTI-EQ',
  'ADANIENT':   'NSE:ADANIENT-EQ',
  'SUNPHARMA':  'NSE:SUNPHARMA-EQ',
  'ITC':        'NSE:ITC-EQ',
  'HCLTECH':    'NSE:HCLTECH-EQ',
  'AXISBANK':   'NSE:AXISBANK-EQ',
  'ONGC':       'NSE:ONGC-EQ',
  'NTPC':       'NSE:NTPC-EQ',
  'TATASTEEL':  'NSE:TATASTEEL-EQ',
  'POWERGRID':  'NSE:POWERGRID-EQ',
  'ULTRACEMCO': 'NSE:ULTRACEMCO-EQ',
  'COALINDIA':  'NSE:COALINDIA-EQ',
  'BAJAJFINSV': 'NSE:BAJAJFINSV-EQ',
  'M&M':        'NSE:M&M-EQ',
  'TITAN':      'NSE:TITAN-EQ',
  'GRASIM':     'NSE:GRASIM-EQ',
  'JSWSTEEL':   'NSE:JSWSTEEL-EQ',
  'TECHM':      'NSE:TECHM-EQ',
  'HINDALCO':   'NSE:HINDALCO-EQ',
  'EICHERMOT':  'NSE:EICHERMOT-EQ',
  'NESTLEIND':  'NSE:NESTLEIND-EQ',
  'BHARTIARTL': 'NSE:BHARTIARTL-EQ',
  'ASIANPAINT': 'NSE:ASIANPAINT-EQ',
  'HEROMOTOCO': 'NSE:HEROMOTOCO-EQ',
  'TATACONSUM': 'NSE:TATACONSUM-EQ',
  'BRITANNIA':  'NSE:BRITANNIA-EQ',
  'BPCL':       'NSE:BPCL-EQ',
  'CIPLA':      'NSE:CIPLA-EQ',
  'DRREDDY':    'NSE:DRREDDY-EQ',
  'SBILIFE':    'NSE:SBILIFE-EQ',
  'HDFCLIFE':   'NSE:HDFCLIFE-EQ',
  'APOLLOHOSP': 'NSE:APOLLOHOSP-EQ',
  'DIVISLAB':   'NSE:DIVISLAB-EQ',
  'BAJAJ-AUTO': 'NSE:BAJAJ-AUTO-EQ',
  'LTIM':       'NSE:LTIM-EQ',
  'UPL':        'NSE:UPL-EQ',
  'ADANIPORTS': 'NSE:ADANIPORTS-EQ',
  'SHRIRAMFIN': 'NSE:SHRIRAMFIN-EQ',
  'PNB':        'NSE:PNB-EQ',
  'BOB':        'NSE:BANKBARODA-EQ',
  'BANKBARODA': 'NSE:BANKBARODA-EQ',
  'CANBK':      'NSE:CANBK-EQ',
  'IDFCFIRSTB': 'NSE:IDFCFIRSTB-EQ',
  'FEDERALBNK': 'NSE:FEDERALBNK-EQ',
  'BANDHANBNK': 'NSE:BANDHANBNK-EQ',
  'AUROPHARMA': 'NSE:AUROPHARMA-EQ',
  'ZOMATO':     'NSE:ZOMATO-EQ',
  'JIOFIN':     'NSE:JIOFIN-EQ',
  'PAYTM':      'NSE:PAYTM-EQ',
  'NYKAA':      'NSE:NYKAA-EQ',
  'HAL':        'NSE:HAL-EQ',
  'BEL':        'NSE:BEL-EQ',
  'IRFC':       'NSE:IRFC-EQ',
  'RVNL':       'NSE:RVNL-EQ',
  'SUZLON':     'NSE:SUZLON-EQ',
  'TRENT':      'NSE:TRENT-EQ',
  'CHOLAFIN':   'NSE:CHOLAFIN-EQ',
  'TORNTPHARM': 'NSE:TORNTPHARM-EQ',
  'TVSMOTOR':   'NSE:TVSMOTOR-EQ',
  'GODREJCP':   'NSE:GODREJCP-EQ',
  'PIDILITIND': 'NSE:PIDILITIND-EQ',
  'HAVELLS':    'NSE:HAVELLS-EQ',
  'INDIGO':     'NSE:INDIGO-EQ',
  'SIEMENS':    'NSE:SIEMENS-EQ',
  'DLF':        'NSE:DLF-EQ',
  'MRF':        'NSE:MRF-EQ',
  'APOLLOTYRE': 'NSE:APOLLOTYRE-EQ',
};

// Reverse map: fyers symbol → internal symbol
const FYERS_REVERSE_MAP = {};
for (const [internal, fyers] of Object.entries(FYERS_SYMBOL_MAP)) {
  FYERS_REVERSE_MAP[fyers] = internal;
}

// ── Utility: native TOTP generator (RFC 6238) ──
function decodeBase32(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const buffer = [];
  for (const ch of base32.replace(/[\s=]/g, '').toUpperCase()) {
    const val = alphabet.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    buffer.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(buffer);
}

function generateTOTP(secretBase32) {
  const secret   = decodeBase32(secretBase32);
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const buf      = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(timeStep), 0);
  const hmac   = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code   = (
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8)  |
     (hmac[offset + 3] & 0xff)
  ) % 1_000_000;
  return code.toString().padStart(6, '0');
}

// ── Lazy-load axios to avoid circular dep issues at module load time ──
function getAxios() {
  return require('axios');
}

class FyersFeed extends EventEmitter {
  constructor() {
    super();
    this._status = 'DISCONNECTED';
    this.socket  = null;

    // Subscriptions
    this.subscribedSymbols = new Set(); // internal symbols
    this.fyersSymbols      = new Set(); // fyers format symbols

    // Token
    this.accessToken = null;
    this.appId       = null;

    // Daily token refresh at 06:00 IST (00:30 UTC)
    this._tokenRefreshTimer = null;

    // Reconnect state
    this.reconnectAttempts  = 0;
    this.maxReconnectAttempts = 10;
    this._reconnectTimeout  = null;

    // Stats
    this.stats = {
      ticksReceived: 0,
      errorsEncountered: 0,
      lastTickTime: null,
      lastError: null,
      reconnections: 0,
    };

    // Log directory for fyers-api-v3 SDK
    this._logPath = path.join(require('os').tmpdir(), 'fyers_logs');
  }

  // ── Status with auto-emit ──
  get status() { return this._status; }
  set status(val) {
    const old = this._status;
    this._status = val;
    if (old !== val) this.emit('status', val);
  }

  // ─────────────────────────────────────────────────────────────────
  //  PUBLIC API  (same interface as legacy feed)
  // ─────────────────────────────────────────────────────────────────

  async start() {
    const fyId       = process.env.FYERS_USER_ID;
    const totpSecret = process.env.FYERS_TOTP_SECRET;
    const pin        = process.env.FYERS_PIN;

    if (!fyId || !totpSecret || !pin) {
      feedLogger.warn('[FYERS] Missing FYERS_USER_ID / FYERS_TOTP_SECRET / FYERS_PIN — feed disabled.');
      this.status = 'DISABLED';
      return false;
    }

    this.appId = process.env.FYERS_APP_ID || null;

    try {
      // Dynamically load active MCX contract mappings on startup
      await this._loadMcxMappings();

      // Try to load cached token first
      const cached = await this._loadTokenFromRedis();
      if (cached) {
        this.accessToken = cached;
        feedLogger.info('[FYERS] Using cached access token from Redis.');
      } else {
        const token = await this._authenticate();
        if (!token) {
          this.status = 'ERROR';
          return false;
        }
        this.accessToken = token;
      }

      this._connectWebSocket();
      this._scheduleTokenRefresh();
      return true;
    } catch (err) {
      this.stats.errorsEncountered++;
      this.stats.lastError = err.message;
      feedLogger.error(`[FYERS] Failed to start: ${err.message}`);
      this.status = 'ERROR';
      return false;
    }
  }

  _sendSubscribe(symbols) {
    if (!this.socket || !symbols || symbols.length === 0) return;
    if (this.status !== 'CONNECTED') {
      feedLogger.warn(`[FYERS] Skipping _sendSubscribe of ${symbols.length} symbols because WebSocket is not CONNECTED (status: ${this.status}).`);
      return;
    }

    const indices = [];
    const equities = [];
    for (const sym of symbols) {
      if (sym.endsWith('-INDEX')) {
        indices.push(sym);
      } else {
        equities.push(sym);
      }
    }

    const CHUNK_SIZE = 100;

    // Subscribe equities in chunks as 'symbolUpdate' (false = Full mode)
    for (let i = 0; i < equities.length; i += CHUNK_SIZE) {
      const chunk = equities.slice(i, i + CHUNK_SIZE);
      try {
        this.socket.subscribe(chunk, false);
      } catch (err) {
        feedLogger.error(`[FYERS] Error subscribing equity chunk: ${err.message}`);
      }
    }

    // Subscribe indices in chunks as 'lite' (true = Lite mode, no depth)
    for (let i = 0; i < indices.length; i += CHUNK_SIZE) {
      const chunk = indices.slice(i, i + CHUNK_SIZE);
      try {
        this.socket.subscribe(chunk, true);
      } catch (err) {
        feedLogger.error(`[FYERS] Error subscribing index chunk: ${err.message}`);
      }
    }
  }

  async subscribe(symbols = []) {
    if (!symbols.length) return;

    const toSubscribe = [];
    for (const sym of symbols) {
      const fyersSym = FYERS_SYMBOL_MAP[sym.toUpperCase()] || this._dynamicFyersSymbol(sym);
      if (fyersSym) {
        this.subscribedSymbols.add(sym.toUpperCase());
        if (!this.fyersSymbols.has(fyersSym)) {
          this.fyersSymbols.add(fyersSym);
          toSubscribe.push(fyersSym);
        }
      } else {
        feedLogger.warn(`[FYERS] No Fyers symbol mapping for: ${sym}`);
      }
    }

    if (toSubscribe.length > 0 && this.socket && this.status === 'CONNECTED') {
      try {
        this._sendSubscribe(toSubscribe);
        feedLogger.info(`[FYERS] Subscribed to ${toSubscribe.length} new symbols. Total: ${this.fyersSymbols.size}`);
      } catch (err) {
        feedLogger.warn(`[FYERS] subscribe() error: ${err.message}`);
      }
    }
  }

  async unsubscribe(symbols = []) {
    if (!symbols.length) return;
    const toRemove = [];
    for (const sym of symbols) {
      const fyersSym = FYERS_SYMBOL_MAP[sym.toUpperCase()];
      if (fyersSym && this.fyersSymbols.has(fyersSym)) {
        this.fyersSymbols.delete(fyersSym);
        this.subscribedSymbols.delete(sym.toUpperCase());
        toRemove.push(fyersSym);
      }
    }
    if (toRemove.length > 0 && this.socket && this.status === 'CONNECTED') {
      try {
        this.socket.unsubscribe(toRemove);
      } catch (err) {
        feedLogger.warn(`[FYERS] unsubscribe() error: ${err.message}`);
      }
    }
  }

  stop() {
    feedLogger.info('[FYERS] Stopping Fyers feed service...');
    this._clearRefreshTimer();
    this._cleanupSocket();
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
    this.status = 'DISCONNECTED';
  }

  getStatus() {
    return {
      provider:         'fyers',
      status:           this.status,
      activeSymbolCount: this.fyersSymbols.size,
      stats:            { ...this.stats },
    };
  }

  // Reset circuit breaker (called from admin route)
  resetCircuitBreaker() {
    feedLogger.info('[FYERS] Circuit breaker reset manually. Reconnecting...');
    this.reconnectAttempts = 0;
    this._cleanupSocket();
    this._connectWebSocket();
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  //  AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────

  async _authenticate() {
    const fyId       = process.env.FYERS_USER_ID;
    const totpSecret = process.env.FYERS_TOTP_SECRET;
    const pin        = process.env.FYERS_PIN;
    const appId      = process.env.FYERS_APP_ID;
    const secretKey  = process.env.FYERS_SECRET_KEY;

    const axios = getAxios();

    feedLogger.info('[FYERS] Authenticating via Vagator API...');

    // Step 1 — send_login_otp
    let requestKey;
    {
      const res = await axios.post(`${VAGATOR_BASE}/send_login_otp`, {
        fy_id:  fyId,
        app_id: '2'
      }, { timeout: 10000 });

      if (!res.data?.request_key) {
        throw new Error(`send_login_otp failed: ${JSON.stringify(res.data)}`);
      }
      requestKey = res.data.request_key;
      feedLogger.info('[FYERS] Step 1 ✅ request_key obtained');
    }

    // Step 2 — verify_otp (TOTP)
    {
      const totp = generateTOTP(totpSecret);
      feedLogger.info(`[FYERS] Step 2: Sending TOTP ${totp}...`);

      const res = await axios.post(`${VAGATOR_BASE}/verify_otp`, {
        request_key: requestKey,
        otp:         totp
      }, { timeout: 10000 });

      if (!res.data?.request_key) {
        throw new Error(`verify_otp failed: ${JSON.stringify(res.data)}`);
      }
      requestKey = res.data.request_key;
      feedLogger.info('[FYERS] Step 2 ✅ TOTP verified');
    }

    // Step 3 — verify_pin
    let accessToken;
    {
      for (const endpoint of ['verify_pin_v2', 'verify_pin']) {
        try {
          const res = await axios.post(`${VAGATOR_BASE}/${endpoint}`, {
            request_key:   requestKey,
            identity_type: 'pin',
            identifier:    pin
          }, { timeout: 10000 });

          const token = res.data?.data?.access_token || res.data?.access_token;
          if (token) {
            accessToken = token;
            break;
          }
        } catch (err) {
          if (endpoint === 'verify_pin') throw err; // give up on last attempt
          feedLogger.warn(`[FYERS] ${endpoint} failed, trying fallback...`);
        }
      }

      if (!accessToken) {
        throw new Error('verify_pin returned no access_token');
      }
      feedLogger.info('[FYERS] Step 3 ✅ PIN verified, access_token obtained');
    }

    // Step 4 — get authorization code via /api/v3/token
    if (appId) {
      try {
        const appIdShort = appId.split('-')[0];
        const appType    = appId.split('-')[1] || '100';

        const res = await axios.post(TOKEN_URL, {
          fyers_id:       fyId,
          app_id:         appIdShort,
          redirect_uri:   process.env.FYERS_REDIRECT_URL || 'http://127.0.0.1',
          appType,
          code_challenge: '',
          state:          'None',
          nonce:          '',
          response_type:  'code',
          create_cookie:  true
        }, {
          headers: { Authorization: `Bearer ${accessToken}` },
          validateStatus: () => true,
          maxRedirects: 0,
          timeout: 10000
        });

        // Parse auth code from either data object or redirected URL query parameters
        let authCode = res.data?.data?.auth || res.data?.data?.authorization_code;
        if (!authCode && res.data?.Url) {
          try {
            const u = new URL(res.data.Url);
            authCode = u.searchParams.get('auth_code');
          } catch (e) {
            const match = res.data.Url.match(/[?&]auth_code=([^&]+)/);
            if (match) authCode = match[1];
          }
        }

        if (authCode) {
          feedLogger.info('[FYERS] Step 4 ✅ Authorization code obtained');

          // Step 5 — Exchange auth code for access_token
          const appIdHash = crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');
          const exchangeRes = await axios.post(VALIDATE_URL, {
            grant_type: 'authorization_code',
            appIdHash,
            code: authCode,
            redirect_uri: process.env.FYERS_REDIRECT_URL || 'http://127.0.0.1'
          }, { timeout: 10000 });

          if (exchangeRes.data?.access_token) {
            accessToken = exchangeRes.data.access_token;
            feedLogger.info('[FYERS] Step 5 ✅ Final access_token obtained via validate-authcode');
          } else {
            throw new Error(`Token exchange failed: ${JSON.stringify(exchangeRes.data)}`);
          }
        } else {
          feedLogger.warn('[FYERS] Step 4: /api/v3/token returned no auth code — using session token as-is');
        }
      } catch (err) {
        feedLogger.warn(`[FYERS] Step 4/5 token exchange failed (using session token): ${err.response?.data?.message || err.message}`);
        // Non-fatal: session token from step 3 still works for WebSocket with APP_ID prefix
      }
    }

    // Cache in Redis for 24 hours
    await this._saveTokenToRedis(accessToken);

    return accessToken;
  }

  async _loadMcxMappings() {
    try {
      feedLogger.info('[FYERS] Fetching MCX symbol master to resolve near-month futures...');
      const axios = getAxios();
      const res = await axios.get('https://public.fyers.in/sym_details/MCX_COM.csv', { timeout: 15000 });
      const data = res.data;
      if (!data) throw new Error('Empty MCX CSV master response');

      const lines = data.split('\n');
      const commodityContracts = {};

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length < 14) continue;

        const fyersSymbol = parts[9]?.trim();
        const expiryEpoch = parseInt(parts[8]?.trim()) || 0;
        const baseSymbol  = parts[13]?.trim();

        if (!fyersSymbol || !baseSymbol || !expiryEpoch) continue;
        if (!fyersSymbol.endsWith('FUT')) continue;

        if (!commodityContracts[baseSymbol]) {
          commodityContracts[baseSymbol] = [];
        }
        commodityContracts[baseSymbol].push({ fyersSymbol, expiryEpoch });
      }

      const nowEpoch = Math.floor(Date.now() / 1000);
      let count = 0;

      for (const [baseSymbol, contracts] of Object.entries(commodityContracts)) {
        const activeContracts = contracts.filter(c => c.expiryEpoch >= nowEpoch - 86400);
        if (activeContracts.length === 0) continue;

        activeContracts.sort((a, b) => a.expiryEpoch - b.expiryEpoch);
        const activeFyersSymbol = activeContracts[0].fyersSymbol;

        // Dynamically add to maps
        FYERS_SYMBOL_MAP[baseSymbol] = activeFyersSymbol;
        FYERS_REVERSE_MAP[activeFyersSymbol] = baseSymbol;
        count++;
      }

      feedLogger.info(`[FYERS] Dynamically loaded ${count} active MCX symbol mappings.`);
    } catch (err) {
      feedLogger.error(`[FYERS] Failed to load MCX mappings from master CSV: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  WEBSOCKET
  // ─────────────────────────────────────────────────────────────────

  _connectWebSocket() {
    if (this.socket) this._cleanupSocket();

    this.status = 'CONNECTING';

    // fyers-api-v3 format: "APPID:token" if APP_ID is set, else raw token
    const tokenStr = this.appId
      ? `${this.appId}:${this.accessToken}`
      : this.accessToken;

    feedLogger.info(`[FYERS] Connecting to Fyers DataSocket... (appId=${this.appId || 'none'})`);

    try {
      this.socket = fyersDataSocket.getInstance(tokenStr, this._logPath, false);

      this.socket.on('connect', () => {
        feedLogger.info('[FYERS] ✅ WebSocket connected!');
        this.status = 'CONNECTED';
        this.reconnectAttempts = 0;

        // Subscribe to all pending symbols
        if (this.fyersSymbols.size > 0) {
          this._sendSubscribe(Array.from(this.fyersSymbols));
          feedLogger.info(`[FYERS] Re-subscribed to ${this.fyersSymbols.size} symbols.`);
        }
      });

      this.socket.on('message', (data) => {
        this._handleTick(data);
      });

      this.socket.on('error', (err) => {
        this.stats.errorsEncountered++;
        this.stats.lastError = err?.message || String(err);
        feedLogger.error(`[FYERS] WebSocket error: ${this.stats.lastError}`);
      });

      this.socket.on('close', () => {
        feedLogger.warn('[FYERS] WebSocket closed.');
        this.status = 'DISCONNECTED';
        this._handleReconnect();
      });

      this.socket.connect();
    } catch (err) {
      feedLogger.error(`[FYERS] Failed to create socket: ${err.message}`);
      this.status = 'ERROR';
      this._handleReconnect();
    }
  }

  _handleTick(data) {
    if (!data) return;

    // fyers-api-v3 symbolUpdate format:
    //  { symbol, ltp, bid_price, ask_price, high_price, low_price, open_price, prev_close_price, volume, ch, chp, ... }
    const sym = data.symbol;
    if (!sym) return;

    // Resolve internal symbol from Fyers symbol
    const internalSymbol = FYERS_REVERSE_MAP[sym] || this._reverseResolveDynamic(sym);
    if (!internalSymbol) return;

    const ltp = parseFloat(data.ltp) || 0;
    if (!ltp) return;

    this.stats.ticksReceived++;
    this.stats.lastTickTime = Date.now();

    const normalizedTick = {
      symbol:        internalSymbol,
      exchange:      sym.startsWith('MCX:') ? 'MCX' : (sym.startsWith('BSE:') ? 'BSE' : 'NSE'),
      price:         ltp,
      ltp,
      bid:           parseFloat(data.bid_price)       || ltp,
      ask:           parseFloat(data.ask_price)       || ltp,
      high:          parseFloat(data.high_price)      || ltp,
      low:           parseFloat(data.low_price)       || ltp,
      open:          parseFloat(data.open_price)      || ltp,
      prev_close:    parseFloat(data.prev_close_price)|| ltp,
      change:        parseFloat(data.ch)              || 0,
      changePercent: parseFloat(data.chp)             || 0,
      volume:        parseInt(data.volume)            || 0,
      timestamp:     Date.now(),
      _debug:        { source: 'fyers' },
    };

    this.emit('tick', normalizedTick);
  }

  // ─────────────────────────────────────────────────────────────────
  //  RECONNECT STRATEGY
  // ─────────────────────────────────────────────────────────────────

  _handleReconnect() {
    if (this.status === 'DISABLED') return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      feedLogger.error('[FYERS] Max reconnection attempts reached. Feed remains disconnected.');
      this.status = 'ERROR';
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnections++;
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 60000);
    feedLogger.info(`[FYERS] Reconnecting ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    this._reconnectTimeout = setTimeout(async () => {
      // Re-authenticate if we've been disconnected many times (token might be stale)
      if (this.reconnectAttempts >= 3) {
        try {
          feedLogger.info('[FYERS] Re-authenticating before reconnect...');
          const token = await this._authenticate();
          if (token) this.accessToken = token;
        } catch (err) {
          feedLogger.warn(`[FYERS] Re-auth failed: ${err.message}`);
        }
      }
      this._connectWebSocket();
    }, delay);
  }

  // ─────────────────────────────────────────────────────────────────
  //  DAILY TOKEN REFRESH at 06:00 IST
  // ─────────────────────────────────────────────────────────────────

  _scheduleTokenRefresh() {
    this._clearRefreshTimer();

    const now    = new Date();
    const target = new Date();
    // 06:00 IST = 00:30 UTC
    target.setUTCHours(0, 30, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);

    const msUntilRefresh = target - now;
    feedLogger.info(`[FYERS] Token auto-refresh scheduled at 06:00 IST (in ${Math.round(msUntilRefresh / 60000)} min).`);

    this._tokenRefreshTimer = setTimeout(async () => {
      feedLogger.info('[FYERS] 🔄 Daily token refresh triggered...');
      try {
        await redisClient.del(REDIS_TOKEN_KEY); // force re-auth
        const token = await this._authenticate();
        if (token) {
          this.accessToken = token;
          feedLogger.info('[FYERS] ✅ Daily token refresh successful.');

          // Reconnect WebSocket with new token
          this._cleanupSocket();
          this._connectWebSocket();
        }
      } catch (err) {
        feedLogger.error(`[FYERS] Daily token refresh failed: ${err.message}`);
      }
      // Schedule next day's refresh
      this._scheduleTokenRefresh();
    }, msUntilRefresh);
  }

  _clearRefreshTimer() {
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer);
      this._tokenRefreshTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  REDIS TOKEN CACHE
  // ─────────────────────────────────────────────────────────────────

  async _loadTokenFromRedis() {
    try {
      if (!redisClient) return null;
      const token = await redisClient.get(REDIS_TOKEN_KEY);
      return token || null;
    } catch (err) {
      feedLogger.warn(`[FYERS] Redis token load failed: ${err.message}`);
      return null;
    }
  }

  async _saveTokenToRedis(token) {
    try {
      if (!redisClient || !token) return;
      await redisClient.setex(REDIS_TOKEN_KEY, 86400, token); // 24 hours
    } catch (err) {
      feedLogger.warn(`[FYERS] Redis token save failed: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  SYMBOL RESOLUTION HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * For NSE equity symbols not in the static map, dynamically build the Fyers symbol.
   * e.g. "ZYDUSWELL" → "NSE:ZYDUSWELL-EQ"
   */
  _dynamicFyersSymbol(symbol) {
    const upper = symbol.toUpperCase().trim();
    // Only do this for plain alphabetic NSE equity symbols
    if (/^[A-Z&\-]+$/.test(upper)) {
      return `NSE:${upper}-EQ`;
    }
    return null;
  }

  _reverseResolveDynamic(fyersSym) {
    // e.g. "NSE:ZYDUSWELL-EQ" → "ZYDUSWELL", "MCX:GOLD26AUGFUT" → "GOLD"
    const match = fyersSym.match(/^(?:NSE|BSE|MCX):(.+?)(?:-EQ|-INDEX|-BE)?$/);
    if (!match) return null;
    let base = match[1];
    if (fyersSym.startsWith('MCX:')) {
      const commMatch = base.match(/^([A-Z]+?)(?:\d{2}[A-Z]{3}FUT|\d{2}[A-Z]{3}\d+C[P]|\d{2}[A-Z]{3}\d+P)?$/);
      if (commMatch) base = commMatch[1];
    }
    return base;
  }

  // ─────────────────────────────────────────────────────────────────
  //  CLEANUP
  // ─────────────────────────────────────────────────────────────────

  _cleanupSocket() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
  }
}

const fyersFeed = new FyersFeed();
module.exports = { fyersFeed, FYERS_SYMBOL_MAP, FYERS_REVERSE_MAP };
