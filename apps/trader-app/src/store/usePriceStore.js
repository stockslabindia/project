import { create } from 'zustand';
import { api, connectPriceFeed, debugSubscribeWs, subscribeWsSymbols, updatePositionSlTgtWs } from '../services/api';
import { cache, CACHE_KEYS, CACHE_TTL } from '../services/cache';

function generateSparkline() {
  const points = [];
  let val = 50 + Math.random() * 50;
  for (let i = 0; i < 20; i++) {
    val += (Math.random() - 0.48) * 8;
    points.push(Math.max(10, Math.min(90, val)));
  }
  return points;
}

function normalizeInstrument(raw) {
  return {
    ...raw,
    price: raw.last_price ?? raw.price ?? 0,
    change: raw.change_amount ?? raw.change ?? 0,
    changePercent: raw.change_percent ?? raw.changePercent ?? 0,
    high: raw.day_high ?? raw.high ?? 0,
    low: raw.day_low ?? raw.low ?? 0,
    open: raw.day_open ?? raw.open ?? 0,
    prevClose: raw.prev_close ?? raw.prevClose ?? 0,
    sparkline: raw.sparkline || generateSparkline(),
  };
}

function normalizePosition(raw) {
  const side = raw.side === 'long' ? 'BUY' : raw.side === 'short' ? 'SELL' : (raw.type || raw.side || '').toUpperCase();
  const entryPrice = raw.entry_price ?? raw.entryPrice ?? 0;
  const currentPrice = raw.current_price ?? raw.currentPrice ?? entryPrice;
  const qty = raw.quantity ?? 0;
  const unrealizedPnl = raw.unrealized_pnl ?? raw.pnl ?? ((side === 'BUY' ? 1 : -1) * (currentPrice - entryPrice) * qty);
  const marginUsed = raw.margin_used ?? raw.margin ?? 0;
  return {
    ...raw,
    type: side,
    entryPrice,
    currentPrice,
    pnl: unrealizedPnl,
    pnlPercent: marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0,
    margin: marginUsed,
  };
}

function normalizeTrade(raw) {
  const side = (raw.side || '').toUpperCase();
  return {
    ...raw,
    type: side === 'BUY' ? 'BUY' : 'SELL',
    pnl: raw.net_pnl ?? raw.pnl ?? 0,
    entryPrice: raw.entry_price ?? raw.entryPrice ?? 0,
    exitPrice: raw.exit_price ?? raw.exitPrice ?? 0,
    openDate: raw.opened_at ? new Date(raw.opened_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (raw.openDate || ''),
    closeDate: raw.closed_at ? new Date(raw.closed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (raw.closeDate || ''),
  };
}

export const usePriceStore = create((set, get) => ({
  instruments: [],
  instrumentsMap: new Map(),
  instrumentsLoading: false,

  positions: [],
  positionsMap: new Map(),
  positionsLoading: false,

  tradeHistory: [],
  historyLoading: false,
  historyFilter: { symbol: '', dateRange: 'all' },

  activeMarketTab: 'stocks',
  searchQuery: '',
  showWatchlistOnly: false,
  // Restore last selected instrument from localStorage on page load
  selectedInstrument: (() => {
    try {
      const saved = localStorage.getItem('selected_instrument');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })(),
  candles: {},
  debugStats: null,

  // Watchlists
  activeWatchlistId: 'MW-1',
  watchlists: { 'MW-1': [], 'MW-2': [], 'MW-3': [], 'MW-4': [], 'MW-5': [] },

  // Favorites (kept in sync with localStorage for persistence)
  // Bug #19: stored as state so components re-render on change without set({})
  favorites: (() => {
    try { return new Set(JSON.parse(localStorage.getItem('tradex_watchlist') || '[]')); }
    catch { return new Set(); }
  })(),

  // System Banner
  systemBanner: null,

  setSystemBanner: (banner) => set({ systemBanner: banner }),
  dismissBanner: () => set({ systemBanner: null }),
  setActiveMarketTab: (tab) => set({ activeMarketTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setShowWatchlistOnly: (show) => set({ showWatchlistOnly: show }),
  setSelectedInstrument: (instrument) => {
    set({ selectedInstrument: instrument });
    // Persist selection so it survives page refresh
    try {
      if (instrument) {
        localStorage.setItem('selected_instrument', JSON.stringify(instrument));
      } else {
        localStorage.removeItem('selected_instrument');
      }
    } catch {}
    get().updateSubscriptions();
  },
  setHistoryFilter: (filter) => set((state) => ({ historyFilter: { ...state.historyFilter, ...filter } })),

  addPosition: (rawPosition) => {
    const pos = normalizePosition(rawPosition);
    set((state) => {
      const map = new Map(state.positionsMap);
      map.set(pos.id, pos);
      const list = Array.from(map.values());
      // Update cache
      cache.set(CACHE_KEYS.POSITIONS, list, CACHE_TTL.POSITIONS);
      return { positionsMap: map, positions: list };
    });
  },

  fetchInstruments: async () => {
    // Load stale cache immediately so UI renders before network returns
    const stale = cache.get(CACHE_KEYS.INSTRUMENTS);
    if (stale && stale.length > 0) {
      const map = new Map(stale.map(i => [i.symbol, i]));
      set({ instruments: stale, instrumentsMap: map, instrumentsLoading: false });
    } else {
      set({ instrumentsLoading: true });
    }
    try {
      const data = await api.getInstruments();
      const list = (data.instruments || []).map(normalizeInstrument);
      const map = new Map(list.map(i => [i.symbol, i]));
      cache.set(CACHE_KEYS.INSTRUMENTS, list, CACHE_TTL.INSTRUMENTS);
      set({ instruments: list, instrumentsMap: map, instrumentsLoading: false });
    } catch (err) {
      console.error('Instruments fetch error:', err);
      set({ instrumentsLoading: false });
    }
  },

  fetchPositions: async () => {
    // Show stale positions immediately
    const stale = cache.get(CACHE_KEYS.POSITIONS);
    if (stale) {
      const map = new Map(stale.map(p => [p.id, p]));
      set({ positions: stale, positionsMap: map, positionsLoading: false });
    } else {
      set({ positionsLoading: true });
    }
    try {
      const data = await api.getPositions();
      const list = (data.positions || []).map(normalizePosition);
      const map = new Map(list.map(p => [p.id, p]));
      cache.set(CACHE_KEYS.POSITIONS, list, CACHE_TTL.POSITIONS);
      set({ positions: list, positionsMap: map, positionsLoading: false });
    } catch (err) {
      console.error('Positions fetch error:', err);
      set({ positionsLoading: false });
    }
  },

  fetchHistory: async () => {
    // Show stale history immediately
    const stale = cache.get(CACHE_KEYS.HISTORY);
    if (stale) {
      set({ tradeHistory: stale, historyLoading: false });
    } else {
      set({ historyLoading: true });
    }
    try {
      const data = await api.getTradeHistory();
      const list = (data.trades || []).map(normalizeTrade);
      cache.set(CACHE_KEYS.HISTORY, list, CACHE_TTL.HISTORY);
      set({ tradeHistory: list, historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },

  closePosition: async (id, quantity) => {
    try {
      const data = await api.closePosition(id, quantity);
      // Update state
      set((state) => {
        const map = new Map(state.positionsMap);
        if (data.position && (data.position.status === 'closed' || data.position.status === 'CLOSED')) {
          map.delete(id);
        } else if (data.position) {
          map.set(id, normalizePosition(data.position));
        } else {
          map.delete(id);
        }
        return {
          positionsMap: map,
          positions: Array.from(map.values())
        };
      });
      return { success: true, ...data };
    } catch (err) {
      get().fetchPositions();
      return { success: false, error: err.message };
    }
  },

  updatePositionSlTgt: (positionId, stopLoss, target) => {
    set(state => {
      const map = new Map(state.positionsMap);
      const pos = map.get(positionId);
      if (pos) {
        map.set(positionId, { ...pos, stop_loss: stopLoss, target: target, take_profit: target });
      }
      return {
        positionsMap: map,
        positions: Array.from(map.values())
      };
    });
    updatePositionSlTgtWs(positionId, stopLoss, target);
  },

  loadWatchlists: async () => {
    // Show stale watchlists immediately
    const stale = cache.get(CACHE_KEYS.WATCHLISTS);
    if (stale) {
      set({ activeWatchlistId: stale.active || 'MW-1', watchlists: stale.lists });
      get().updateSubscriptions();
    }
    try {
      const data = await api.getWatchlist();
      if (data && data.watchlist) {
        let loadedWatchlists = data.watchlist.lists || { 'MW-1': [], 'MW-2': [], 'MW-3': [], 'MW-4': [], 'MW-5': [] };
        
        // If all lists are empty, seed default popular symbols for a great out-of-the-box experience
        const isEmpty = Object.values(loadedWatchlists).every(list => !list || list.length === 0);
        if (isEmpty) {
          loadedWatchlists = {
            'MW-1': ['NIFTY50', 'BANKNIFTY', 'BTCUSDT', 'EURUSD', 'XAUUSD', 'AAPL'],
            'MW-2': ['AXISBANK', 'ASIANPAINT', 'ADANIENT'],
            'MW-3': ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
            'MW-4': ['EURUSD', 'GBPUSD', 'USDINR'],
            'MW-5': ['XAUUSD', 'CRUDEOIL', 'NATURALGAS']
          };
          api.saveWatchlist({ active: data.watchlist.active || 'MW-1', lists: loadedWatchlists }).catch(err => {
            console.error('Failed to save seeded watchlist:', err);
          });
        }

        cache.set(CACHE_KEYS.WATCHLISTS, { active: data.watchlist.active || 'MW-1', lists: loadedWatchlists }, CACHE_TTL.WATCHLISTS);
        set({
          activeWatchlistId: data.watchlist.active || 'MW-1',
          watchlists: loadedWatchlists
        });
        get().updateSubscriptions();
      }
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    }
  },

  setActiveWatchlistId: (id) => {
    set({ activeWatchlistId: id });
    const { watchlists } = get();
    api.saveWatchlist({ active: id, lists: watchlists }).catch(() => {});
    get().updateSubscriptions();
  },

  updateWatchlists: (newWatchlists) => {
    set({ watchlists: newWatchlists });
    const { activeWatchlistId } = get();
    api.saveWatchlist({ active: activeWatchlistId, lists: newWatchlists }).catch(() => {});
    get().updateSubscriptions();
  },

  toggleFavorite: (symbol) => {
    set((state) => {
      const favs = new Set(state.favorites);
      if (favs.has(symbol)) {
        favs.delete(symbol);
      } else {
        favs.add(symbol);
      }
      // Persist to localStorage for cross-session survival
      try { localStorage.setItem('tradex_watchlist', JSON.stringify(Array.from(favs))); } catch {}
      return { favorites: favs };
    });
  },

  isFavorite: (symbol) => get().favorites.has(symbol),

  getAllFavorites: () => {
    const state = get();
    return state.instruments.filter(i => state.favorites.has(i.symbol));
  },

  getStocks: () => get().instruments.filter(i => ['nse_equity', 'bse_equity'].includes(i.segment)),
  getForex: () => get().instruments.filter(i => i.segment === 'forex'),
  getMetals: () => get().instruments.filter(i => i.segment === 'mcx'),
  // Bug #14: 'index' segment covers actual indices (NIFTY50, BANKNIFTY, etc.)
  // fo_futures / fo_options are derivatives, not indices
  getIndices: () => get().instruments.filter(i => i.segment === 'index'),

  getFilteredInstruments: () => {
    const state = get();
    const query = state.searchQuery.toLowerCase();
    let list;

    switch (state.activeMarketTab) {
      case 'stocks': list = state.getStocks(); break;
      case 'forex': list = state.getForex(); break;
      case 'metals': list = state.getMetals(); break;
      case 'indices': list = state.getIndices(); break;
      default: list = state.getStocks();
    }

    if (state.showWatchlistOnly) {
      list = list.filter(i => state.favorites.has(i.symbol));
    }

    if (!query) return list;
    return list.filter(i =>
      i.symbol.toLowerCase().includes(query) || i.name.toLowerCase().includes(query)
    );
  },

  getFilteredHistory: () => {
    const state = get();
    let history = state.tradeHistory;
    if (state.historyFilter.symbol) {
      history = history.filter(t => t.symbol.toLowerCase().includes(state.historyFilter.symbol.toLowerCase()));
    }
    return history;
  },

  startPriceFeed: () => {
    let tickBuffer = [];
    let frameId = null;
    let lastUpdate = 0;

    const processBatch = () => {
      const now = Date.now();
      if (tickBuffer.length > 0 && now - lastUpdate >= 150) {
        lastUpdate = now;
        const batch = [...tickBuffer];
        tickBuffer = [];

        set((state) => {
          const updatedSymbols = new Set(batch.map(b => b.symbol));
          const latestTicks = {};
          batch.forEach(tick => {
            latestTicks[tick.symbol] = tick;
          });

          const newInstrumentsMap = new Map(state.instrumentsMap);
          const newPositionsMap = new Map(state.positionsMap);

          for (const symbol in latestTicks) {
            const update = latestTicks[symbol];
            const instrument = newInstrumentsMap.get(symbol);
            if (instrument) {
              const previousPrice = instrument.price || instrument.last_price || 0;
              const newPrice = update.ltp || update.price || previousPrice;
              
              let tickDirection = instrument.tickDirection || 'none';
              if (newPrice > previousPrice) tickDirection = 'up';
              else if (newPrice < previousPrice) tickDirection = 'down';

              newInstrumentsMap.set(symbol, {
                ...instrument,
                last_price: newPrice,
                price: newPrice,
                change_amount: update.change !== undefined ? update.change : instrument.change || 0,
                change: update.change !== undefined ? update.change : instrument.change || 0,
                change_percent: update.change_percent !== undefined ? update.change_percent : instrument.changePercent || 0,
                changePercent: update.change_percent !== undefined ? update.change_percent : instrument.changePercent || 0,
                day_high: update.high || instrument.high || 0,
                high: update.high || instrument.high || 0,
                day_low: update.low || instrument.low || 0,
                low: update.low || instrument.low || 0,
                day_open: update.open || instrument.open || 0,
                open: update.open || instrument.open || 0,
                prev_close: update.prev_close || instrument.prevClose || 0,
                prevClose: update.prev_close || instrument.prevClose || 0,
                volume: update.volume || instrument.volume || 0,
                bid_price: update.bid !== undefined ? update.bid : instrument.bid_price || 0,
                ask_price: update.ask !== undefined ? update.ask : instrument.ask_price || 0,
                spread: update.spread !== undefined ? update.spread : instrument.spread || 0,
                tickDirection,
                lastTickTime: Date.now()
              });
            }
          }

          newPositionsMap.forEach((pos, id) => {
            if (updatedSymbols.has(pos.symbol)) {
              const priceUpdate = latestTicks[pos.symbol];
              if (priceUpdate) {
                const currentPrice = priceUpdate.price || priceUpdate.ltp;
                const exitPrice = pos.type === 'BUY' ? priceUpdate.bid : priceUpdate.ask;
                const evalPrice = exitPrice > 0 ? exitPrice : currentPrice;
                
                const unrealizedPnl = pos.type === 'BUY'
                  ? (evalPrice - pos.entryPrice) * pos.quantity
                  : (pos.entryPrice - evalPrice) * pos.quantity;
                  
                newPositionsMap.set(id, {
                  ...pos,
                  current_price: evalPrice,
                  currentPrice: evalPrice,
                  pnl: unrealizedPnl,
                  pnlPercent: pos.margin > 0 ? (unrealizedPnl / pos.margin) * 100 : 0,
                });
              }
            }
          });

          return {
            instrumentsMap: newInstrumentsMap,
            positionsMap: newPositionsMap,
            positions: Array.from(newPositionsMap.values())
          };
        });
      }
      frameId = requestAnimationFrame(processBatch);
    };

    frameId = requestAnimationFrame(processBatch);

    connectPriceFeed((updates) => {
      tickBuffer.push(...updates);
    }, (candleMsg) => {
      set(state => ({
        candles: {
          ...state.candles,
          [`${candleMsg.symbol}_${candleMsg.timeframe}`]: candleMsg.candles
        }
      }));
    }, (debugMsg) => {
      set({ debugStats: debugMsg });
    });
    
    setTimeout(() => debugSubscribeWs(), 1000);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  },

  updateSubscriptions: () => {
    const state = get();
    const symbolsToSub = new Set();
    
    symbolsToSub.add('NIFTY50');
    symbolsToSub.add('BANKNIFTY');

    const activeList = state.watchlists[state.activeWatchlistId] || [];
    activeList.forEach(s => symbolsToSub.add(s));
    
    if (state.selectedInstrument) {
      symbolsToSub.add(state.selectedInstrument.symbol);
    }
    
    state.positions.forEach(p => {
      if (p.status !== 'CLOSED') symbolsToSub.add(p.symbol);
    });
    
    subscribeWsSymbols(Array.from(symbolsToSub));
  },

  handlePnlUpdate: (pnlData) => {
    if (!pnlData || !pnlData.positions) return;
    
    set((state) => {
      const map = new Map(state.positionsMap);
      pnlData.positions.forEach(livePos => {
        const pos = map.get(livePos.id);
        if (pos) {
          map.set(livePos.id, {
            ...pos,
            currentPrice: livePos.currentPrice,
            current_price: livePos.currentPrice,
            pnl: livePos.unrealizedPnl,
            pnlPercent: pos.margin > 0 ? (livePos.unrealizedPnl / pos.margin) * 100 : 0,
          });
        }
      });
      return {
        positionsMap: map,
        positions: Array.from(map.values())
      };
    });
  },
}));
