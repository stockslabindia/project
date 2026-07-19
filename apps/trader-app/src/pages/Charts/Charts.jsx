import { useState, useEffect } from 'react';
import LightweightChart from '../../components/ui/LightweightChart';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { useTradeStore } from '../../store/useTradeStore';
import { cn, formatPrice, getMarketStatus } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';

const TIMEFRAMES = [
  { label: '1m', interval: '1' }, { label: '5m', interval: '5' },
  { label: '15m', interval: '15' }, { label: '30m', interval: '30' },
  { label: '1H', interval: '60' }, { label: '4H', interval: '240' },
  { label: 'D', interval: 'D' }, { label: 'W', interval: 'W' }, { label: 'M', interval: 'M' },
];

export default function Charts() {
  const {
    selectedInstrument, setSelectedInstrument,
    setOrderSide,
    updateSubscriptions, instruments, instrumentsMap,
  } = useTradeStore();
  const navigate = useNavigate();

  const [activeTimeframe, setActiveTimeframe] = useState(1);
  const [showPicker, setShowPicker] = useState(false);

  // Ensure we're subscribed to the selected instrument's price feed
  useEffect(() => {
    if (selectedInstrument?.symbol) {
      updateSubscriptions();
    }
  }, [selectedInstrument?.symbol, updateSubscriptions]);

  const allInstruments = instruments || [];
  // Read LIVE instrument data from the instrumentsMap (not stale selectedInstrument)
  const instrument = (selectedInstrument
    ? instrumentsMap?.get(selectedInstrument.symbol) || selectedInstrument
    : allInstruments[0]) || {
    symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0
  };

  const marketStatus = getMarketStatus(instrument?.segment);
  const currSymbol = ['nse_equity', 'bse_equity', 'fo_futures', 'fo_options', 'mcx'].includes(instrument.segment) ? '₹' : '$';

  // Navigate to the unified Trade page — same UI as the watchlist BUY/SELL flow
  const handleOpenBuy = () => { setOrderSide('buy'); navigate('/trade'); };
  const handleOpenSell = () => { setOrderSide('sell'); navigate('/trade'); };

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* ── Stock Selector Header ── safe-top keeps it below the iPhone notch on fullscreen mode */}
      <header className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-border z-20 flex-wrap safe-top">
        <button onClick={() => navigate('/')} className="p-1 rounded hover:bg-surface-3 transition-colors text-text-primary mr-1 flex items-center justify-center cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => setShowPicker(!showPicker)} className="flex items-center gap-1 p-1 rounded hover:bg-surface-3 transition-colors">
          <h1 className="text-sm font-bold text-text-primary">{instrument.symbol}</h1>
          <ChevronDown size={14} className="text-text-muted" />
        </button>
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded',
          (instrument.change || 0) >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
          {(instrument.change || 0) >= 0 ? '+' : ''}{(instrument.change || 0).toFixed(2)} ({(instrument.changePercent || 0).toFixed(2)}%)
        </span>
        <span className={cn(
          'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider select-none shrink-0',
          marketStatus.color
        )}>
          {marketStatus.statusText}
        </span>
        <span className="text-xs text-text-muted truncate flex-1">{instrument.name}</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">{currSymbol}{formatPrice(instrument.price)}</span>
      </header>

      {/* Stock Picker Dropdown */}
      {showPicker && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />
          <div className="absolute top-12 left-0 right-0 bg-surface-2 border-b border-border shadow-xl max-h-64 overflow-y-auto z-40">
            {allInstruments.map((inst) => (
              <button key={inst.symbol} onClick={() => { setSelectedInstrument(inst); setShowPicker(false); }}
                className={cn('w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface-3 transition-colors',
                  inst.symbol === instrument.symbol && 'bg-blue-500/10')}>
                <div>
                  <span className="text-sm font-bold text-text-primary">{inst.symbol}</span>
                  <span className="text-xs text-text-muted ml-2">{inst.name}</span>
                </div>
                <span className={cn('text-xs font-bold', (inst.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {(inst.changePercent || 0).toFixed(2)}%
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Timeframe Bar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-surface border-b border-border overflow-x-auto scrollbar-hide">
        {TIMEFRAMES.map((tf, i) => (
          <button key={tf.label} onClick={() => setActiveTimeframe(i)}
            className={cn('px-2.5 py-1 text-xs font-bold rounded transition-all whitespace-nowrap',
              activeTimeframe === i ? 'bg-blue-600 text-white' : 'text-text-muted hover:text-text-primary hover:bg-surface-3')}>
            {tf.label}
          </button>
        ))}
      </div>

      {/* ── Chart Area ── */}
      <div className="flex-1 relative overflow-hidden bg-surface chart-container">
        <LightweightChart symbol={instrument.symbol} timeframe={TIMEFRAMES[activeTimeframe].label} livePrice={instrument.price} />
      </div>

    </div>
  );
}
