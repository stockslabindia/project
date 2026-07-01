import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, ClipboardList, Layers, Wallet, BarChart3,
  Headphones, User, Clock, Star, LogOut, Download,
} from 'lucide-react';
import { useTradeStore } from '../../store/useTradeStore';
import { cn } from '../../utils/helpers';

const menuSections = [
  {
    items: [
      { path: '/', icon: LayoutGrid, label: 'Dashboard' },
      { path: '/orders', icon: ClipboardList, label: 'Orders' },
      { path: '/positions', icon: Layers, label: 'Portfolio' },
      { path: '/wallet', icon: Wallet, label: 'Funds' },
      { path: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { path: '/profile', icon: User, label: 'Profile' },
      { path: '/reports', icon: Clock, label: 'Reports' },
      { path: '/referral', icon: Star, label: 'Referral' },
    ],
  },
];

export default function SideDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useTradeStore();

  if (!isOpen) return null;

  const userName = user?.name || user?.full_name || user?.email?.split('@')[0] || 'Trader';
  const userInitial = userName.charAt(0).toUpperCase();

  const handleNav = (path) => { navigate(path, { replace: true }); onClose(); };
  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); onClose(); };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[200] animate-fadeIn" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-surface-2 z-[201] flex flex-col animate-slideRight shadow-2xl shadow-black/40">
        {/* Header — Logo — safe-top keeps it below the iPhone notch */}
        <div className="px-5 pt-6 pb-4 safe-top">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <div>
              <span className="text-lg font-black text-blue-500 tracking-tight">STOCKS LAB</span>
              <p className="text-[10px] text-text-muted -mt-0.5">www.stockslab.live</p>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="px-5 py-4 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-3 ring-4 ring-cyan-500/20">
            <span className="text-white text-2xl font-bold">{userInitial}</span>
          </div>
          <p className="text-base font-bold text-text-primary">{userName}</p>
          <span className="mt-1.5 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30 rounded-full bg-emerald-500/10">
            Active
          </span>
        </div>

        <div className="mx-5 h-px bg-border my-1" />

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {menuSections.map((section, si) => (
            <div key={si} className="mb-2">
              {section.title && (
                <p className="px-3 py-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">{section.title}</p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <button key={item.label} onClick={() => handleNav(item.path)}
                    className={cn('w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors mb-0.5',
                      active ? 'bg-blue-600/15 text-blue-400' : 'text-text-muted hover:bg-surface-3 hover:text-text-primary')}>
                    <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}

          <button onClick={() => handleNav('/help')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors">
            <Headphones size={18} strokeWidth={1.8} /> Support
          </button>

          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors mt-1">
            <LogOut size={18} strokeWidth={1.8} /> Logout
          </button>

          <div className="mx-2 h-px bg-border my-3" />

          <p className="px-3 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">MOBILE APP</p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-pwa-install-prompt'));
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
          >
            <Download size={18} strokeWidth={1.8} /> Download App
          </button>
        </div>

        {/* Footer — safe-bottom keeps text above home indicator on iPhone */}
        <div className="px-5 py-4 border-t border-border safe-bottom">
          <p className="text-[11px] text-text-muted text-center">
            Stocks Lab Trading Platform • <span className="text-blue-400 font-semibold">v1.0.0</span>
          </p>
        </div>
      </div>
    </>
  );
}
