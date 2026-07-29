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
  'NIFTY26JULFUT': 'NSE:NIFTY26JULFUT',
  'BANKNIFTY26JULFUT': 'NSE:BANKNIFTY26JULFUT',
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
    this._resetAttemptsTimeout = null;
    this._lastAuthTime      = 0;
    this._authPromise       = null;
    this._authCooldownUntil = 0;

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

    // Reset reconnect state so that a watchdog/manual restart is not blocked
    // by a prior exhausted reconnect cycle.
    this.reconnectAttempts = 0;
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }

    this.appId = process.env.FYERS_APP_ID || null;

    try {
      // Dynamically load active MCX contract mappings on startup
      await this._loadMcxMappings();

      // Try to load cached token first — but always re-authenticate on a
      // fresh process start to avoid using a stale/expired token from Redis.
      // The Fyers access token is only valid for the trading day it was issued;
      // a server restart during the next day must get a fresh token.
      const cached = await this._loadTokenFromRedis();
      if (cached) {
        feedLogger.info('[FYERS] Found cached token in Redis. Re-authenticating to get a fresh token (server just started)...');
        // Clear the cached token so _authenticate() fetches a new one
        try { await redisClient.del(REDIS_TOKEN_KEY); } catch (e) {}
      }

      const token = await this._authenticate();
      if (!token) {
        this.status = 'ERROR';
        return false;
      }
      this.accessToken = token;

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

    // Subscribe indices in chunks as 'full' (false = Full mode) to ensure ltp updates
    for (let i = 0; i < indices.length; i += CHUNK_SIZE) {
      const chunk = indices.slice(i, i + CHUNK_SIZE);
      try {
        this.socket.subscribe(chunk, false);
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
      const fyersSym = FYERS_SYMBOL_MAP[sym.toUpperCase()] || this._dynamicFyersSymbol(sym);
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
  // Clears stale token + forces fresh authentication before reconnecting
  async resetCircuitBreaker() {
    feedLogger.info('[FYERS] Circuit breaker reset manually. Clearing token + re-authenticating...');
    this.reconnectAttempts = 0;
    this._lastAuthTime = 0; // Allow immediate re-auth
    this._authCooldownUntil = 0; // Clear any cooldown
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
    this._cleanupSocket();

    // Always force fresh authentication on manual reset
    try {
      await redisClient.del(REDIS_TOKEN_KEY);
    } catch (e) {}
    this.accessToken = null;

    try {
      const token = await this._authenticate();
      if (!token) {
        feedLogger.error('[FYERS] resetCircuitBreaker: authentication returned no token.');
        this.status = 'ERROR';
        return false;
      }
      this.accessToken = token;
      feedLogger.info('[FYERS] resetCircuitBreaker: fresh token obtained. Reconnecting WebSocket...');
      this._connectWebSocket();
      return true;
    } catch (err) {
      feedLogger.error(`[FYERS] resetCircuitBreaker: authentication failed: ${err.message}`);
      this.stats.lastError = err.message;
      this.status = 'ERROR';
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────

  async _authenticate() {
    // A reconnect, watchdog, and manual reset can all request authentication
    // at nearly the same time. Make them share one request and never let
    // bypass the cooldown; FYERS returns 429 when this endpoint is hit
    // too aggressively.
    if (this._authPromise) return this._authPromise;

    const now = Date.now();
    const cooldownUntil = Math.max(
      this._authCooldownUntil,
      this._lastAuthTime ? this._lastAuthTime + (5 * 60 * 1000) : 0,
    );

    if (now < cooldownUntil) {
      if (this.accessToken) return this.accessToken;
      const waitSeconds = Math.ceil((cooldownUntil - now) / 1000);
      throw new Error(`Fyers authentication cooldown active; retry in ${waitSeconds}s`);
    }

    this._lastAuthTime = now;
    this._authPromise = this._authenticateOnce()
      .catch((err) => {
        if (err?.response?.status === 429) {
          // Back off longer than the local 5-minute guard. FYERS can block an
          // app for the day after repeated per-minute limit violations.
          this._authCooldownUntil = Date.now() + (15 * 60 * 1000);
          feedLogger.warn('[FYERS] Authentication received HTTP 429; pausing attempts for 15 minutes.');
        }
        throw err;
      })
      .finally(() => {
        this._authPromise = null;
      });

    return this._authPromise;
  }

  async _authenticateOnce() {
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
          throw new Error(`/api/v3/token returned no auth code (response: ${JSON.stringify(res.data)})`);
        }
      } catch (err) {
        feedLogger.error(`[FYERS] Step 4/5 token exchange failed: ${err.response?.data?.message || err.message}`);
        throw err;
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
      const socket = fyersDataSocket.getInstance(tokenStr, this._logPath, false);
      this.socket = socket;

      socket.on('connect', () => {
        feedLogger.info('[FYERS] ✅ WebSocket connected!');
        this.status = 'CONNECTED';

        // Reset reconnect attempts only after 10 seconds of stable connection
        if (this._resetAttemptsTimeout) clearTimeout(this._resetAttemptsTimeout);
        this._resetAttemptsTimeout = setTimeout(() => {
          if (this.status === 'CONNECTED') {
            this.reconnectAttempts = 0;
            feedLogger.info('[FYERS] Connection stable. Reconnect attempts reset.');
          }
        }, 10000);

        // Subscribe to all pending symbols
        if (this.fyersSymbols.size > 0) {
          this._sendSubscribe(Array.from(this.fyersSymbols));
          feedLogger.info(`[FYERS] Re-subscribed to ${this.fyersSymbols.size} symbols.`);
        }
      });

      socket.on('message', (data) => {
        this._handleTick(data);
      });

      socket.on('error', async (err) => {
        this.stats.errorsEncountered++;
        this.stats.lastError = err?.message || String(err);
        feedLogger.error(`[FYERS] WebSocket error: ${this.stats.lastError}`);

        // If it's a token/authentication error, invalidate the cached token from Redis and force re-auth
        const errMsg = this.stats.lastError.toLowerCase();
        if (errMsg.includes('token') || errMsg.includes('auth') || errMsg.includes('credentials') || errMsg.includes('valid') || errMsg.includes('unauthorized') || errMsg.includes('expired')) {
          feedLogger.warn('[FYERS] Token/Auth error detected. Clearing cached token from Redis and memory to force re-authentication...');
          try {
            await redisClient.del(REDIS_TOKEN_KEY);
            this.accessToken = null; // Clear the memory token
            this._lastAuthTime = 0;  // Reset last auth time to allow immediate authentication
            if (this.reconnectAttempts < 3) {
              this.reconnectAttempts = 3; // Force reconnect to trigger re-authentication
            }
            // Close the socket to trigger reconnect with fresh token
            if (this.socket) {
              this.socket.close();
            }
          } catch (redisErr) {
            feedLogger.error(`[FYERS] Failed to clear token from Redis: ${redisErr.message}`);
          }
        }
      });

      socket.on('close', () => {
        // Explicit cleanup/replacement closes the old socket too. Ignore its
        // late close event so it cannot schedule a second connection.
        if (this.socket !== socket) return;
        this.socket = null;
        feedLogger.warn('[FYERS] WebSocket closed.');
        this.status = 'DISCONNECTED';
        this._handleReconnect();
      });

      socket.connect();
    } catch (err) {
      this.stats.errorsEncountered++;
      this.stats.lastError = err?.message || String(err);
      feedLogger.error(`[FYERS] Failed to create socket: ${this.stats.lastError}`);
      const errMsg = this.stats.lastError.toLowerCase();
      if (errMsg.includes('jwt') || errMsg.includes('hsm_key') || errMsg.includes('token') || errMsg.includes('invalid') || errMsg.includes('auth')) {
        this.accessToken = null;
        if (redisClient) redisClient.del(REDIS_TOKEN_KEY).catch(() => {});
      }
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
      bid_qty:       parseInt(data.bid_size)          || 0,
      ask_qty:       parseInt(data.ask_size)          || 0,
      high:          parseFloat(data.high_price)      || ltp,
      low:           parseFloat(data.low_price)       || ltp,
      open:          parseFloat(data.open_price)      || ltp,
      prev_close:    parseFloat(data.prev_close_price)|| ltp,
      change:        parseFloat(data.ch)              || 0,
      changePercent: parseFloat(data.chp)             || 0,
      volume:        parseInt(data.vol_traded_today || data.volume) || 0,
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
      let authSucceeded = true;
      // Re-authenticate if we've been disconnected many times (token might be stale)
      if (this.reconnectAttempts >= 3) {
        try {
          feedLogger.info('[FYERS] Re-authenticating before reconnect...');
          const token = await this._authenticate();
          if (token) {
            this.accessToken = token;
          } else {
            authSucceeded = false;
          }
        } catch (err) {
          feedLogger.warn(`[FYERS] Re-auth failed: ${err.message}`);
          authSucceeded = false;
        }
      }

      if (authSucceeded) {
        this._connectWebSocket();
      } else {
        // Respect the authentication cooldown instead of repeatedly hitting
        // Vagator after a 429 or a failed login.
        const retryDelay = Math.max(30000, this._authCooldownUntil - Date.now());
        feedLogger.warn(`[FYERS] Postponing connection attempt by ${Math.ceil(retryDelay / 1000)}s to allow authentication cooldown...`);
        if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
        this._reconnectTimeout = setTimeout(() => {
          this._connectWebSocket();
        }, retryDelay);
      }
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

  _dynamicFyersSymbol(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase().trim();

    // Check static map
    if (FYERS_SYMBOL_MAP[upper]) return FYERS_SYMBOL_MAP[upper];

    // Support NSE/BSE Futures & Options (e.g. NIFTY26JULFUT, BANKNIFTY26JUL52000CE)
    const isDeriv = upper.includes('FUT') || /^[A-Z0-9]+[0-9]{2}[A-Z]{3}[0-9]+[CP]E$/.test(upper);
    if (isDeriv) {
      return `NSE:${upper}`;
    }

    // Default: NSE Equity (e.g. RELIANCE -> NSE:RELIANCE-EQ)
    return `NSE:${upper}-EQ`;
  }

  _reverseResolveDynamic(fyersSym) {
    if (!fyersSym) return null;
    // e.g. "NSE:ZYDUSWELL-EQ" → "ZYDUSWELL", "NSE:NIFTY24JULFUT" → "NIFTY24JULFUT", "MCX:GOLD26AUGFUT" → "GOLD"
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
      const socket = this.socket;
      // Clear the active reference before closing. The close listener checks
      // identity, preventing intentional reconnects from spawning duplicates.
      this.socket = null;
      try {
        socket.close();
      } catch (e) {}
    }
    if (this._resetAttemptsTimeout) {
      clearTimeout(this._resetAttemptsTimeout);
      this._resetAttemptsTimeout = null;
    }
  }
}

const fyersFeed = new FyersFeed();
module.exports = { fyersFeed, FYERS_SYMBOL_MAP, FYERS_REVERSE_MAP };
