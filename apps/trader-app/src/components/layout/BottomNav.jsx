import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, CandlestickChart, Layers, Wallet, ClipboardList, User } from 'lucide-react';
import { cn } from '../../utils/helpers';

const navItems = [
  { path: '/', icon: BarChart3, label: 'Market' },
  { path: '/charts', icon: CandlestickChart, label: 'Charts' },
  { path: '/positions', icon: Layers, label: 'Positions' },
  { path: '/orders', icon: ClipboardList, label: 'Orders' },
  { path: '/wallet', icon: Wallet, label: 'Funds' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-2 border-t border-border z-40 bottom-nav">
      <div className="max-w-lg mx-auto flex items-center justify-around px-0.5 pt-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/markets');

          return (
            <NavLink
              key={item.path}
              to={item.path}
              replace
              className="flex flex-col items-center justify-center w-14 py-2 select-none"
            >
              <Icon
                size={20}
                className={cn(
                  'mb-0.5',
                  isActive ? 'text-[#f06428]' : 'text-gray-500'
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className={cn(
                  'text-[10px] font-medium tracking-wide',
                  isActive ? 'text-[#f06428]' : 'text-gray-500'
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="w-4 h-0.5 bg-[#f06428] rounded-full mt-0.5" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
