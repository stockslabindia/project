import { create } from 'zustand';
import { api } from '../services/api';
import { cache, CACHE_KEYS, CACHE_TTL } from '../services/cache';
import { usePriceStore } from './usePriceStore';
import { useWalletStore } from './useWalletStore';
import { soundEffects } from '../utils/sound';

function normalizeOrder(raw) {
  return {
    ...raw,
    side: (raw.side || '').toUpperCase(),
    type: raw.order_type || raw.type || 'market',
    filledAt: raw.filled_at || raw.filledAt || null,
    cancelledAt: raw.cancelled_at || raw.cancelledAt || null,
    createdAt: raw.created_at || raw.createdAt || null,
  };
}

export const useOrderStore = create((set, get) => ({
  orders: [],
  ordersLoading: false,
  activeOrderTab: 'open',
  orderType: (() => {
    try {
      const saved = localStorage.getItem('tradex_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.defaultOrderType) return parsed.defaultOrderType;
      }
    } catch {}
    return 'market';
  })(),
  orderSide: 'buy',
  quantity: '',
  orderLoading: false,

  setOrderType: (type) => set({ orderType: type }),
  setOrderSide: (side) => set({ orderSide: side }),
  setQuantity: (qty) => set({ quantity: qty }),
  setActiveOrderTab: (tab) => set({ activeOrderTab: tab }),

  fetchOrders: async () => {
    // Show stale orders immediately
    const stale = cache.get(CACHE_KEYS.ORDERS);
    if (stale) {
      set({ orders: stale, ordersLoading: false });
    } else {
      set({ ordersLoading: true });
    }
    try {
      const data = await api.getOrders();
      const list = (data.orders || []).map(normalizeOrder);
      cache.set(CACHE_KEYS.ORDERS, list, CACHE_TTL.ORDERS);
      set({ orders: list, ordersLoading: false });
    } catch (err) {
      console.error('Orders fetch error:', err);
      set({ ordersLoading: false });
    }
  },

  placeOrder: async (orderData) => {
    set({ orderLoading: true });
    try {
      const data = await api.placeOrder(orderData);
      set({ orderLoading: false });
      
      const priceStore = usePriceStore.getState();
      const walletStore = useWalletStore.getState();

      // Play sound effects depending on status
      if (data.status === 'filled' || (data.order && data.order.status === 'filled')) {
        soundEffects.playOrderTriggered();
      } else {
        soundEffects.playOrderPlaced();
      }

      if (data.status === 'queued') {
        setTimeout(() => {
          priceStore.fetchPositions();
          get().fetchOrders();
          walletStore.fetchWallet();
        }, 2000);
      } else {
        priceStore.fetchPositions();
        get().fetchOrders();
        walletStore.fetchWallet();
        priceStore.fetchHistory();
      }
      return { success: true, ...data };
    } catch (err) {
      set({ orderLoading: false });
      soundEffects.playAlert();
      return { success: false, error: err.message };
    }
  },

  cancelOrder: async (id) => {
    try {
      await api.cancelOrder(id);
      await get().fetchOrders();
      await useWalletStore.getState().fetchWallet();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  modifyOrder: async (id, orderData) => {
    try {
      await api.modifyOrder(id, orderData);
      await get().fetchOrders();
      await useWalletStore.getState().fetchWallet();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  getFilteredOrders: () => {
    const state = get();
    switch (state.activeOrderTab) {
      case 'open': return state.orders.filter(o => o.status === 'pending');
      case 'filled': return state.orders.filter(o => o.status === 'filled');
      case 'cancelled': return state.orders.filter(o => o.status === 'cancelled');
      default: return state.orders;
    }
  },

  setOrders: (orders) => set({ orders: orders.map(normalizeOrder) }),
}));
