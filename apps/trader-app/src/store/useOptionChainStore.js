import { create } from 'zustand';
import { api, subscribeWsSymbols } from '../services/api';

export const useOptionChainStore = create((set, get) => ({
  underlying: 'NIFTY',
  selectedExpiry: '',
  expiries: [],
  spotPrice: 0,
  spotChange: 0,
  spotChangePct: 0,
  atmStrike: 0,
  strikeGap: 50,
  strikes: [],
  isLoading: false,
  error: null,

  setUnderlying: (underlying) => {
    set({ underlying, selectedExpiry: '', strikes: [] });
    get().fetchExpiries(underlying);
  },

  setSelectedExpiry: (expiry) => {
    set({ selectedExpiry: expiry });
    const underlying = get().underlying;
    get().fetchOptionChain(underlying, expiry);
  },

  fetchExpiries: async (underlyingSymbol) => {
    const sym = underlyingSymbol || get().underlying;
    try {
      const res = await api.getOptionExpiries(sym);
      if (res && res.expiries && res.expiries.length > 0) {
        const firstExp = res.expiries[0].date;
        set({ expiries: res.expiries, selectedExpiry: firstExp });
        get().fetchOptionChain(sym, firstExp);
      }
    } catch (err) {
      set({ error: err.message || 'Failed to load expiries' });
    }
  },

  fetchOptionChain: async (underlyingSymbol, expiryDate) => {
    const sym = underlyingSymbol || get().underlying;
    const exp = expiryDate || get().selectedExpiry;
    if (!exp) return;

    set({ isLoading: true, error: null });
    try {
      const res = await api.getOptionChain(sym, exp);
      if (res) {
        set({
          underlying: res.underlying || sym,
          selectedExpiry: res.expiry || exp,
          spotPrice: res.spotPrice || 0,
          spotChange: res.spotChange || 0,
          spotChangePct: res.spotChangePct || 0,
          atmStrike: res.atmStrike || 0,
          strikeGap: res.strikeGap || 50,
          expiries: res.expiries || get().expiries,
          strikes: res.strikes || [],
          isLoading: false
        });

        // Dynamic WS Subscription for option chain symbols
        if (res.strikes && res.strikes.length > 0) {
          const wsSymbols = [];
          res.strikes.forEach(row => {
            if (row.CE?.symbol) wsSymbols.push(row.CE.symbol);
            if (row.PE?.symbol) wsSymbols.push(row.PE.symbol);
          });
          if (sym) wsSymbols.push(sym);
          subscribeWsSymbols(wsSymbols);
        }
      }
    } catch (err) {
      set({ isLoading: false, error: err.message || 'Failed to load option chain' });
    }
  },

  updateOptionTick: (symbol, tick) => {
    const strikes = get().strikes;
    if (!strikes || strikes.length === 0 || !tick) return;

    let updated = false;
    const newStrikes = strikes.map(row => {
      let newCE = row.CE;
      let newPE = row.PE;

      if (row.CE && row.CE.symbol === symbol) {
        newCE = {
          ...row.CE,
          ltp: tick.price || tick.ltp || row.CE.ltp,
          change: tick.change ?? row.CE.change,
          changePercent: tick.changePercent ?? row.CE.changePercent,
          open_interest: tick.open_interest || row.CE.open_interest
        };
        updated = true;
      } else if (row.PE && row.PE.symbol === symbol) {
        newPE = {
          ...row.PE,
          ltp: tick.price || tick.ltp || row.PE.ltp,
          change: tick.change ?? row.PE.change,
          changePercent: tick.changePercent ?? row.PE.changePercent,
          open_interest: tick.open_interest || row.PE.open_interest
        };
        updated = true;
      }

      return updated ? { ...row, CE: newCE, PE: newPE } : row;
    });

    if (updated) {
      set({ strikes: newStrikes });
    }
  }
}));
