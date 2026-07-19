import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, BarChart3, TrendingUp, TrendingDown,
  ArrowDownLeft, ArrowUpRight, Clock,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, cn } from '../../utils/helpers';

const reportTabs = [
  { key: 'ledger', label: 'Ledger' },
  { key: 'pnl', label: 'P&L' },
];

export default function Reports() {
  const navigate = useNavigate();
  const tradeHistory = useTradeStore(s => s.tradeHistory);
  const walletTransactions = useTradeStore(s => s.walletTransactions);
  const [activeTab, setActiveTab] = useState('ledger');
  const [dateRange, setDateRange] = useState('month');

  // Helper to determine if a date is within the selected filter range
  const isWithinDateRange = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'week': {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        return date >= startOfWeek;
      }
      case 'month': {
        const startOfMonth = new Date(startOfToday);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        return date >= startOfMonth;
      }
      case '3months': {
        const startOf3M = new Date(startOfToday);
        startOf3M.setDate(startOf3M.getDate() - 90);
        return date >= startOf3M;
      }
      case 'year': {
        // FY 24-25: April 1, 2024 to March 31, 2025
        const startFY = new Date(2024, 3, 1); // 3 represents April (0-indexed)
        const endFY = new Date(2025, 2, 31, 23, 59, 59); // 2 represents March (0-indexed)
        return date >= startFY && date <= endFY;
      }
      default:
        return true;
    }
  };

  // Filter trade history based on active date range
  const filteredHistory = tradeHistory.filter(t => isWithinDateRange(t.closed_at || t.opened_at));

  // Compute summary stats dynamically
  const totalPnl = filteredHistory.reduce((sum, t) => sum + t.pnl, 0);
  const totalTrades = filteredHistory.length;
  const winRate = totalTrades > 0 ? ((filteredHistory.filter(t => t.pnl > 0).length / totalTrades) * 100).toFixed(0) : '0';

  // Filter and build ledger from wallet transactions
  const filteredLedger = walletTransactions
    .filter(tx => isWithinDateRange(tx.created_at))
    .map(tx => {
      const isCredit = tx.amount > 0;
      const dateObj = tx.created_at ? new Date(tx.created_at) : null;
      const formattedDate = dateObj
        ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
        : '';
      const formattedTime = dateObj
        ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '';

      return {
        id: tx.id,
        date: formattedDate,
        time: formattedTime,
        type: tx.type,
        description: tx.description || tx.type,
        amount: tx.amount,
        isCredit,
        balance: tx.balance_after ?? 0,
      };
    });

  // Get dynamic calendar section label
  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case '3months': return 'Last 90 Days';
      case 'year': return 'FY 2024-25';
      default: return 'All Time';
    }
  };

  return (
    <div className="bg-surface min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center px-3 py-2.5 gap-3">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle">
            <ArrowLeft size={18} className="text-text-primary" />
          </button>
          <h1 className="text-base font-bold text-text-primary">Reports & Statements</h1>
        </div>
      </header>

      <div className="px-3 space-y-3.5 pb-6 pt-2 max-w-lg mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card padding="p-3 bg-surface-2 border border-border/40">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total P&L</p>
            <p className={cn(
              'text-[14px] font-black tabular-nums mt-0.5',
              totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
            )} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </p>
          </Card>
          <Card padding="p-3 bg-surface-2 border border-border/40">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total Trades</p>
            <p className="text-[14px] font-black text-text-primary mt-0.5">{totalTrades}</p>
          </Card>
          <Card padding="p-3 bg-surface-2 border border-border/40">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Win Rate</p>
            <p className="text-[14px] font-black text-emerald-400 mt-0.5">{winRate}%</p>
          </Card>
        </div>

        {/* Report Type Tabs */}
        <Tabs tabs={reportTabs} activeTab={activeTab} onChange={setActiveTab} compact />

        {/* Date Range Filter */}
        <div className="flex gap-1.5 bg-surface-3 p-1 rounded-xl border border-border/30">
          {[
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: '3months', label: '3 Months' },
            { key: 'year', label: 'FY 24-25' },
          ].map(range => (
            <button
              key={range.key}
              onClick={() => setDateRange(range.key)}
              className={cn(
                'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all',
                dateRange === range.key
                  ? 'bg-primary text-white shadow-sm shadow-primary/10'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
              )}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Ledger Tab Content */}
        {activeTab === 'ledger' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Account Ledger</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium bg-surface-2 px-2 py-0.5 rounded-full border border-border/40">
                <Calendar size={10} />
                <span>{getDateRangeLabel()}</span>
              </div>
            </div>

            <Card padding="p-0 bg-surface-2 border border-border/40 overflow-hidden">
              <div className="divide-y divide-border/20">
                {filteredLedger.length > 0 ? (
                  filteredLedger.map(entry => {
                    const isPnl = entry.type === 'trade_pnl';
                    const isCredit = entry.amount > 0;
                    
                    // Assign modern colored flow indicator icons
                    let IconComponent = ArrowDownLeft;
                    let iconColorClass = 'bg-emerald-500/10 text-emerald-400';

                    if (isPnl) {
                      IconComponent = isCredit ? TrendingUp : TrendingDown;
                      iconColorClass = isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400';
                    } else if (entry.type === 'withdrawal' || !isCredit) {
                      IconComponent = ArrowUpRight;
                      iconColorClass = 'bg-red-500/10 text-red-400';
                    }

                    return (
                      <div key={entry.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconColorClass)}>
                            <IconComponent size={16} strokeWidth={2.2} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-text-primary truncate capitalize">
                              {entry.description.replace(/_/g, ' ')}
                            </p>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {entry.date} {entry.time && `· ${entry.time}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn('text-[13px] font-black tabular-nums', entry.isCredit ? 'text-emerald-400' : 'text-red-400')}
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {entry.isCredit ? '+' : ''}{formatCurrency(entry.amount)}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                            Bal: {formatCurrency(entry.balance)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <Clock size={24} className="mx-auto text-text-muted/20 mb-2" />
                    <p className="text-xs text-text-muted font-bold">No transactions found</p>
                    <p className="text-[11px] text-text-muted/60 mt-0.5">Try changing the date filter range</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* P&L Tab Content */}
        {activeTab === 'pnl' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">P&L Breakdown</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium bg-surface-2 px-2 py-0.5 rounded-full border border-border/40">
                <Calendar size={10} />
                <span>{getDateRangeLabel()}</span>
              </div>
            </div>

            <Card padding="p-0 bg-surface-2 border border-border/40 overflow-hidden">
              <div className="divide-y divide-border/20">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map(trade => {
                    const isProfit = trade.pnl >= 0;
                    return (
                      <div key={trade.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                          <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black tracking-wider flex-shrink-0',
                            trade.type === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          )}>
                            {trade.type}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-bold text-text-primary truncate">{trade.symbol}</p>
                              <span className="text-[10px] text-text-muted bg-surface-3 px-1 rounded font-bold">Qty {trade.quantity}</span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              ₹{Number(trade.entryPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })} → ₹{Number(trade.exitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn('text-[13px] font-black tabular-nums', isProfit ? 'text-emerald-400' : 'text-red-400')}
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {isProfit ? '+' : ''}{formatCurrency(trade.pnl)}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                            {trade.closeDate}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center">
                    <BarChart3 size={24} className="mx-auto text-text-muted/20 mb-2" />
                    <p className="text-xs text-text-muted font-bold">No completed trades found</p>
                    <p className="text-[11px] text-text-muted/60 mt-0.5">Try changing the date filter range</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
