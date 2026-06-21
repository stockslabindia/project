import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useWalletStore } from './useWalletStore';
import { useOrderStore } from './useOrderStore';
import { usePriceStore } from './usePriceStore';
import { api, connectUserSocket } from '../services/api';
import { soundEffects } from '../utils/sound';

// Main Trade Store — backward-compatible wrapper that delegates to sub-stores
export const useTradeStore = create((set, get) => {
  // Initial state merged from all stores
  const getMergedState = () => ({
    ...useAuthStore.getState(),
    ...useWalletStore.getState(),
    ...useOrderStore.getState(),
    ...usePriceStore.getState(),
    _notificationInterval: null,
    _dataSyncInterval: null,
    _visibilityHandler: null,
    _initializing: false,
    isLoading: false,
    notifications: [],
    unreadCount: 0,
    notificationsLoading: false,
    socketConnected: false,
    toasts: [],
  });

  return {
    ...getMergedState(),

    // Action proxies to sub-stores
    login: (email, password) => useAuthStore.getState().login(email, password),
    signup: (email, password, full_name, phone, referral_code) => useAuthStore.getState().signup(email, password, full_name, phone, referral_code),
    verifyOtp: (userId, otp, email, password) => useAuthStore.getState().verifyOtp(userId, otp, email, password),
    resendOtp: (userId) => useAuthStore.getState().resendOtp(userId),
    fetchProfile: () => useAuthStore.getState().fetchProfile(),
    
    // Wallet proxies
    fetchWallet: () => useWalletStore.getState().fetchWallet(),
    submitDeposit: (amount, utr_number, screenshot_base64, payment_method_slot, method) => useWalletStore.getState().submitDeposit(amount, utr_number, screenshot_base64, payment_method_slot, method),
    submitWithdrawal: (withdrawalData) => useWalletStore.getState().submitWithdrawal(withdrawalData),

    // Order proxies
    setOrderType: (type) => useOrderStore.getState().setOrderType(type),
    setOrderSide: (side) => useOrderStore.getState().setOrderSide(side),
    setQuantity: (qty) => useOrderStore.getState().setQuantity(qty),
    setActiveOrderTab: (tab) => useOrderStore.getState().setActiveOrderTab(tab),
    fetchOrders: () => useOrderStore.getState().fetchOrders(),
    placeOrder: (orderData) => useOrderStore.getState().placeOrder(orderData),
    cancelOrder: (id) => useOrderStore.getState().cancelOrder(id),
    modifyOrder: (id, orderData) => useOrderStore.getState().modifyOrder(id, orderData),
    getFilteredOrders: () => useOrderStore.getState().getFilteredOrders(),

    // Price / Instruments / Watchlists / Positions proxies
    setActiveMarketTab: (tab) => usePriceStore.getState().setActiveMarketTab(tab),
    setSearchQuery: (query) => usePriceStore.getState().setSearchQuery(query),
    setShowWatchlistOnly: (show) => usePriceStore.getState().setShowWatchlistOnly(show),
    setSelectedInstrument: (instrument) => usePriceStore.getState().setSelectedInstrument(instrument),
    setHistoryFilter: (filter) => usePriceStore.getState().setHistoryFilter(filter),
    fetchInstruments: () => usePriceStore.getState().fetchInstruments(),
    fetchPositions: () => usePriceStore.getState().fetchPositions(),
    fetchHistory: () => usePriceStore.getState().fetchHistory(),
    closePosition: (id, quantity) => usePriceStore.getState().closePosition(id, quantity),
    updatePositionSlTgt: (positionId, stopLoss, target) => usePriceStore.getState().updatePositionSlTgt(positionId, stopLoss, target),
    loadWatchlists: () => usePriceStore.getState().loadWatchlists(),
    setActiveWatchlistId: (id) => usePriceStore.getState().setActiveWatchlistId(id),
    updateWatchlists: (newWatchlists) => usePriceStore.getState().updateWatchlists(newWatchlists),
    toggleFavorite: (symbol) => usePriceStore.getState().toggleFavorite(symbol),
    isFavorite: (symbol) => usePriceStore.getState().isFavorite(symbol),
    getAllFavorites: () => usePriceStore.getState().getAllFavorites(),
    getStocks: () => usePriceStore.getState().getStocks(),
    getForex: () => usePriceStore.getState().getForex(),
    getMetals: () => usePriceStore.getState().getMetals(),
    getIndices: () => usePriceStore.getState().getIndices(),
    getFilteredInstruments: () => usePriceStore.getState().getFilteredInstruments(),
    getFilteredHistory: () => usePriceStore.getState().getFilteredHistory(),
    startPriceFeed: () => usePriceStore.getState().startPriceFeed(),
    updateSubscriptions: () => usePriceStore.getState().updateSubscriptions(),
    setSystemBanner: (banner) => usePriceStore.getState().setSystemBanner(banner),
    dismissBanner: () => usePriceStore.getState().dismissBanner(),


    logout: async () => {
      if (get()._notificationInterval) clearInterval(get()._notificationInterval);
      if (get()._dataSyncInterval) clearInterval(get()._dataSyncInterval);
      if (get()._visibilityHandler) document.removeEventListener('visibilitychange', get()._visibilityHandler);

      await useAuthStore.getState().logout();
      
      useWalletStore.setState({ wallet: null, walletTransactions: [], walletLoading: false });
      useOrderStore.setState({ orders: [], ordersLoading: false, quantity: '' });
      usePriceStore.setState({
        instruments: [],
        instrumentsMap: new Map(),
        positions: [],
        positionsMap: new Map(),
        tradeHistory: [],
        selectedInstrument: null,
        candles: {},
        systemBanner: null
      });

      set({
        notifications: [],
        unreadCount: 0,
        _notificationInterval: null,
        _dataSyncInterval: null,
        _visibilityHandler: null,
        _initializing: false,
        isLoading: false,
        socketConnected: false,
        toasts: []
      });
    },

    // Notifications state management (kept in trade store or can be isolated later)
    fetchNotifications: async () => {
      set({ notificationsLoading: true });
      try {
        const data = await api.getNotifications();
        const notifs = data.notifications || [];
        set({
          notifications: notifs,
          unreadCount: notifs.filter(n => !n.read).length,
          notificationsLoading: false,
        });
      } catch (err) {
        console.error('Notifications fetch error:', err);
        set({ notificationsLoading: false });
      }
    },

    markAsRead: (id) => set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: state.notifications.filter(n => !n.read && n.id !== id).length,
    })),

    addToast: (toast) => {
      const id = Math.random().toString(36).substring(2, 9);
      set((state) => ({
        toasts: [...state.toasts, { id, ...toast }]
      }));
      setTimeout(() => {
        get().removeToast(id);
      }, toast.duration || 5000);
    },

    removeToast: (id) => set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    })),

    // Realtime event handlers
    handleBroadcast: (data) => {
      usePriceStore.getState().setSystemBanner(data);
    },

    handleOrderFilled: (data) => {
      console.log('🔔 Order filled event received:', data);
      usePriceStore.getState().fetchPositions();
      useOrderStore.getState().fetchOrders();
      useWalletStore.getState().fetchWallet();
      soundEffects.playOrderTriggered();

      const order = data?.order || data;
      const side = (order?.side || 'BUY').toUpperCase();
      const symbol = order?.symbol || 'Instrument';
      const qty = order?.quantity || 0;
      const price = order?.price || 0;
      get().addToast({
        title: `Order Filled`,
        message: `${side} ${qty} ${symbol} @ ₹${price.toLocaleString('en-IN')}`,
        type: 'success',
      });
    },

    handlePnlUpdate: (pnlData) => {
      usePriceStore.getState().handlePnlUpdate(pnlData);
      if (pnlData && pnlData.marginCallWarning !== undefined) {
        const prevWarning = useWalletStore.getState().marginCallWarning;
        useWalletStore.setState({ marginCallWarning: pnlData.marginCallWarning });
        
        if (pnlData.marginCallWarning && !prevWarning) {
          get().addToast({
            title: `Margin Call Warning!`,
            message: `Margin level is low (${pnlData.marginCallWarning.marginLevel.toFixed(1)}%). Deposit funds immediately to avoid liquidation.`,
            type: 'warning',
            duration: 8000,
          });
        }
      }
    },

    loadInitialData: async () => {
      if (get()._initializing) return;
      set({ _initializing: true, isLoading: true });

      const priceStore = usePriceStore.getState();
      const walletStore = useWalletStore.getState();
      const orderStore = useOrderStore.getState();
      const authStore = useAuthStore.getState();

      await Promise.all([
        priceStore.fetchInstruments(),
        walletStore.fetchWallet(),
        priceStore.fetchPositions(),
        orderStore.fetchOrders(),
        priceStore.fetchHistory(),
        get().fetchNotifications(),
        priceStore.loadWatchlists(),
        useAuthStore.getState().fetchProfile(),
      ]);

      priceStore.startPriceFeed();
      priceStore.updateSubscriptions();
      
      const user = authStore.user;
      if (user && user.id) {
        connectUserSocket(user.id, {
          onConnect: () => set({ socketConnected: true }),
          onDisconnect: () => set({ socketConnected: false }),
          onOrderFilled: (data) => get().handleOrderFilled(data),
          onPnlUpdate: (data) => get().handlePnlUpdate(data),
          onBroadcast: (data) => get().handleBroadcast(data),
        });
        set({ socketConnected: true });
      }
      
      if (!get()._notificationInterval) {
        const interval = setInterval(() => {
          if (useAuthStore.getState().isAuthenticated) {
            get().fetchNotifications();
          }
        }, 30000);
        set({ _notificationInterval: interval });
      }

      if (get()._dataSyncInterval) clearInterval(get()._dataSyncInterval);
      const syncInterval = setInterval(() => {
        if (useAuthStore.getState().isAuthenticated) {
          walletStore.fetchWallet();
          priceStore.fetchPositions();
          orderStore.fetchOrders();
        }
      }, 30000);
      set({ _dataSyncInterval: syncInterval });

      if (get()._visibilityHandler) {
        document.removeEventListener('visibilitychange', get()._visibilityHandler);
      }
      const visHandler = () => {
        if (document.visibilityState === 'visible' && useAuthStore.getState().isAuthenticated) {
          walletStore.fetchWallet();
          priceStore.fetchPositions();
          orderStore.fetchOrders();
          priceStore.fetchHistory();
          priceStore.loadWatchlists();
        }
      };
      document.addEventListener('visibilitychange', visHandler);
      set({ _visibilityHandler: visHandler });
      
      set({ isLoading: false, _initializing: false });
    },
  };
});

// Setup listeners to keep useTradeStore in sync with all sub-stores
const syncWithMonolith = () => {
  const sync = () => {
    const auth = useAuthStore.getState();
    const wallet = useWalletStore.getState();
    const order = useOrderStore.getState();
    const price = usePriceStore.getState();
    
    useTradeStore.setState({
      isAuthenticated: auth.isAuthenticated,
      user: auth.user,
      authLoading: auth.authLoading,
      authError: auth.authError,
      
      wallet: wallet.wallet,
      walletTransactions: wallet.walletTransactions,
      walletLoading: wallet.walletLoading,
      marginCallWarning: wallet.marginCallWarning,
      
      orders: order.orders,
      ordersLoading: order.ordersLoading,
      activeOrderTab: order.activeOrderTab,
      orderType: order.orderType,
      orderSide: order.orderSide,
      quantity: order.quantity,
      orderLoading: order.orderLoading,
      
      instruments: price.instruments,
      instrumentsMap: price.instrumentsMap,
      instrumentsLoading: price.instrumentsLoading,
      positions: price.positions,
      positionsMap: price.positionsMap,
      positionsLoading: price.positionsLoading,
      tradeHistory: price.tradeHistory,
      historyLoading: price.historyLoading,
      historyFilter: price.historyFilter,
      activeMarketTab: price.activeMarketTab,
      searchQuery: price.searchQuery,
      showWatchlistOnly: price.showWatchlistOnly,
      selectedInstrument: price.selectedInstrument,
      candles: price.candles,
      debugStats: price.debugStats,
      activeWatchlistId: price.activeWatchlistId,
      watchlists: price.watchlists,
      systemBanner: price.systemBanner,
    });
  };

  useAuthStore.subscribe(sync);
  useWalletStore.subscribe(sync);
  useOrderStore.subscribe(sync);
  usePriceStore.subscribe(sync);
};

syncWithMonolith();
export default useTradeStore;
