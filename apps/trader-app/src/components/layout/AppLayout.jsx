import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Layers, CandlestickChart, ClipboardList, User, LogOut,
  Moon, Sun, Wallet, FileText, Headphones, Settings,
  CheckCircle, AlertCircle, AlertTriangle, Info, X, WifiOff,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from './BottomNav';
import WatchlistSidebar from './WatchlistSidebar';
import MarketTickerBar from './MarketTickerBar';
import AcknowledgmentModal from '../ui/AcknowledgmentModal';
import SystemBanner from './SystemBanner';
import { useTradeStore } from '../../store/useTradeStore';
import { api } from '../../services/api';
import { cn } from '../../utils/helpers';
import { useExitPrompt } from '../../hooks/useExitPrompt';

const desktopNavItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/orders', icon: ClipboardList, label: 'Orders' },
  { path: '/positions', icon: Layers, label: 'Portfolio' },
  { path: '/charts', icon: CandlestickChart, label: 'Charts' },
  { path: '/wallet', icon: Wallet, label: 'Funds' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/help', icon: Headphones, label: 'Support' },
];

export default function AppLayout() {
  const user = useTradeStore((s) => s.user);
  const logout = useTradeStore((s) => s.logout);
  const marginCallWarning = useTradeStore((s) => s.marginCallWarning);
  const socketConnected = useTradeStore((s) => s.socketConnected);
  const toasts = useTradeStore((s) => s.toasts || []);
  const removeToast = useTradeStore((s) => s.removeToast);
  const navigate = useNavigate();
  const location = useLocation();
  const isSupportChat = location.pathname === '/support-chat';
  const isCharts = location.pathname === '/charts';

  // Guard against accidental app exit via hardware back button
  useExitPrompt(logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [isDark, setIsDark] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isWatchlistExpanded, setIsWatchlistExpanded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, []);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
  };

  const isFullscreenPage = isSupportChat || isCharts;

  return (
    <div className={cn("bg-surface flex flex-col", isFullscreenPage ? "h-screen overflow-hidden" : "min-h-screen")}>
      {marginCallWarning && (
        <div className="bg-gradient-to-r from-red-500/90 via-amber-500/90 to-red-500/90 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-2 border-b border-red-500/30 backdrop-blur-sm animate-pulse w-full">
          <div className="flex items-center gap-2 max-w-lg lg:max-w-none mx-auto w-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="tracking-wide text-[11px] sm:text-xs">
              <strong>Margin Call Warning!</strong> Margin Level: <span className="font-mono text-white underline decoration-wavy">{marginCallWarning.marginLevel.toFixed(1)}%</span>. Equity: ₹{marginCallWarning.equity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.
            </span>
            <button 
              onClick={() => navigate('/wallet')} 
              className="bg-white/20 hover:bg-white/30 text-white text-[10px] uppercase font-extrabold px-2.5 py-1 rounded transition-all tracking-wider flex-shrink-0 ml-auto"
            >
              Deposit
            </button>
          </div>
        </div>
      )}
      {/* ═══ DESKTOP: Market Ticker Bar + Top Navbar ═══ */}
      <div className="hidden lg:block sticky top-0 z-50 bg-surface shadow-sm border-b border-border/60">
        <div className="flex items-center h-14 w-full">
          {/* Left Side: Logo or Ticker space */}
          <div className="w-[320px] shrink-0 border-r border-border/40 flex items-center px-4">
             {/* We can place the ticker here or just a logo */}
             <div className="text-xl font-bold tracking-tighter text-primary">STOCKS LAB</div>
          </div>

          {/* Right Side: Navigation */}
          <header className="flex-1 flex items-center justify-between px-6 h-full">
            {/* Nav Items */}
            <nav className="flex items-center gap-6">
              {desktopNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    'text-[14px] font-medium transition-colors hover:text-[#f06428]',
                    isActive ? 'text-[#f06428]' : 'text-text-secondary'
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right Side — User Controls */}
            <div className="flex items-center gap-4">
              {/* Connection Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-2 border border-border/40 shadow-sm select-none">
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    socketConnected ? "bg-emerald-500" : "bg-red-500"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    socketConnected ? "bg-emerald-500" : "bg-red-500"
                  )}></span>
                </span>
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-text-secondary">
                  {socketConnected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleDarkMode}
                className="text-text-secondary hover:text-[#f06428] transition-colors"
                title="Toggle Theme"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-[#f06428] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span>{user?.clientId || 'GZ5936'}</span>
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border/60 rounded shadow-xl z-50 py-1 overflow-hidden">
                      <div className="px-4 py-3 border-b border-border/40">
                        <p className="text-sm font-semibold text-text-primary">{user?.name || 'Trader'}</p>
                        <p className="text-xs text-text-muted mt-0.5">{user?.email || 'trader@example.com'}</p>
                      </div>

                      <button
                        onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-[#f06428] transition-colors"
                      >
                        <User size={16} strokeWidth={1.5} /> My Profile
                      </button>
                      <button
                        onClick={() => { navigate('/preferences'); setShowProfileMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-[#f06428] transition-colors"
                      >
                        <Settings size={16} strokeWidth={1.5} /> Preferences
                      </button>

                      <div className="border-t border-border/40 mt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-red-500 transition-colors"
                        >
                          <LogOut size={16} strokeWidth={1.5} /> Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
        </div>
      </div>

      {/* ═══ SYSTEM BROADCAST BANNER ═══ */}
      <SystemBanner />

      {/* ═══ MAIN AREA: Sidebar + Content ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Left Sidebar — Watchlist (normal or expanded) */}
        <WatchlistSidebar
          isExpanded={isWatchlistExpanded}
          onToggleExpand={() => setIsWatchlistExpanded(!isWatchlistExpanded)}
        />

        {/* Main Content Area — hidden on desktop when watchlist is expanded */}
        {!isWatchlistExpanded && (
          <main className={cn(
            "flex-1 w-full max-w-lg lg:max-w-none bg-surface",
            (isSupportChat || isCharts) ? "flex flex-col overflow-hidden h-full pb-0" : "overflow-y-auto pb-16 lg:pb-0"
          )}>
            <Outlet />
          </main>
        )}

        {/* Mobile always gets Outlet even if expanded (sidebar hidden on mobile) */}
        {isWatchlistExpanded && (
          <main className={cn(
            "flex-1 w-full max-w-lg bg-surface lg:hidden",
            (isSupportChat || isCharts) ? "flex flex-col overflow-hidden h-full pb-0" : "overflow-y-auto pb-16"
          )}>
            <Outlet />
          </main>
        )}
      </div>

      {/* ═══ MOBILE: Bottom Navigation ═══ */}
      <div className={cn("lg:hidden", isSupportChat && "hidden")}>
        <BottomNav />
      </div>

      {/* ═══ LIVE TOAST NOTIFICATIONS ═══ */}
      <div className="fixed bottom-20 right-4 lg:bottom-4 lg:right-4 z-[999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className="pointer-events-auto w-full bg-surface-2 border border-border/80 rounded-xl p-4 shadow-xl flex gap-3 relative overflow-hidden backdrop-blur-md"
            >
              {toast.type === 'success' && (
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle size={20} strokeWidth={2} />
                </div>
              )}
              {toast.type === 'warning' && (
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} strokeWidth={2} />
                </div>
              )}
              {toast.type === 'error' && (
                <div className="w-10 h-10 rounded-full bg-danger/10 border border-danger/20 text-danger flex items-center justify-center shrink-0">
                  <AlertCircle size={20} strokeWidth={2} />
                </div>
              )}
              {toast.type === 'info' && (
                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                  <Info size={20} strokeWidth={2} />
                </div>
              )}
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="text-sm font-bold text-text-primary">{toast.title}</h4>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="absolute top-2 right-2 text-text-muted hover:text-text-primary transition-colors p-1"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ═══ OFFLINE SAFEGUARD OVERLAY ═══ */}
      {isOffline && (
        <div className="fixed inset-0 z-[9999] bg-background/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
          <div className="max-w-md bg-surface-2 border border-border/80 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center text-danger border border-danger/20 animate-bounce">
              <WifiOff size={32} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">You are offline</h2>
              <p className="text-sm text-text-muted mt-2 leading-relaxed">
                Your internet connection has been lost. Trading controls and price streams have been disabled to protect your orders.
              </p>
            </div>
            <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden relative">
              <div className="h-full bg-danger animate-pulse w-1/3 rounded-full absolute left-0" style={{ animationDuration: '1.5s', animationIterationCount: 'infinite' }}></div>
            </div>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">
              Attempting to reconnect...
            </span>
          </div>
        </div>
      )}

      {/* ═══ Risk Acknowledgment Modal ═══ */}
      <AcknowledgmentModal />
    </div>
  );
}
