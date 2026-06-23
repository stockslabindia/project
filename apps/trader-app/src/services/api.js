import { io } from 'socket.io-client';

// ══════════════════════════════════════════════════════════════
// TradeX Trader App — API Service Layer
// Connects to Express backend at localhost:4000
// ══════════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws/prices';

// ── Token management ──
function clearSession() {
  localStorage.removeItem('tradex_user');
  localStorage.removeItem('tradex_access_token');
  localStorage.removeItem('tradex_refresh_token');
  localStorage.removeItem('tradex_risk_acknowledged');
}

// ── Token refresh ──
let refreshTokenPromise = null;

async function tryRefreshToken() {
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('tradex_refresh_token');
      if (!refreshToken) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: 'include'
      });
      
      if (!res.ok) return false;
      const data = await res.json();
      if (data.session) {
        localStorage.setItem('tradex_access_token', data.session.access_token);
        localStorage.setItem('tradex_refresh_token', data.session.refresh_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshTokenPromise = null;
    }
  })();

  return refreshTokenPromise;
}

// ── HTTP helper ──
async function request(path, options = {}, _isRetry = false) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  // Add Bearer token for cross-domain auth (cookies blocked across different domains)
  const token = localStorage.getItem('tradex_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  const data = await res.json();

  if (!res.ok) {
    // Only redirect on 401 if it's NOT a login, signup, or OTP-related request
    const isAuthRequest = path.includes('/auth/login')
      || path.includes('/auth/signup')
      || path.includes('/auth/verify-otp')
      || path.includes('/auth/resend-otp')
      || path.includes('/auth/refresh');
    if (res.status === 401 && !_isRetry && !isAuthRequest) {
      // Try refreshing token once before giving up
      const refreshed = await tryRefreshToken();
      if (refreshed) return request(path, options, true);
      clearSession();
      window.location.href = '/login';
    }
    const err = new Error(data.error || 'Request failed');
    err.data = data;
    throw err;
  }
  return data;
}

// ══════════════════════════════════════════════════════════════
// API Methods
// ══════════════════════════════════════════════════════════════
export const api = {
  // ── Auth ──
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('tradex_user', JSON.stringify(data.user));
    if (data.session) {
      localStorage.setItem('tradex_access_token', data.session.access_token);
      localStorage.setItem('tradex_refresh_token', data.session.refresh_token);
    }
    return data;
  },

  async signup(email, password, full_name, phone, referral_code) {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, phone, referral_code }),
    });
    if (!data.requires_otp) {
      localStorage.setItem('tradex_user', JSON.stringify(data.user));
      if (data.session) {
        localStorage.setItem('tradex_access_token', data.session.access_token);
        localStorage.setItem('tradex_refresh_token', data.session.refresh_token);
      }
    }
    return data;
  },

  async verifyOtp(userId, otp, email, password) {
    const data = await request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ userId, otp, email, password }),
    });
    localStorage.setItem('tradex_user', JSON.stringify(data.user));
    if (data.session) {
      localStorage.setItem('tradex_access_token', data.session.access_token);
      localStorage.setItem('tradex_refresh_token', data.session.refresh_token);
    }
    return data;
  },

  async resendOtp(userId) {
    return request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async logout() {
    try { await request('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearSession();
  },

  async getMe() {
    return request('/auth/me');
  },

  // ── Instruments ──
  async getInstruments(segment) {
    const query = segment ? `?segment=${segment}` : '';
    return request(`/instruments${query}`);
  },

  async getInstrument(symbol) {
    return request(`/instruments/${symbol}`);
  },

  // ── Orders ──
  async placeOrder(orderData) {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async getOrders(status) {
    const query = status ? `?status=${status}` : '';
    return request(`/orders${query}`);
  },

  async cancelOrder(orderId) {
    return request(`/orders/${orderId}`, { method: 'DELETE' });
  },

  async modifyOrder(orderId, orderData) {
    return request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(orderData),
    });
  },

  // ── Positions ──
  async getPositions() {
    return request('/positions');
  },

  async closePosition(positionId, quantity) {
    return request(`/positions/${positionId}/close`, {
      method: 'POST',
      body: quantity !== undefined && quantity !== null ? JSON.stringify({ quantity }) : undefined
    });
  },

  async getTradeHistory(page = 1, limit = 20) {
    return request(`/positions/history?page=${page}&limit=${limit}`);
  },

  // ── Wallet ──
  async getWallet() {
    return request('/wallet');
  },

  async getTransactions(page = 1, limit = 20, type) {
    const params = `?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`;
    return request(`/wallet/transactions${params}`);
  },

  // ── Deposits ──
  async getPaymentMethods() {
    return request('/deposits/payment-methods');
  },

  async submitDeposit(amount, utr_number, screenshot_base64, payment_method_slot, method, metadata) {
    return request('/deposits', {
      method: 'POST',
      body: JSON.stringify({ amount, utr_number, screenshot_base64, payment_method_slot, method, metadata }),
    });
  },

  async getDeposits() {
    return request('/deposits');
  },

  // ── Withdrawals ──
  async submitWithdrawal(data) {
    return request('/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getWithdrawals() {
    return request('/withdrawals');
  },

  // ── Bank Accounts ──
  async getBankAccounts() {
    return request('/bank-accounts');
  },

  async addBankAccount(data) {
    return request('/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteBankAccount(id) {
    return request(`/bank-accounts/${id}`, {
      method: 'DELETE',
    });
  },

  // ── User Profile ──
  async updateProfile(updates) {
    return request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getWatchlist() {
    return request('/users/watchlist');
  },

  async saveWatchlist(watchlist) {
    return request('/users/watchlist', {
      method: 'PUT',
      body: JSON.stringify({ watchlist }),
    });
  },

  // ── Password ──
  async changePassword(currentPassword, newPassword) {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // ── Referrals ──
  async getReferrals() {
    return request('/auth/referrals');
  },

  // ── Notifications ──
  async getNotifications() {
    return request('/auth/notifications');
  },

  async markNotificationRead(notificationId) {
    return request('/auth/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notificationId }),
    });
  },

  async markAllNotificationsRead() {
    return request('/auth/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    });
  },

  // ── Push Notifications ──
  async getPushVapidPublicKey() {
    return request('/users/push-subscription/vapid-public-key');
  },
  async registerPushSubscription(subscription) {
    return request('/users/push-subscription', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  },
  async unregisterPushSubscription(endpoint) {
    return request('/users/push-subscription', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  },

  // ── KYC ──
  async submitKyc(kycPayload) {
    return request('/users/kyc', {
      method: 'POST',
      body: JSON.stringify(kycPayload),
    });
  },

  // ── Client Tickets ──
  async getClientTickets(status) {
    const params = status ? `?status=${status}` : '';
    return request(`/support/client-tickets${params}`);
  },
  async createClientTicket(category, description) {
    return request('/support/client-tickets', {
      method: 'POST',
      body: JSON.stringify({ category, description }),
    });
  },
};

// ══════════════════════════════════════════════════════════════
// Native WebSocket Price Feed (/ws/prices)
// ══════════════════════════════════════════════════════════════
let priceWs = null;
let staleCheckTimer = null;
let lastMessageTime = Date.now();
const subscribedSymbols = new Set();

export function connectPriceFeed(onPriceUpdate, onCandleUpdate = null, onDebugUpdate = null, symbols = []) {
  if (Array.isArray(symbols)) {
    symbols.forEach(s => subscribedSymbols.add(s));
  }

  if (priceWs && priceWs.readyState === WebSocket.OPEN) {
    const currentSymbols = Array.from(subscribedSymbols);
    if (currentSymbols.length > 0) {
      priceWs.send(JSON.stringify({ type: 'subscribe', symbols: currentSymbols }));
    }
    return;
  }

  // Generate WS URL dynamically
  const isSecure = window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';
  const apiBaseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000';
  const wsHost = apiBaseUrl.replace(/^https?:\/\//, '');
  const wsUrl = `${protocol}//${wsHost}/ws/prices`;

  console.log('🔌 Connecting to Native WebSocket Price Feed:', wsUrl);
  
  try {
    priceWs = new WebSocket(wsUrl);
  } catch (e) {
    console.error('Failed to create Native WebSocket:', e);
    return;
  }

  priceWs.onopen = () => {
    console.log('🔌 Native WebSocket connected');
    const currentSymbols = Array.from(subscribedSymbols);
    if (currentSymbols.length > 0) {
      console.log('🔌 Subscribing to symbols:', currentSymbols);
      priceWs.send(JSON.stringify({ type: 'subscribe', symbols: currentSymbols }));
    }
    if (onDebugUpdate) {
      onDebugUpdate({ connected: true, staleWarning: false });
    }
  };

  priceWs.onmessage = (event) => {
    lastMessageTime = Date.now();
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'ticks' && Array.isArray(payload.data)) {
        if (onDebugUpdate) {
          onDebugUpdate({ connected: true, staleWarning: false });
        }
        if (onPriceUpdate) {
          onPriceUpdate(payload.data);
        }
      }
    } catch (err) {
      console.error('Native WS message parsing error:', err.message);
    }
  };

  priceWs.onclose = (e) => {
    // If priceWs was set to null (explicitly disconnected), do not reconnect!
    if (!priceWs) return;

    console.log('🔌 Native WebSocket disconnected. Reconnecting in 3s...', e.reason);
    if (onDebugUpdate) {
      onDebugUpdate({ connected: false, staleWarning: false });
    }
    
    // Clean up current reference to trigger a new connection in reconnect
    const oldPriceWs = priceWs;
    const symbolsSnapshot = Array.from(subscribedSymbols); // capture symbols before any async gaps
    setTimeout(() => {
      if (priceWs === oldPriceWs) {
        // Bug #10: pass symbols explicitly so they are re-subscribed on reconnect
        connectPriceFeed(onPriceUpdate, onCandleUpdate, onDebugUpdate, symbolsSnapshot);
      }
    }, 3000);
  };

  priceWs.onerror = (err) => {
    console.error('Native WS error:', err);
  };

  // Stale feed detection
  if (staleCheckTimer) clearInterval(staleCheckTimer);
  staleCheckTimer = setInterval(() => {
    if (Date.now() - lastMessageTime > 15000) {
      if (onDebugUpdate) {
        onDebugUpdate({ connected: priceWs && priceWs.readyState === WebSocket.OPEN, staleWarning: true });
      }
    }
  }, 2000);
}

export function requestHistoricalCandles(symbol, timeframe) {
  // Not used in dabba app client price feed, candles loaded via REST if needed or stubbed
}

export function updatePositionSlTgtWs(positionId, stopLoss, target) {
  // SL/TGT updates go via REST API (safer than WS for mutations)
  request(`/positions/${positionId}/sl-tgt`, {
    method: 'PUT',
    body: JSON.stringify({ stop_loss: stopLoss, target }),
  }).catch(err => console.error('SL/TGT update failed:', err));
}

export function subscribeWsSymbols(symbols) {
  if (!Array.isArray(symbols)) return;
  
  const newSymbols = [];
  symbols.forEach(s => {
    if (!subscribedSymbols.has(s)) {
      subscribedSymbols.add(s);
      newSymbols.push(s);
    }
  });

  if (newSymbols.length > 0 && priceWs && priceWs.readyState === WebSocket.OPEN) {
    console.log('🔌 Native WS: Dynamically subscribing to symbols:', newSymbols);
    priceWs.send(JSON.stringify({ type: 'subscribe', symbols: newSymbols }));
  }
}

export function debugSubscribeWs() {
  // Not needed on native WS
}

export function disconnectPriceFeed() {
  if (staleCheckTimer) clearInterval(staleCheckTimer);
  if (priceWs) {
    try { priceWs.close(); } catch (e) {}
    priceWs = null;
  }
  subscribedSymbols.clear();
  disconnectUserSocket();
}

// ══════════════════════════════════════════════════════════════
// Socket.IO User Events (/user namespace)
// Private channel for: order fills, PNL updates, notifications
// ══════════════════════════════════════════════════════════════
let userSocket = null;
let _onOrderFilled = null;
let _onPnlUpdate = null;
let _onBroadcast = null;
let _onConnect = null;
let _onDisconnect = null;

/**
 * Connect to the /user namespace for private realtime events.
 * Call this after login with the user's ID.
 */
export function connectUserSocket(userId, { onOrderFilled, onPnlUpdate, onBroadcast, onConnect, onDisconnect } = {}) {
  if (userSocket && userSocket.connected) {
    _onOrderFilled = onOrderFilled;
    _onPnlUpdate = onPnlUpdate;
    _onBroadcast = onBroadcast;
    _onConnect = onConnect;
    _onDisconnect = onDisconnect;
    if (onConnect) onConnect();
    return;
  }

  if (userSocket) {
    try { userSocket.disconnect(); } catch (e) {}
    userSocket = null;
  }

  _onOrderFilled = onOrderFilled;
  _onPnlUpdate = onPnlUpdate;
  _onBroadcast = onBroadcast;
  _onConnect = onConnect;
  _onDisconnect = onDisconnect;

  const API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000';

  userSocket = io(`${API_URL}/user`, {
    transports: ['websocket'],
    auth: (cb) => {
      cb({
        token: getToken()
      });
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  userSocket.on('connect', () => {
    console.log('🔐 Socket.IO User channel connected');
    // Join private room
    userSocket.emit('USER:JOIN_PRIVATE', userId);
    if (_onConnect) _onConnect();
  });

  // ── Order filled notification from BullMQ worker ──
  userSocket.on('USER:ORDER_FILLED', (data) => {
    console.log('✅ Order filled via Socket.IO:', data);
    if (_onOrderFilled) _onOrderFilled(data);
  });

  // ── Realtime PNL updates from MTM calculator ──
  userSocket.on('USER:PNL_UPDATE', (data) => {
    if (_onPnlUpdate) _onPnlUpdate(data);
  });

  // ── Admin broadcast / system announcement ──
  userSocket.on('SYSTEM:BROADCAST', (data) => {
    console.log('📢 Admin broadcast received:', data.title);
    if (_onBroadcast) _onBroadcast(data);
  });

  userSocket.on('disconnect', (reason) => {
    console.log('🔐 User channel disconnected:', reason);
    if (_onDisconnect) _onDisconnect();
  });

  userSocket.on('connect_error', async (error) => {
    console.error('Socket.IO User Error:', error);
    if (error.message && (error.message.includes('Authentication error') || error.message.includes('token'))) {
      console.log('🔄 Socket.IO Auth error. Attempting to refresh token...');
      const refreshed = await tryRefreshToken();
      if (refreshed && userSocket) {
        console.log('🔄 Token refreshed. Retrying Socket.IO connection...');
        userSocket.connect();
      }
    }
  });
}

export function disconnectUserSocket() {
  if (userSocket) {
    userSocket.disconnect();
    userSocket = null;
  }
  _onOrderFilled = null;
  _onPnlUpdate = null;
  _onBroadcast = null;
  _onConnect = null;
  _onDisconnect = null;
}

// ── Auth helpers ──
function getToken() {
  return localStorage.getItem('tradex_access_token');
}

export function isLoggedIn() {
  return !!getToken();
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('tradex_user')); } catch { return null; }
}
