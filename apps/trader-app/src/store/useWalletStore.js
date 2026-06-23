import { create } from 'zustand';
import { api } from '../services/api';
import { cache, CACHE_KEYS, CACHE_TTL } from '../services/cache';

function normalizeWallet(raw) {
  if (!raw) return null;
  return {
    ...raw,
    usedMargin: raw.used_margin ?? raw.usedMargin ?? 0,
    availableMargin: raw.available_margin ?? raw.availableMargin ?? 0,
    todayPnl: raw.today_pnl ?? raw.todayPnl ?? 0,
    weekPnl: raw.week_pnl ?? raw.weekPnl ?? 0,
    totalPnl: raw.total_pnl ?? raw.totalPnl ?? 0,
    totalDeposited: raw.total_deposited ?? raw.totalDeposited ?? 0,
    totalWithdrawn: raw.total_withdrawn ?? raw.totalWithdrawn ?? 0,
    bonusBalance: raw.bonus_balance ?? raw.bonusBalance ?? 0,
    todayPnlPercent: raw.balance > 0 ? ((raw.today_pnl ?? 0) / raw.balance) * 100 : 0,
  };
}

export const useWalletStore = create((set, get) => ({
  wallet: null,
  walletTransactions: [],
  walletLoading: false,
  marginCallWarning: null,

  fetchWallet: async () => {
    // Show stale wallet immediately
    const stale = cache.get(CACHE_KEYS.WALLET);
    if (stale) {
      set({ wallet: stale, walletLoading: false });
    } else {
      set({ walletLoading: true });
    }
    try {
      const data = await api.getWallet();
      const normalized = normalizeWallet(data.wallet);
      cache.set(CACHE_KEYS.WALLET, normalized, CACHE_TTL.WALLET);
      set({
        wallet: normalized,
        walletTransactions: data.transactions || [],
        walletLoading: false
      });
    } catch (err) {
      console.error('Wallet fetch error:', err);
      set({ walletLoading: false });
    }
  },

  submitDeposit: async (amount, utr_number, screenshot_base64, payment_method_slot, method, metadata) => {
    set({ walletLoading: true });
    try {
      const data = await api.submitDeposit(amount, utr_number, screenshot_base64, payment_method_slot, method, metadata);
      await get().fetchWallet();
      set({ walletLoading: false });
      return { success: true, ...data };
    } catch (err) {
      set({ walletLoading: false });
      return { success: false, error: err.message };
    }
  },

  submitWithdrawal: async (withdrawalData) => {
    set({ walletLoading: true });
    try {
      const data = await api.submitWithdrawal(withdrawalData);
      await get().fetchWallet();
      set({ walletLoading: false });
      return { success: true, ...data };
    } catch (err) {
      set({ walletLoading: false });
      return { success: false, error: err.message };
    }
  },

  setWallet: (wallet) => set({ wallet: normalizeWallet(wallet) }),
}));
