import { useTradeStore } from '../../store/useTradeStore';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/helpers';

// Simulated index data — in production this would come from the price feed
const INDICES = [
  { name: 'NIFTY FUT', symbol: 'NIFTY26JULFUT' },
  { name: 'BANKNIFTY FUT', symbol: 'BANKNIFTY26JULFUT' },
];

export default function MarketTickerBar() {
  const instruments = useTradeStore((s) => s.instruments);

  // Try to find real index data from instruments, otherwise show placeholder
  const getIndexData = (symbol, indexName) => {
    // Look for a matching instrument
    const match = instruments.find(i => i.symbol === symbol);
    if (match) {
      return {
        price: match.price,
        change: match.change || 0,
        changePercent: match.changePercent || 0,
      };
    }
    // Fallback simulated values
    if (indexName === 'NIFTY FUT') return { price: 23496.45, change: 116.90, changePercent: 0.50 };
    return { price: 53792.30, change: 237.10, changePercent: 0.44 };
  };

  return (
    <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 bg-[#0a0e17] border-b border-white/5 text-white">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-black text-sm">T</span>
        </div>
      </div>

      {/* Live Index Tickers */}
      {INDICES.map((index) => {
        const data = getIndexData(index.symbol, index.name);
        const isUp = data.change >= 0;
        return (
          <div key={index.name} className="flex items-center gap-3">
            <div>
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">{index.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {data.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className={cn(
                  'text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums',
                  isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {isUp ? '+' : ''}{data.change.toFixed(2)}
                </span>
                <span className={cn(
                  'text-[11px] font-semibold tabular-nums',
                  isUp ? 'text-emerald-400' : 'text-red-400'
                )}>
                  ({data.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
