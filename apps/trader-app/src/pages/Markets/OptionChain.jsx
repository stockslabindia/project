import { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, RefreshCw, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useOptionChainStore } from '../../store/useOptionChainStore';
import { cn, formatPrice } from '../../utils/helpers';
import OptionsTradePanel from '../Trade/OptionsTradePanel';

export default function OptionChain() {
  const navigate = useNavigate();
  const { underlyingParam } = useParams();

  const {
    underlying,
    selectedExpiry,
    expiries,
    spotPrice,
    spotChange,
    spotChangePct,
    atmStrike,
    strikes,
    isLoading,
    fetchExpiries,
    fetchOptionChain,
    setUnderlying,
    setSelectedExpiry
  } = useOptionChainStore();

  const [selectedOption, setSelectedOption] = useState(null);
  const [showUnderlyingMenu, setShowUnderlyingMenu] = useState(false);

  useEffect(() => {
    const targetUnderlying = (underlyingParam || 'NIFTY').toUpperCase();
    if (['NIFTY', 'BANKNIFTY'].includes(targetUnderlying)) {
      setUnderlying(targetUnderlying);
    } else {
      setUnderlying('NIFTY');
    }
  }, [underlyingParam]);

  // Auto-refresh option chain data every 3 seconds for live ticks
  useEffect(() => {
    if (!selectedExpiry) return;
    const interval = setInterval(() => {
      fetchOptionChain(underlying, selectedExpiry);
    }, 3000);
    return () => clearInterval(interval);
  }, [underlying, selectedExpiry]);

  const handleUnderlyingChange = (sym) => {
    setShowUnderlyingMenu(false);
    navigate(`/options/${sym.toLowerCase()}`);
  };

  return (
    <div className="flex flex-col h-full bg-surface min-h-full">
      {/* ── Top Glassmorphic Header ── */}
      <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/markets')}
              className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-text-primary"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Underlying Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUnderlyingMenu(!showUnderlyingMenu)}
                className="flex items-center gap-1.5 bg-surface-3 px-2.5 py-1 rounded-lg border border-border/40 hover:bg-surface-3/80 transition-colors"
              >
                <span className="text-xs font-bold text-text-primary tracking-wide">{underlying} CHAIN</span>
                <ChevronDown size={14} className="text-text-muted" />
              </button>

              {showUnderlyingMenu && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-surface-2 border border-border rounded-xl shadow-xl z-50 py-1 animate-fadeIn">
                  <button
                    onClick={() => handleUnderlyingChange('NIFTY')}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-bold transition-colors flex items-center justify-between',
                      underlying === 'NIFTY' ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-3'
                    )}
                  >
                    <span>NIFTY 50</span>
                    <span className="text-[10px] text-text-muted">Tue Exp</span>
                  </button>
                  <button
                    onClick={() => handleUnderlyingChange('BANKNIFTY')}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-bold transition-colors flex items-center justify-between',
                      underlying === 'BANKNIFTY' ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-3'
                    )}
                  >
                    <span>BANK NIFTY</span>
                    <span className="text-[10px] text-text-muted">Monthly</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live Spot Index Ticker */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] font-bold text-text-muted uppercase">SPOT</span>
              <p className="text-xs font-extrabold text-text-primary tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{formatPrice(spotPrice)}
              </p>
            </div>
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums',
              spotChange >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {spotChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {spotChange >= 0 ? '+' : ''}{spotChange.toFixed(2)} ({spotChangePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Horizontal Expiry Pills */}
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide bg-surface-2 border-t border-border/20">
          {expiries && expiries.map((exp) => (
            <button
              key={exp.date}
              onClick={() => setSelectedExpiry(exp.date)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0',
                selectedExpiry === exp.date
                  ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                  : 'bg-surface-3 text-text-muted border-border/40 hover:text-text-primary'
              )}
            >
              {exp.label}
              {exp.isMonthly && <span className="text-[9px] opacity-90 ml-1 font-normal">● Monthly</span>}
            </button>
          ))}
        </div>
      </header>

      {/* ── Table Column Headers ── */}
      <div className="grid grid-cols-7 bg-surface-3/80 text-[10px] font-bold text-text-muted uppercase px-2 py-1.5 border-b border-border/40 text-center sticky top-[82px] z-20 backdrop-blur-xs">
        <div className="col-span-3 text-left pl-2">CALLS (CE)</div>
        <div className="col-span-1">STRIKE</div>
        <div className="col-span-3 text-right pr-2">PUTS (PE)</div>
      </div>

      {/* ── Option Chain Body Grid ── */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
        {isLoading && strikes.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="text-primary animate-spin" />
          </div>
        ) : strikes && strikes.length > 0 ? (
          strikes.map((row) => {
            const isAtmRow = row.isAtm;
            const isCallItm = row.strike < atmStrike; // Strikes below ATM are ITM Calls
            const isPutItm = row.strike > atmStrike;  // Strikes above ATM are ITM Puts

            return (
              <div key={row.strike} className="relative">
                {/* ATM Divider Bar */}
                {isAtmRow && (
                  <div className="bg-amber-500/15 border-y border-amber-500/30 px-3 py-1 flex items-center justify-between text-[11px] font-extrabold text-amber-400">
                    <span>ATM LEVEL</span>
                    <span className="font-mono tabular-nums">₹{atmStrike}</span>
                  </div>
                )}

                {/* Strike Data Row */}
                <div className="grid grid-cols-7 border-b border-border/30 text-xs items-center text-center hover:bg-surface-2 transition-colors">
                  {/* CALL SIDE */}
                  <div
                    onClick={() => row.CE && setSelectedOption(row.CE)}
                    className={cn(
                      'col-span-3 flex items-center justify-between px-2.5 py-2.5 cursor-pointer active:scale-[0.98] transition-transform select-none',
                      isCallItm ? 'bg-primary/8' : ''
                    )}
                  >
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted tabular-nums">
                        OI: {row.CE ? (row.CE.open_interest / 1000).toFixed(1) + 'k' : '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-text-primary tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {row.CE ? `₹${formatPrice(row.CE.ltp)}` : '-'}
                      </p>
                      {row.CE && (
                        <p className={cn('text-[10px] font-semibold tabular-nums', row.CE.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {row.CE.change >= 0 ? '+' : ''}{row.CE.change.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* STRIKE PRICE CENTER */}
                  <div className={cn(
                    'col-span-1 py-2.5 font-extrabold tabular-nums border-x border-border/30',
                    isAtmRow ? 'text-amber-400 bg-amber-500/10' : 'text-text-primary bg-surface-3/30'
                  )} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {row.strike}
                  </div>

                  {/* PUT SIDE */}
                  <div
                    onClick={() => row.PE && setSelectedOption(row.PE)}
                    className={cn(
                      'col-span-3 flex items-center justify-between px-2.5 py-2.5 cursor-pointer active:scale-[0.98] transition-transform select-none',
                      isPutItm ? 'bg-primary/8' : ''
                    )}
                  >
                    <div className="text-left">
                      <p className="font-bold text-text-primary tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {row.PE ? `₹${formatPrice(row.PE.ltp)}` : '-'}
                      </p>
                      {row.PE && (
                        <p className={cn('text-[10px] font-semibold tabular-nums', row.PE.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {row.PE.change >= 0 ? '+' : ''}{row.PE.change.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted tabular-nums">
                        OI: {row.PE ? (row.PE.open_interest / 1000).toFixed(1) + 'k' : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-text-muted text-xs">
            No option chain data available for this expiry.
          </div>
        )}
      </div>

      {/* ── Option Order Sheet ── */}
      {selectedOption && (
        <OptionsTradePanel
          option={selectedOption}
          onClose={() => setSelectedOption(null)}
          onSuccess={() => setSelectedOption(null)}
        />
      )}
    </div>
  );
}
