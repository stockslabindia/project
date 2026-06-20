// ══════════════════════════════════════════════════════════════
// Stocks Lab Admin Panel — API Service Layer
// Connects to Express backend at localhost:4000
// ══════════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('admin_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const adminApi = {
  // CRM
  getLeads: () => request('/admin/crm/leads'),
  updateLead: (id, data) => request(`/admin/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getClientTiers: () => request('/admin/crm/client-tiers'),
  getApiKeys: () => request('/admin/crm/api-keys'),
  getNetworkNodes: () => request('/admin/crm/network-nodes'),
  getCorporateActions: () => request('/admin/crm/corporate-actions'),
  getNotificationTemplates: () => request('/admin/crm/notification-templates'),

  // ── CRM & Config ──
  getCrmModule: (module) => request(`/admin/crm/${module}`),
  updateCrmModule: (module, id, data) => request(`/admin/crm/${module}/${id}`, {
    method: id === 'new' ? 'POST' : 'PUT',
    body: JSON.stringify(data)
  }),
  deleteCrmModule: (module, id) => request(`/admin/crm/${module}/${id}`, {
    method: 'DELETE'
  }),

  // ── Dynamic & Risk Modules ──
  calculateBrokerage: (data) => request('/admin/calculate-brokerage', {
    method: 'POST', body: JSON.stringify(data)
  }),
  executeBulkAction: (data) => request('/admin/bulk-execute', {
    method: 'POST', body: JSON.stringify(data)
  }),
  getRiskHeatmap: () => request('/admin/risk/heatmap'),
  getHouseBook: () => request('/admin/risk/house-book'),
  getDealingDeskOrderBook: (symbol, price) => request(`/admin/dealing-desk/orderbook?symbol=${symbol}&price=${price}`),
  hedgePosition: (data) => request('/admin/risk/hedge', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // ── Analytics ──
  getChurnPrediction: () => request('/admin/analytics/churn'),
  getProfitAttribution: () => request('/admin/analytics/profit'),

  // ── EOD Settlement ──
  runEodSettlement: () => request('/admin/eod/run', { method: 'POST' }),
  getEodReports: () => request('/admin/eod/reports'),

  // ── Dashboard ──
  getDashboard: () => request('/admin/dashboard'),

  // ── Users ──
  getUsers: (page = 1, limit = 25, search = '') =>
    request(`/admin/users?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),
  getUser: (id) => request(`/admin/users/${id}`),
  updateUserStatus: (id, status) => request(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getUserTradingLimits: (id) => request(`/admin/users/${id}/trading-limits`),
  setUserTradingLimits: (id, data) => request(`/admin/users/${id}/trading-limits`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUserTradingLimits: (id) => request(`/admin/users/${id}/trading-limits`, { method: 'DELETE' }),
  getUserOrders: (userId, status = '') => request(`/admin/orders?user_id=${userId}${status ? `&status=${status}` : ''}`),
  getUserTrades: (userId) => request(`/admin/trades?user_id=${userId}`),
  getUserWalletLedger: (clientId) => request(`/admin/ledger/${clientId}`),
  getUserWalletTransactions: (userId) => request(`/admin/wallet-transactions?user_id=${userId}`),
  resetUserPassword: (userId) => request(`/admin/users/${userId}/reset-password`, { method: 'POST' }),
  revokeUserSessions: (userId) => request(`/admin/users/${userId}/revoke-sessions`, { method: 'POST' }),

  // ── Wallets & Transactions ──
  getWalletTransactions: () => request('/admin/wallet-transactions'),
  adjustWallet: (data) => request('/admin/wallets/adjust', { method: 'POST', body: JSON.stringify(data) }),

  // ── Deposits ──
  getDeposits: (status = 'pending') => request(`/admin/deposits?status=${status}`),
  approveDeposit: (id) => request(`/admin/deposits/${id}/approve`, { method: 'POST' }),
  rejectDeposit: (id, reason) => request(`/admin/deposits/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getPaymentMethods: () => request('/admin/payment-methods'),
  updatePaymentMethod: (slot, data) => request(`/admin/payment-methods/${slot}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── Withdrawals ──
  getWithdrawals: (status = 'pending') => request(`/admin/withdrawals?status=${status}`),
  approveWithdrawal: (id) => request(`/admin/withdrawals/${id}/approve`, { method: 'POST' }),
  rejectWithdrawal: (id, reason) => request(`/admin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // ── Orders & Trades ──
  getOrders: (status = 'open') => request(`/admin/orders?status=${status}`),
  modifyAdminOrder: (id, price, quantity, note) => request(`/admin/orders/${id}`, { method: 'PUT', body: JSON.stringify({ price, quantity, note }) }),
  cancelAdminOrder: (id, note) => request(`/admin/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ note }) }),
  getTrades: () => request('/admin/trades'),
  modifyTrade: (id, data) => request(`/admin/trades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTrade: (id, note) => request(`/admin/trades/${id}`, { method: 'DELETE', body: JSON.stringify({ note }) }),

  // ── Force Actions ──
  forceSquareOff: (userId, reason) => request(`/admin/force-square-off/${userId}`, { method: 'POST', body: JSON.stringify({ reason }) }),
  forceSquareOffPositions: (positionIds, reason) => request('/admin/force-square-off-positions', { method: 'POST', body: JSON.stringify({ positionIds, reason }) }),
  globalSquareOff: () => request('/admin/global-square-off', { method: 'POST' }),

  // ── Audit Logs ──
  getAuditLogs: () => request('/admin/audit-logs'),

  // ── Settings ──
  getSettings: () => request('/admin/settings'),
  updateSetting: (key, value) => request(`/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

  // ── Instruments ──
  getInstruments: () => request('/admin/instruments'),
  updateInstrument: (id, data) => request(`/admin/instruments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── KYC ──
  getKycDocuments: (status = 'pending') => request(`/admin/kyc?status=${status}`),
  verifyKyc: (id) => request(`/admin/kyc/${id}/verify`, { method: 'POST' }),
  rejectKyc: (id, reason) => request(`/admin/kyc/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // ── Support Tickets ──
  getTickets: () => request('/admin/tickets'),
  replyToTicket: (id, message, status) => request(`/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message, status }) }),

  // ── Notifications / Broadcast ──
  getNotifications: () => request('/admin/notifications'),
  sendBroadcast: (data) => request('/admin/notifications', { method: 'POST', body: JSON.stringify(data) }),

  // ── Surveillance / Alerts ──
  getAlerts: () => request('/admin/crm/system-alerts').then(res => ({ alerts: res.system_alerts || [] })),
  resolveAlert: (id) => request(`/admin/crm/system-alerts/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'resolved' }) }),

  // ── Risk Management ──
  getRiskManagement: () => request('/admin/risk-management'),
  toggleSymbol: (symbol, disable) => request(`/admin/risk-management/symbols/${symbol}/toggle`, { method: 'POST', body: JSON.stringify({ disable }) }),
  toggleKillSwitch: (activate) => request('/admin/risk-management/kill-switch', { method: 'POST', body: JSON.stringify({ activate }) }),
  forceMarginCheck: () => request('/admin/risk/margin-check', { method: 'POST' }),

  // ── Exposure Heatmap ──
  getExposureHeatmap: () => request('/admin/exposure-heatmap'),

  // ── Queue Monitoring ──
  getQueueStats: () => request('/admin/queue/stats'),
  retryFailedJob: (jobId) => request(`/admin/queue/retry/${jobId}`, { method: 'POST' }),

  // ── Feedback ──
  getFeedback: () => request('/admin/feedback'),

  // ── Analytics ──
  getTraderAnalytics: () => request('/admin/analytics/trader-behavior'),

  // ── Profit Ceiling ──
  getProfitCeiling: () => request('/admin/profit-ceiling'),

  // ── PnL Statement ──
  getPnLStatement: () => request('/admin/pnl-statement'),

  // ── Margin Calls ──
  getMarginCalls: () => request('/admin/margin-calls'),

  // ── Open Positions ──
  getOpenPositions: () => request('/admin/open-positions'),

  // ── Client Ledger ──
  getClientLedger: (clientId) => request(`/admin/ledger/${clientId}`),

  // ── System Health ──
  getSystemHealth: () => request('/admin/system-health'),

  // ── Referrals ──
  getReferralStats: () => request('/admin/referrals/stats'),

  // ── Live Feed Status & Control ──
  getFeedStatus: () => request('/admin/feed-status'),
  resetFyersFeed: () => request('/admin/feed/fyers/reset', { method: 'POST' }),
  getAnimatorSettings: () => request('/admin/animator-settings'),
  updateAnimatorSetting: (segment, enabled) => request('/admin/animator-settings', {
    method: 'POST',
    body: JSON.stringify({ segment, enabled })
  }),

  // ── Email Center ──
  sendBulkEmail: (data) => request('/admin/emails/send-bulk', { method: 'POST', body: JSON.stringify(data) }),
  getEmailLogs: (queryString = '') => request(`/admin/emails/logs?limit=200${queryString}`),
  getEmailCampaigns: () => request('/admin/emails/campaigns'),
};
