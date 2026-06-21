import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  ArrowRightLeft, 
  ListOrdered, 
  Activity, 
  Settings, 
  Search,
  Bell,
  AlertTriangle,
  Clock,
  ScanFace,
  BadgeCheck,
  UserX,
  ArrowDownToLine,
  CheckCircle2, 
  UserCog,
  FileText,
  Landmark,
  Layers,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Share2,
  Banknote,
  Radio,
  Sun,
  Moon,
  Mail,
  Headphones,
  ToggleRight,
} from 'lucide-react';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Department access keys:
// 'all'              → visible to every department
// 'admin'            → Admin Panel only
// 'finance'          → Finance Department only
// 'customer_service' → Customer Service only
// Array              → multiple departments

const navigation = [
  // ── Core ──
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, dept: 'all' },

  // ── Admin-Only: Risk & Trading ──
  { name: 'Dealing Desk', href: '/dealing-desk', icon: Layers, dept: 'admin' },
  { name: 'Risk Management', href: '/risk', icon: ShieldAlert, dept: 'admin' },
  { name: 'Trading Limits', href: '/trading-limits', icon: ShieldAlert, dept: 'admin' },
  { name: 'Square-Off Panel', href: '/square-off', icon: AlertTriangle, dept: 'admin' },
  { name: 'House Book', href: '/house-book', icon: Landmark, dept: 'admin' },

  // ── Finance: P&L, Wallets, Settlements ──
  { name: 'Wallets', href: '/wallets', icon: Wallet, dept: ['admin', 'finance'] },
  { name: 'Deposits', href: '/deposits', icon: ArrowDownToLine, dept: ['admin', 'finance'] },
  { name: 'Withdrawals', href: '/withdrawals', icon: BadgeCheck, dept: ['admin', 'finance'] },
  { name: 'EOD / Settlement', href: '/eod-settlement', icon: CheckCircle2, dept: ['admin', 'finance'] },

  // ── Customer Service: Clients, KYC, Support ──
  { name: 'Users', href: '/users', icon: Users, dept: ['admin', 'customer_service'] },
  { name: 'KYC Verification', href: '/kyc', icon: ScanFace, dept: ['admin', 'customer_service'] },
  { name: 'Client Restrictions', href: '/client-restrictions', icon: UserX, dept: ['admin', 'customer_service'] },
  { name: 'Customer Service', href: '/customer-service', icon: Headphones, dept: ['admin', 'customer_service'] },
  { name: 'Agent Control', href: '/agent-control', icon: ToggleRight, dept: 'admin' },

  // ── Shared: Trading Data ──
  { name: 'Trades', href: '/trades', icon: ArrowRightLeft, dept: ['admin', 'finance'] },
  { name: 'Orders', href: '/orders', icon: ListOrdered, dept: ['admin', 'finance'] },

  // ── Admin-Only: System Controls ──
  { name: 'Instruments', href: '/instruments', icon: Activity, dept: 'admin' },
  { name: 'Live Feed Status', href: '/feed-status', icon: Radio, dept: 'admin' },
  { name: 'Market Control', href: '/market-control', icon: Clock, dept: 'admin' },
  { name: 'Referral & Affiliates', href: '/affiliates', icon: Share2, dept: 'admin' },
  { name: 'Affiliate Payouts', href: '/affiliate-payouts', icon: Banknote, dept: ['admin', 'finance'] },
  { name: 'Admin Users', href: '/admin-users', icon: UserCog, dept: 'admin' },
  { name: 'Email Center', href: '/emails', icon: Mail, dept: 'admin' },
  { name: 'Audit Logs', href: '/logs', icon: FileText, dept: 'admin' },
  { name: 'System Config', href: '/settings', icon: Settings, dept: 'admin' },
];

// Department branding config
const DEPT_CONFIG = {
  admin: {
    label: 'Admin',
    accentFrom: 'from-blue-500',
    accentTo: 'to-blue-700',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-700',
    dotColor: 'bg-blue-600',
  },
  finance: {
    label: 'Finance',
    accentFrom: 'from-emerald-500',
    accentTo: 'to-emerald-700',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-700',
    dotColor: 'bg-emerald-600',
  },
  customer_service: {
    label: 'Support',
    accentFrom: 'from-purple-500',
    accentTo: 'to-purple-700',
    activeBg: 'bg-purple-50',
    activeText: 'text-purple-700',
    dotColor: 'bg-purple-600',
  },
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCustomerService = location.pathname === '/customer-service';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      }
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
      localStorage.setItem('admin_theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
      localStorage.setItem('admin_theme', 'dark');
    }
  };

  const dept = user?.department || 'admin';
  const deptCfg = DEPT_CONFIG[dept] || DEPT_CONFIG.admin;

  // Filter navigation items by department
  const filteredNav = navigation.filter((item) => {
    if (item.dept === 'all') return true;
    if (Array.isArray(item.dept)) return item.dept.includes(dept);
    return item.dept === dept;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-20 bg-gray-900/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 z-30 transition-transform duration-200 ease-in-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            Stocks <span className={deptCfg.activeText}>Lab</span>
          </span>
          <span className={`text-xs font-bold px-2 py-1 rounded-full bg-gradient-to-r ${deptCfg.accentFrom} ${deptCfg.accentTo} text-white`}>
            {deptCfg.label}
          </span>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-500 lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? `${deptCfg.activeBg} ${deptCfg.activeText}`
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'mr-3 flex-shrink-0 h-5 w-5 transition-colors',
                        isActive ? deptCfg.activeText : 'text-gray-400 group-hover:text-gray-500'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-10 flex-shrink-0">
          <div className="h-full px-4 sm:px-8 flex items-center justify-between">
            {/* Hamburger (Mobile) */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 mr-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Search */}
            <div className="flex-1 min-w-0 max-w-md hidden sm:block">
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  type="search"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search across admin..."
                />
              </div>
            </div>

            {/* Profile & Notifications */}
            <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
              <div className="relative hidden sm:block">
                <button className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none relative group">
                  <span className="sr-only">View notifications</span>
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
                  
                  {/* Notification Dropdown (Hover) */}
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 border border-gray-200 hidden group-hover:block z-50">
                    <div className="px-4 py-2 border-b border-gray-100 font-medium text-gray-900">Risk Alerts</div>
                    <div className="px-4 py-3 hover:bg-gray-50 border-b border-gray-50">
                      <p className="text-sm font-medium text-red-600">Unusual Activity Detected</p>
                      <p className="text-xs text-gray-500 mt-1">User TDX-82491 initiated 5 large withdrawals in 10 mins.</p>
                    </div>
                    <div className="px-4 py-3 hover:bg-gray-50 border-b border-gray-50">
                      <p className="text-sm font-medium text-orange-600">Margin Warning</p>
                      <p className="text-xs text-gray-500 mt-1">15 users approaching 80% margin threshold.</p>
                    </div>
                  </div>
                </button>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Theme Toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Toggle Theme"
                >
                  {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
                </button>

                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">{user?.name || 'Admin'}</div>
                  <div className="text-xs text-gray-500">{user?.role || 'Unknown'}</div>
                </div>
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${deptCfg.accentFrom} ${deptCfg.accentTo} flex items-center justify-center text-white text-xs font-bold`}>
                  {user?.avatar || 'A'}
                </div>
                <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Logout">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={cn(
          "flex-1",
          isCustomerService ? "overflow-hidden h-full" : "overflow-y-auto"
        )}>
          <div className={cn(
            "h-full",
            isCustomerService ? "p-0 overflow-hidden" : "p-4 sm:px-8 sm:py-8"
          )}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
