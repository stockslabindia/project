import { useState, useMemo } from 'react';
import { X, Search, ChevronRight, Plus, Check, TrendingUp, Globe, DollarSign, BarChart2 } from 'lucide-react';
import { cn , formatPrice} from '../../utils/helpers';

// ── Category Folders ──
const CATEGORIES = [
  { key: 'nse_equity', label: 'NSE India Stocks', icon: '📈', segment: 'nse_equity', desc: 'RELIANCE, TCS, INFY...' },
  { key: 'fo_futures', label: 'NSE Futures', icon: '📊', segment: 'fo_futures', desc: 'NIFTY, BANKNIFTY Futures' },
  { key: 'fo_options', label: 'NSE F&O Options', icon: '🎯', segment: 'fo_options', desc: 'NIFTY & BANKNIFTY Call/Put Options' },
  { key: 'forex', label: 'Forex', icon: '💱', segment: 'forex', desc: 'EUR/USD, GBP/USD, USD/JPY...' },
  { key: 'crypto', label: 'Crypto', icon: '₿', segment: 'crypto', desc: 'BTC, ETH, SOL, DOGE...' },
  { key: 'indices', label: 'Global Indices', icon: '🌍', segment: 'global_indices', desc: 'NIFTY 50, BANK NIFTY, S&P 500' },
  { key: 'us_equity', label: 'USA Market Stocks', icon: '🇺🇸', segment: 'us_equity', desc: 'AAPL, TSLA, NVDA, META...' },
  { key: 'mcx', label: 'Metals & Commodities', icon: '⚡', segment: 'mcx', desc: 'GOLD, SILVER, CRUDE...' },
];


export default function InstrumentBrowser({ instruments, onAdd, onClose, activeSymbols }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categorizedInstruments = useMemo(() => {
    const result = {};
    for (const cat of CATEGORIES) {
      if (cat.segment) {
        result[cat.key] = instruments.filter(i => i.segment === cat.segment);
      } else if (cat.filter) {
        result[cat.key] = instruments.filter(cat.filter);
      } else {
        result[cat.key] = [];
      }
    }
    return result;
  }, [instruments]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return instruments.filter(i =>
      i.symbol.toLowerCase().includes(q) || (i.name || '').toLowerCase().includes(q)
    ).slice(0, 30);
  }, [instruments, searchQuery]);

  
  const isAdded = (symbol) => activeSymbols?.includes(symbol);

  return (
    <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-slideUp">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Plus size={20} className="text-primary" />
          <h2 className="text-base font-bold text-text-primary">Add Instruments</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface transition-colors">
          <X size={18} className="text-text-muted" />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 py-3 bg-surface border-b border-border/50">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all categories..."
            className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
            autoFocus
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-20">
        {searchQuery.trim() ? (
          /* Search Results */
          <div>
            <div className="px-4 py-2 bg-surface-2 border-b border-border/30">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                {searchResults.length} Results
              </p>
            </div>
            {searchResults.length > 0 ? (
              searchResults.map((inst) => (
                <InstrumentRow
                  key={inst.symbol}
                  inst={inst}
                  isAdded={isAdded(inst.symbol)}
                  onAdd={() => onAdd(inst.symbol)}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <Search size={32} className="mx-auto text-text-muted/20 mb-3" />
                <p className="text-sm text-text-muted">No instruments found</p>
              </div>
            )}
          </div>
        ) : (
          /* Category Folders */
          <div>
            {CATEGORIES.map((cat) => {
              const count = categorizedInstruments[cat.key]?.length || 0;
              const isExpanded = expandedCategory === cat.key;

              return (
                <div key={cat.key}>
                  {/* Folder Row */}
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 transition-colors',
                      isExpanded ? 'bg-primary/5' : 'hover:bg-surface-2'
                    )}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-text-primary">{cat.label}</p>
                      <p className="text-xs text-text-muted mt-0.5">{cat.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-muted bg-surface-3 px-2 py-0.5 rounded-full">
                        {count}
                      </span>
                      <ChevronRight
                        size={16}
                        className={cn('text-text-muted transition-transform duration-200', isExpanded && 'rotate-90')}
                      />
                    </div>
                  </button>

                  {/* Expanded Instrument List */}
                  {isExpanded && (
                    <div className="bg-surface-2/50">
                      {count > 0 ? (
                        <>
                          {categorizedInstruments[cat.key].slice(0, 100).map((inst) => (
                            <InstrumentRow
                              key={inst.symbol}
                              inst={inst}
                              isAdded={isAdded(inst.symbol)}
                              onAdd={() => onAdd(inst.symbol)}
                            />
                          ))}
                          {count > 100 && (
                            <div className="py-3 px-4 text-center border-b border-border/20">
                              <p className="text-xs text-text-muted">
                                Showing first 100 of {count} instruments. Use the search bar above to find others.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-6 text-center">
                          <p className="text-xs text-text-muted">No instruments in this category</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual Instrument Row ──
function InstrumentRow({ inst, isAdded, onAdd }) {
  const change = inst.change || inst.change_amount || 0;
  const pct = inst.changePercent || inst.change_percent || 0;
  const isUp = change >= 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20 hover:bg-surface-2/80 transition-colors [contain:layout_style] [content-visibility:auto] contain-intrinsic-size-[60px]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary">{inst.symbol}</p>
        <p className="text-xs text-text-muted truncate">{inst.name || inst.symbol}</p>
      </div>
      <div className="text-right mr-2">
        <p className="text-sm font-bold text-text-primary tabular-nums">{formatPrice(inst.price || inst.last_price)}</p>
        <p className={cn('text-[11px] font-medium tabular-nums', isUp ? 'text-emerald-400' : 'text-red-400')}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)} ({pct.toFixed(2)}%)
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); if (!isAdded) onAdd(); }}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center transition-all',
          isAdded
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-95'
        )}
      >
        {isAdded ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
