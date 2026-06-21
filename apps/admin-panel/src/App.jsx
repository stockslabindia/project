import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Wallets from './pages/Wallets';
import Trades from './pages/Trades';
import Orders from './pages/Orders';
import Instruments from './pages/Instruments';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import DealingDesk from './pages/DealingDesk';
import RiskManagement from './pages/RiskManagement';
import KYCManagement from './pages/KYCManagement';
import WithdrawalApprovals from './pages/WithdrawalApprovals';
import DepositApprovals from './pages/DepositApprovals';
import MarketControl from './pages/MarketControl';
import SquareOffPanel from './pages/SquareOffPanel';
import EODSettlement from './pages/EODSettlement';
import AdminUsers from './pages/AdminUsers';
import HouseBook from './pages/HouseBook';
import ClientRestrictions from './pages/ClientRestrictions';
import TradingLimits from './pages/TradingLimits';
import AffiliateManagement from './pages/AffiliateManagement';
import AffiliatePayout from './pages/AffiliatePayout';
import FeedStatus from './pages/FeedStatus';
import Emails from './pages/Emails';
import CustomerService from './pages/CustomerService';
import AgentControl from './pages/AgentControl';


import OfflineBanner from './components/pwa/OfflineBanner';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <AdminLogin />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <PWAInstallPrompt />
        <PWAUpdatePrompt />
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected admin routes */}
          <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="dealing-desk" element={<DealingDesk />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="wallets" element={<Wallets />} />
            <Route path="trades" element={<Trades />} />
            <Route path="orders" element={<Orders />} />
            <Route path="instruments" element={<Instruments />} />
            <Route path="feed-status" element={<FeedStatus />} />
            <Route path="settings" element={<Settings />} />
            <Route path="logs" element={<Logs />} />
            <Route path="risk" element={<RiskManagement />} />
            <Route path="trading-limits" element={<TradingLimits />} />
            <Route path="client-restrictions" element={<ClientRestrictions />} />
            <Route path="kyc" element={<KYCManagement />} />
            <Route path="withdrawals" element={<WithdrawalApprovals />} />
            <Route path="deposits" element={<DepositApprovals />} />
            <Route path="market-control" element={<MarketControl />} />
            <Route path="square-off" element={<SquareOffPanel />} />
            <Route path="eod-settlement" element={<EODSettlement />} />
            <Route path="admin-users" element={<AdminUsers />} />
            <Route path="house-book" element={<HouseBook />} />
            <Route path="affiliates" element={<AffiliateManagement />} />
            <Route path="affiliate-payouts" element={<AffiliatePayout />} />
            <Route path="emails" element={<Emails />} />
            <Route path="customer-service" element={<CustomerService />} />
            <Route path="agent-control" element={<AgentControl />} />

          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
