import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTradeStore } from './store/useTradeStore';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login/Login';
import OfflineBanner from './components/pwa/OfflineBanner';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt';
import { useEffect, lazy, Suspense } from 'react';

// ── Lazy-load ALL page components for aggressive code splitting ──
// Only the Login page and Markets page (default route) load eagerly.
// Everything else is loaded on-demand when the user navigates to it.
const Home = lazy(() => import('./pages/Home/Home'));
const Positions = lazy(() => import('./pages/Positions/Positions'));
const Charts = lazy(() => import('./pages/Charts/Charts'));
const Orders = lazy(() => import('./pages/Orders/Orders'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const Wallet = lazy(() => import('./pages/Wallet/Wallet'));
const Notifications = lazy(() => import('./pages/Notifications/Notifications'));
const Referral = lazy(() => import('./pages/Referral/Referral'));
const Reports = lazy(() => import('./pages/Reports/Reports'));
const Security = lazy(() => import('./pages/Security/Security'));
const Help = lazy(() => import('./pages/Help/Help'));
const Preferences = lazy(() => import('./pages/Preferences/Preferences'));
const History = lazy(() => import('./pages/History/History'));
const Markets = lazy(() => import('./pages/Markets/Markets'));
const Trade = lazy(() => import('./pages/Trade/Trade'));
const BankAccounts = lazy(() => import('./pages/BankAccounts/BankAccounts'));
const SupportChat = lazy(() => import('./pages/Help/SupportChat'));
const ClientTickets = lazy(() => import('./pages/Help/ClientTickets'));


// ── Minimal loading spinner for Suspense fallback ──
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useTradeStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppInitializer({ children }) {
  const isAuthenticated = useTradeStore((s) => s.isAuthenticated);
  const loadInitialData = useTradeStore((s) => s.loadInitialData);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      <AppInitializer>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* All protected routes inside AppLayout */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Markets />} />
              <Route path="/dashboard" element={<Home />} />
              <Route path="/positions" element={<Positions />} />
              <Route path="/charts" element={<Charts />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/history" element={<History />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/bank-accounts" element={<BankAccounts />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/security" element={<Security />} />
              <Route path="/help" element={<Help />} />
              <Route path="/support-chat" element={<SupportChat />} />
              <Route path="/client-tickets" element={<ClientTickets />} />
              <Route path="/preferences" element={<Preferences />} />

              <Route path="/markets" element={<Markets />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppInitializer>
    </BrowserRouter>
  );
}
