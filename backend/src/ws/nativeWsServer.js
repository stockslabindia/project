const { WebSocketServer } = require('ws');
const { addWatcher, removeWatcher } = require('./priceAnimator');

let wss;
const roomSubscriptions = new Map(); // symbol -> Set(ws)
const clientSubscriptions = new Map(); // ws -> Set(symbol)

function initNativeWsServer(httpServer) {
  wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      clientNoContextTakeover: true, // Defaults to negotiated value.
      serverNoContextTakeover: true, // Defaults to negotiated value.
      serverMaxWindowBits: 10,       // Defaults to negotiated value.
      concurrencyLimit: 10,          // Limits zlib concurrency for performance.
      threshold: 1024                // Size (in bytes) below which messages should not be compressed.
    }
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws/prices') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    console.log('🔌 Native WS: Client connected to price feed');
    clientSubscriptions.set(ws, new Set());

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message);
        const { type, symbols } = payload;

        if (type === 'subscribe' && Array.isArray(symbols)) {
          symbols.forEach(symbol => {
            const sym = symbol.toUpperCase();
            
            // Subscriptions mapping (symbol -> ws)
            if (!roomSubscriptions.has(sym)) {
              roomSubscriptions.set(sym, new Set());
            }
            roomSubscriptions.get(sym).add(ws);

            // Client tracking (ws -> symbol)
            clientSubscriptions.get(ws).add(sym);

            // Notify animator this symbol now has a watcher
            addWatcher(sym);
          });
        } else if (type === 'unsubscribe' && Array.isArray(symbols)) {
          symbols.forEach(symbol => {
            const sym = symbol.toUpperCase();
            if (roomSubscriptions.has(sym)) {
              roomSubscriptions.get(sym).delete(ws);
              if (roomSubscriptions.get(sym).size === 0) {
                roomSubscriptions.delete(sym);
                // No more watchers — remove from animator hot loop
                removeWatcher(sym);
              }
            }
            clientSubscriptions.get(ws).delete(sym);
          });
        }
      } catch (err) {
        console.error('Native WS message parsing error:', err.message);
      }
    });

    ws.on('close', () => {
      const subs = clientSubscriptions.get(ws);
      if (subs) {
        subs.forEach(sym => {
          if (roomSubscriptions.has(sym)) {
            roomSubscriptions.get(sym).delete(ws);
            if (roomSubscriptions.get(sym).size === 0) {
              roomSubscriptions.delete(sym);
              // No more native WS watchers — remove from animator (Socket.IO may still watch)
              removeWatcher(sym);
            }
          }
        });
      }
      clientSubscriptions.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('Native WS socket error:', err.message);
    });
  });
}

/**
 * Broadcasts a batch of ticks to all subscribed clients
 * @param {Array} ticks - array of tick updates
 */
function broadcastPriceTicks(ticks) {
  if (!ticks || ticks.length === 0) return;

  // Group ticks by serialized payload — clients watching same symbols share the same JSON buffer
  // This avoids repeated JSON.stringify calls when multiple clients watch the same symbol.
  const clientMessages = new Map(); // ws -> array of ticks

  ticks.forEach(tick => {
    const sym = (tick.symbol || '').toUpperCase();
    const subscribers = roomSubscriptions.get(sym);
    if (subscribers && subscribers.size > 0) {
      const price = tick.price || tick.ltp || 0;
      const prunedTick = {
        symbol: tick.symbol,
        exchange: tick.exchange || 'NSE',
        price: price,
        change: tick.change !== undefined ? tick.change : (tick.change_amount || 0),
        changePercent: tick.changePercent !== undefined ? tick.changePercent : (tick.change_percent || 0),
        high: tick.high || tick.day_high || price,
        low: tick.low || tick.day_low || price,
        open: tick.open || tick.day_open || price,
        prev_close: tick.prev_close || tick.prevClose || 0,
        volume: tick.volume || 0,
        bid: tick.bid !== undefined ? tick.bid : (tick.bid_price || price),
        ask: tick.ask !== undefined ? tick.ask : (tick.ask_price || price),
        bid_qty: tick.bid_qty !== undefined ? tick.bid_qty : 0,
        ask_qty: tick.ask_qty !== undefined ? tick.ask_qty : 0,
        spread: tick.spread !== undefined ? tick.spread : 0,
        timestamp: tick.timestamp || Date.now()
      };

      subscribers.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          if (!clientMessages.has(ws)) {
            clientMessages.set(ws, []);
          }
          clientMessages.get(ws).push(prunedTick);
        }
      });
    }
  });

  // Pre-serialize: group clients by identical message content to minimize JSON.stringify calls
  const serializedCache = new Map(); // JSON string -> serialized buffer (shared across clients)

  clientMessages.forEach((clientTicks, ws) => {
    try {
      // Create a cache key from tick symbols (clients watching same symbols share the same payload)
      const cacheKey = clientTicks.map(t => t.symbol).join(',');
      let serialized = serializedCache.get(cacheKey);
      if (!serialized) {
        serialized = JSON.stringify({ type: 'ticks', data: clientTicks });
        serializedCache.set(cacheKey, serialized);
      }
      ws.send(serialized);
    } catch (err) {
      console.error('Failed to send native WS tick:', err.message);
    }
  });
}

module.exports = {
  initNativeWsServer,
  broadcastPriceTicks,
  roomSubscriptions
};
