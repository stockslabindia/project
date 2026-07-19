import { Search, Calendar, TrendingUp, TrendingDown, FileText, ArrowRight } from 'lucide-react';
import Header from '../../components/layout/Header';
import Card from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, formatPercent, cn } from '../../utils/helpers';

const dateFilters = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: '3months', label: '3M' },
];

export default function History() {
  const getFilteredHistory = useTradeStore(s => s.getFilteredHistory);
  const historyFilter = useTradeStore(s => s.historyFilter);
  const setHistoryFilter = useTradeStore(s => s.setHistoryFilter);
  const history = getFilteredHistory();

  const totalPnl = history.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = history.length > 0 ? ((history.filter((t) => t.pnl > 0).length / history.length) * 100).toFixed(0) : '0';
  const avgPnl = history.length > 0 ? totalPnl / history.length : 0;

  return (
    <div className="">
      <Header title="Trade History" compact />

      <div className="px-3 space-y-2.5 pb-3">
        {/* Summary Stats */}
        <Card padding="p-3">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Total P&L</p>
              <p className={cn(
                'text-base font-extrabold tabular-nums',
                totalPnl >= 0 ? 'pnl-profit' : 'pnl-loss'
              )} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Win Rate</p>
              <div className="flex items-center gap-1">
                <p className="text-base font-extrabold text-text-primary">{winRate}%</p>
                <div className="w-6 h-1.5 bg-border/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${winRate}%` }}
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Trades</p>
              <p className="text-base font-extrabold text-text-primary">{history.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Avg P&L</p>
              <p className={cn(
                'text-base font-extrabold tabular-nums',
                avgPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
              )} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatCurrency(avgPnl)}
              </p>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={historyFilter.symbol}
              onChange={(e) => setHistoryFilter({ symbol: e.target.value })}
              placeholder="Filter by symbol..."
              className="w-full bg-surface border border-border/50 rounded-xl pl-8 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
            />
          </div>
          <Tabs
            tabs={dateFilters}
            activeTab={historyFilter.dateRange}
            onChange={(range) => setHistoryFilter({ dateRange: range })}
            compact
          />
        </div>

        {/* Trade History List */}
        {history.length > 0 ? (
          <Card padding="p-0">
            <div className="divide-y divide-border/20">
              {history.map((trade, i) => {
                const isProfit = trade.pnl >= 0;
                return (
                  <div
                    key={trade.id}
                    className="px-3 py-2.5 hover:bg-surface/30 transition-colors"
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold',
                          trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
                        )}>
                          {trade.type === 'BUY' ? '▲' : '▼'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-text-primary">{trade.symbol}</p>
                            <span className={cn(
                              'text-[11px] font-bold px-1 py-0.5 rounded',
                              trade.type === 'BUY' ? 'bg-emerald-500/8 text-emerald-600' : 'bg-red-500/8 text-red-500'
                            )}>
                              {trade.type}
                            </span>
                          </div>
                          <p className="text-sm text-text-muted mt-0.5">
                            Qty: <span className="font-semibold">{trade.quantity}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-sm font-extrabold tabular-nums',
                          isProfit ? 'pnl-profit' : 'pnl-loss'
                        )} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {isProfit ? '+' : ''}{formatCurrency(trade.pnl)}
                        </p>
                        <span className={cn(
                          'inline-block text-[11px] font-bold px-1.5 py-0.5 rounded-md mt-0.5',
                          isProfit ? 'bg-emerald-500/8 text-emerald-600' : 'bg-red-500/8 text-red-500'
                        )}>
                          {isProfit ? '✓ Profit' : '✗ Loss'}
                        </span>
                      </div>
                    </div>

                    {/* Entry → Exit prices */}
                    <div className="flex items-center gap-2 text-sm text-text-muted ml-10">
                      <span className="font-medium">
                        {trade.entryPrice >= 100
                          ? '₹' + trade.entryPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                          : '$' + trade.entryPrice.toFixed(4)}
                      </span>
                      <ArrowRight size={8} className={isProfit ? 'text-emerald-400' : 'text-red-400'} />
                      <span className={cn('font-bold', isProfit ? 'text-emerald-500' : 'text-red-500')}>
                        {trade.exitPrice >= 100
                          ? '₹' + trade.exitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                          : '$' + trade.exitPrice.toFixed(4)}
                      </span>
                      <span className="text-text-muted/50 ml-auto flex items-center gap-0.5">
                        <Calendar size={8} />
                        {trade.closeDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="py-10 text-center">
            <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-2">
              <FileText size={22} className="text-text-muted/50" />
            </div>
            <p className="text-sm font-semibold text-text-secondary">No Trade History</p>
            <p className="text-base text-text-muted mt-0.5">Your completed trades will appear here</p>
          </Card>
        )}
      </div>
    </div>
  );
}
