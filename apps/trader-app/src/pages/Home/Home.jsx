import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, ChevronRight, BarChart3, Zap, Activity, Shield, Layers,
  Clock, DollarSign, PieChart, Briefcase
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, formatPercent, cn, getMarketStatus } from '../../utils/helpers';

const HomePositionRow = memo(({ pos }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-9 h-9 rounded flex items-center justify-center text-[11px] font-bold',
          pos.type === 'BUY' ? 'bg-[#f0fdf4] text-[#00b852]' : 'bg-[#fef2f2] text-[#ef4444]'
        )}>
          {pos.type === 'BUY' ? 'BUY' : 'SELL'}
        </div>
        <div>
          <p className="text-[14px] font-medium text-text-primary">{pos.symbol}</p>
          <p className="text-[12px] text-text-muted mt-0.5">Qty: {pos.quantity}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn('text-[14px] font-medium', pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-500')}>
          {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
        </p>
        <p className={cn('text-[12px] mt-0.5', pos.pnl >= 0 ? 'text-emerald-500/80' : 'text-red-500/80')}>
          {formatPercent(pos.pnlPercent)}
        </p>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.pos.id === next.pos.id &&
         prev.pos.symbol === next.pos.symbol &&
         prev.pos.type === next.pos.type &&
         prev.pos.quantity === next.pos.quantity &&
         prev.pos.pnl === next.pos.pnl &&
         prev.pos.pnlPercent === next.pos.pnlPercent;
});

const HomePositionRowWrapper = memo(({ id }) => {
  const pos = useTradeStore(useCallback(state => state.positionsMap?.get(id), [id]));
  if (!pos) return null;
  return <HomePositionRow pos={pos} />;
});

const PortfolioSummary = memo(() => {
  const positions = useTradeStore(state => state.positions);
  const walletRaw = useTradeStore(state => state.wallet);
  const wallet = walletRaw || { balance: 0, equity: 0, usedMargin: 0, todayPnl: 0, todayPnlPercent: 0, availableMargin: 0 };
  const navigate = useNavigate();

  const totalOpenPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const equity = wallet.balance + totalOpenPnl;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 pb-6 border-b border-border/30">
      <div>
        <div className="text-[13px] text-text-muted mb-1.5 flex items-center gap-1.5"><Wallet size={12}/> Portfolio Value</div>
        <div className="text-[32px] font-light text-text-primary tracking-tight mb-1.5 leading-none">
          {formatCurrency(equity).replace('₹', '').replace('$', '')}
        </div>
        <div className="flex items-center gap-1 text-[13px] font-medium">
           <span className={wallet.todayPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
             {wallet.todayPnl >= 0 ? '+' : ''}{formatCurrency(wallet.todayPnl)}
           </span>
           <span className="text-text-muted font-normal">today</span>
        </div>
      </div>
      
      <div>
        <div className="text-[13px] text-text-muted mb-1.5">Available Margin</div>
        <div className="text-[32px] font-light text-text-primary tracking-tight mb-1.5 leading-none">
          {formatCurrency(wallet.availableMargin).replace('₹', '').replace('$', '')}
        </div>
        <div className="flex items-center gap-1.5 text-[13px]">
           <span className="text-text-muted">Used:</span>
           <span className="text-text-primary font-medium">{formatCurrency(wallet.usedMargin)}</span>
        </div>
      </div>
      
      <div>
        <div className="text-[13px] text-text-muted mb-1.5">Open P&L</div>
        <div className={cn('text-[32px] font-light tracking-tight mb-1.5 leading-none', totalOpenPnl >= 0 ? 'text-emerald-500' : 'text-red-500')}>
          {totalOpenPnl >= 0 ? '+' : ''}{formatCurrency(totalOpenPnl).replace('₹', '').replace('$', '')}
        </div>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted">
           Across {positions.length} positions
        </div>
      </div>
      
      <div>
        <div className="text-[13px] text-text-muted mb-1.5">Balance</div>
        <div className="text-[32px] font-light text-text-primary tracking-tight mb-1.5 leading-none">
          {formatCurrency(wallet.balance).replace('₹', '').replace('$', '')}
        </div>
        <button onClick={() => navigate('/wallet')} className="text-[13px] text-[#387ed1] hover:text-[#2b6eb5] font-medium transition-colors">
           View statement
        </button>
      </div>
    </div>
  );
});

const OpenPositionsList = memo(() => {
  const positions = useTradeStore(state => state.positions);
  const navigate = useNavigate();

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-text-secondary">
          Open Positions <span className="text-text-muted ml-1">({positions.length})</span>
        </h2>
        {positions.length > 0 && (
          <button onClick={() => navigate('/positions')} className="text-[13px] text-[#387ed1] hover:text-[#2b6eb5] font-medium transition-colors">
            View all
          </button>
        )}
      </div>
      
      <div className="bg-surface border border-border/60 rounded">
        {positions.length > 0 ? (
          <div className="divide-y divide-border/40">
            {positions.slice(0, 5).map((pos) => (
              <HomePositionRowWrapper key={pos.id} id={pos.id} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 opacity-20 text-text-primary">
              <Briefcase size={64} strokeWidth={1} />
            </div>
            <p className="text-[14px] text-text-secondary mb-1">No open positions</p>
            <p className="text-[13px] text-text-muted">You don't have any active trades right now.</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default function Home() {
  const user = useTradeStore(state => state.user);
  const navigate = useNavigate();

  // Market status
  const isMarketOpen = getMarketStatus('nse_equity').open;

  return (
    <div className="bg-surface min-h-full pb-20 lg:pb-8">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <Header showGreeting showNotification />
      </div>

      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto space-y-8">
        
        {/* Desktop Greeting & Market Status */}
        <div className="hidden lg:flex items-end justify-between border-b border-border/40 pb-6">
           <h1 className="text-[28px] font-normal text-text-primary tracking-tight">
             Hi, {user?.name?.split(' ')[0] || 'Trader'}
           </h1>
           <div className="flex items-center gap-2">
             <div className={cn('w-1.5 h-1.5 rounded-full', isMarketOpen ? 'bg-emerald-500' : 'bg-red-500')} />
             <span className="text-[13px] text-text-muted">{isMarketOpen ? 'Market Open' : 'Market Closed'}</span>
           </div>
        </div>

        {/* Portfolio Summary Row - Clean Flat Styling */}
        <PortfolioSummary />

        {/* Quick Actions */}
        <div>
          <h2 className="text-[15px] font-medium text-text-secondary mb-4">Quick Actions</h2>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3 lg:gap-4">
            {[
              { icon: BarChart3, label: 'Markets', path: '/markets' },
              { icon: Zap, label: 'Trade', path: '/charts' },
              { icon: Layers, label: 'Positions', path: '/positions' },
              { icon: Shield, label: 'History', path: '/history' },
              { icon: DollarSign, label: 'Funds', path: '/wallet' },
              { icon: Activity, label: 'Orders', path: '/orders' },
              { icon: PieChart, label: 'Reports', path: '/reports' },
              { icon: Clock, label: 'Referral', path: '/referral' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 group p-2"
              >
                <div className="w-12 h-12 rounded bg-surface border border-border/60 flex items-center justify-center text-text-secondary group-hover:text-[#387ed1] group-hover:border-[#387ed1]/30 transition-all">
                  <action.icon size={20} strokeWidth={1.5} />
                </div>
                <span className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Open Positions */}
        <OpenPositionsList />

      </div>
    </div>
  );
}
