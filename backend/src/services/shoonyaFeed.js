const WebSocket = require('ws');
const EventEmitter = require('events');
const { feedLogger } = require('../core/monitoring/logger');

class ShoonyaFeed extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.status = 'DISCONNECTED';
    this.subscribedSymbols = new Set();
    
    this.userId = process.env.SHOONYA_USER_ID;
    this.susertoken = null;
    
    this.stats = {
      ticksReceived: 0,
      lastTickTime: null,
      reconnectCount: 0
    };
    
    // Convert generic symbols (NSE:SBIN) to Shoonya token formats
    this.shoonyaTokenMap = new Map(); // token -> generic symbol
    this.genericToShoonyaMap = new Map(); // generic symbol -> Shoonya key (e.g. NSE|3045)
  }

  getStatus() {
    return this.status;
  }

  async loadSusertoken() {
    try {
      const { redisClient } = require('../redis/client');
      if (redisClient) {
        return await redisClient.get('shoonya_susertoken');
      }
    } catch (e) {
      // Ignore redis errors
    }
    return null;
  }

  async start() {
    if (this.status === 'CONNECTED' || this.status === 'CONNECTING') return true;
    
    this.status = 'CONNECTING';
    
    this.susertoken = await this.loadSusertoken();
    
    if (!this.susertoken) {
      feedLogger.error('[SHOONYA FEED] No susertoken found in Redis. Please run shoonyaAutoLogin.js');
      this.status = 'ERROR';
      return false;
    }

    return new Promise((resolve) => {
      feedLogger.info('[SHOONYA FEED] Connecting to wss://api.shoonya.com/NorenWSTP/');
      this.ws = new WebSocket('wss://api.shoonya.com/NorenWSTP/');

      this.ws.on('open', () => {
        // Send Connect message
        const payload = {
          t: "c",
          uid: this.userId,
          actid: this.userId,
          source: "API",
          susertoken: this.susertoken
        };
        this.ws.send(JSON.stringify(payload));
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message, resolve);
        } catch (e) {
          feedLogger.error(`[SHOONYA FEED] Parse error: ${e.message}`);
        }
      });

      this.ws.on('close', () => {
        feedLogger.warn('[SHOONYA FEED] Connection closed');
        this.status = 'DISCONNECTED';
        this.emit('status', this.status);
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        feedLogger.error(`[SHOONYA FEED] Connection error: ${err.message}`);
        this.status = 'ERROR';
        this.emit('status', this.status);
      });
    });
  }
  
  handleMessage(msg, resolve) {
    if (msg.t === 'ck') {
      if (msg.s === 'OK') {
        feedLogger.info('[SHOONYA FEED] Connected & Authenticated successfully.');
        this.status = 'CONNECTED';
        this.emit('status', this.status);
        
        // Resubscribe to existing symbols
        if (this.subscribedSymbols.size > 0) {
          this.sendSubscribe(Array.from(this.subscribedSymbols));
        }
        
        if (resolve) resolve(true);
      } else {
        feedLogger.error(`[SHOONYA FEED] Auth failed: ${JSON.stringify(msg)}`);
        this.status = 'ERROR';
        if (resolve) resolve(false);
      }
    }
    
    if (msg.t === 'tf') {
      // Touchline / tick data
      this.processTick(msg);
    }
  }
  
  processTick(msg) {
    if (!msg.e || !msg.tk) return; // Need exchange and token
    
    const shoonyaKey = `${msg.e}|${msg.tk}`;
    const genericSymbol = this.shoonyaTokenMap.get(shoonyaKey);
    
    if (!genericSymbol) return; // We didn't subscribe to this or map it
    
    this.stats.ticksReceived++;
    this.stats.lastTickTime = Date.now();
    
    // Normalize to our system's expected format
    const tick = {
      symbol: genericSymbol,
      exchange: msg.e,
      price: msg.lp ? parseFloat(msg.lp) : 0,
      ltp: msg.lp ? parseFloat(msg.lp) : 0,
      bid: msg.bp1 ? parseFloat(msg.bp1) : (msg.lp ? parseFloat(msg.lp) : 0),
      ask: msg.sp1 ? parseFloat(msg.sp1) : (msg.lp ? parseFloat(msg.lp) : 0),
      open: msg.o ? parseFloat(msg.o) : 0,
      high: msg.h ? parseFloat(msg.h) : 0,
      low: msg.l ? parseFloat(msg.l) : 0,
      prev_close: msg.c ? parseFloat(msg.c) : 0,
      volume: msg.v ? parseInt(msg.v, 10) : 0,
      changePercent: msg.pc ? parseFloat(msg.pc) : 0,
      timestamp: Date.now(),
      _debug: { source: 'shoonya' }
    };
    
    if (tick.price > 0) {
      this.emit('tick', tick);
    }
  }

  scheduleReconnect() {
    if (this.status === 'CONNECTING' || this.reconnectTimer) return;
    this.stats.reconnectCount++;
    feedLogger.info(`[SHOONYA FEED] Scheduling reconnect in 5s... (Attempt ${this.stats.reconnectCount})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, 5000);
  }

  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.status = 'DISCONNECTED';
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async resolveShoonyaToken(symbol) {
    // Uses the symbolMap to find Shoonya's token.
    const { getInstrumentDetails } = require('./symbolMap');
    const details = getInstrumentDetails(symbol);
    if (details && details.exchange_token && details.exchange) {
      const e = details.exchange; // e.g. NSE, BSE, NFO, MCX
      const tk = details.exchange_token;
      return `${e}|${tk}`;
    }
    // Fallback if not found in map (just an example, in reality we need the DB map)
    return null;
  }

  async subscribe(symbols) {
    if (!Array.isArray(symbols)) return;
    
    const newKeys = [];
    for (const sym of symbols) {
      this.subscribedSymbols.add(sym);
      const shoonyaKey = await this.resolveShoonyaToken(sym);
      if (shoonyaKey) {
        this.shoonyaTokenMap.set(shoonyaKey, sym);
        this.genericToShoonyaMap.set(sym, shoonyaKey);
        newKeys.push(shoonyaKey);
      }
    }
    
    if (newKeys.length > 0 && this.status === 'CONNECTED') {
      this.sendSubscribe(newKeys, true);
    }
  }

  async unsubscribe(symbols) {
    if (!Array.isArray(symbols)) return;
    
    const keysToRemove = [];
    for (const sym of symbols) {
      this.subscribedSymbols.delete(sym);
      const shoonyaKey = this.genericToShoonyaMap.get(sym);
      if (shoonyaKey) {
        keysToRemove.push(shoonyaKey);
        // Don't remove from map, just unsubscribe
      }
    }
    
    if (keysToRemove.length > 0 && this.status === 'CONNECTED') {
      this.sendSubscribe(keysToRemove, false);
    }
  }
  
  sendSubscribe(keys, subscribe = true) {
    if (!this.ws || this.status !== 'CONNECTED') return;
    
    const kString = keys.join('#');
    const payload = {
      t: subscribe ? "t" : "u", // t = touchline subscribe, u = unsubscribe
      k: kString
    };
    this.ws.send(JSON.stringify(payload));
  }
}

const shoonyaFeed = new ShoonyaFeed();
module.exports = { shoonyaFeed };
