import { useState } from 'react';
import { X, ShoppingCart, Tag, ChevronDown, ChevronUp, Trash2, BarChart2 } from 'lucide-react';
import { cn , formatPrice} from '../../utils/helpers';
import { useTradeStore } from '../../store/useTradeStore';

/**
 * Bottom sheet that appears when tapping a script in the market list.
 * Shows: Market Depth (expandable), Buy, Sell, Charts, Delete options.
 * Reads LIVE data from the store so bid/ask/price updates in real-time.
 */
export default function ScriptActionSheet({ instrument: initialInstrument, onClose, onBuy, onSell, onChart, onDelete }) {
  const [showDepth, setShowDepth] = useState(false);

  // Read LIVE instrument data from the store (not the stale prop snapshot)
  const liveInstrument = useTradeStore(state =>
    state.instruments.find(i => i.symbol === initialInstrument?.symbol)
  );
  const instrument = liveInstrument || initialInstrument;

  if (!instrument) return null;

  
  const fmtVol = (v) => {
    if (!v) return '0';
    if (v >= 10000000) return (v / 10000000).toFixed(2) + 'Cr';
    if (v >= 100000) return (v / 100000).toFixed(2) + 'L';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return String(v);
  };

  // Get the last tick time — show from instrument timestamp or current
  const tickTs = instrument.lastTickTime ? new Date(instrument.lastTickTime) : new Date();
  const ltt = `${tickTs.getHours().toString().padStart(2, '0')}:${tickTs.getMinutes().toString().padStart(2, '0')}:${tickTs.getSeconds().toString().padStart(2, '0')}`;

  // Detect tick direction for bid/ask coloring
  const tickDir = instrument.tickDirection; // 'up' | 'down' | null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[101] bg-surface-2 rounded-t-2xl shadow-2xl max-w-lg mx-auto animate-slideUp">
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header — Symbol + Close */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-text-primary">{instrument.symbol}</h3>
            <span className={cn(
              'text-sm font-bold tabular-nums',
              (instrument.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {formatPrice(instrument.price)}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface-3 transition-colors">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        {/* Market Depth Toggle */}
        <button
          onClick={() => setShowDepth(!showDepth)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-3 transition-colors border-b border-border"
        >
          {showDepth ? (
            <ChevronUp size={20} className="text-text-muted" />
          ) : (
            <ChevronDown size={20} className="text-text-muted" />
          )}
          <span className="text-[15px] font-semibold text-text-primary">Market Depth</span>
        </button>

        {/* Market Depth Data (Expanded) */}
        {showDepth && (
          <div className="px-5 py-4 border-b border-border bg-surface-3/50">
            {/* OHLCV Row */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              <div>
                <p className="text-[11px] text-text-muted font-medium">Open</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">{formatPrice(instrument.open || instrument.day_open)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">High</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">{formatPrice(instrument.high || instrument.day_high)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">Low</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">{formatPrice(instrument.low || instrument.day_low)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">Close</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">{formatPrice(instrument.price || instrument.last_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">Volume</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">{fmtVol(instrument.volume)}</p>
              </div>
            </div>

            {/* Best bid/ask row — these now update live */}
            <div className="grid grid-cols-5 gap-2">
              <div>
                <p className="text-[11px] text-text-muted font-medium">Best bid</p>
                <p className={cn(
                  'text-[13px] font-bold tabular-nums transition-colors duration-150',
                  tickDir === 'up' ? 'text-emerald-400' : tickDir === 'down' ? 'text-red-400' : 'text-text-primary'
                )}>{formatPrice(instrument.bid_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">Bid Qty</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">
                  {instrument.bid_qty || '--'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">Best ask</p>
                <p className={cn(
                  'text-[13px] font-bold tabular-nums transition-colors duration-150',
                  tickDir === 'up' ? 'text-emerald-400' : tickDir === 'down' ? 'text-red-400' : 'text-text-primary'
                )}>{formatPrice(instrument.ask_price)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">Ask Qty</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">
                  {instrument.ask_qty || '-'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-medium">LTT</p>
                <p className="text-[13px] font-bold text-text-primary tabular-nums">{ltt}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-5 py-2 space-y-0.5">
          {/* Buy */}
          <button
            onClick={() => { onBuy?.(instrument); onClose(); }}
            className="w-full flex items-center gap-4 px-2 py-3.5 hover:bg-green-50 rounded-xl transition-colors"
          >
            <ShoppingCart size={20} className="text-green-600" />
            <span className="text-[15px] font-semibold text-green-600">Buy</span>
          </button>

          {/* Sell */}
          <button
            onClick={() => { onSell?.(instrument); onClose(); }}
            className="w-full flex items-center gap-4 px-2 py-3.5 hover:bg-red-50 rounded-xl transition-colors"
          >
            <Tag size={20} className="text-red-500" />
            <span className="text-[15px] font-semibold text-red-500">Sell</span>
          </button>

          {/* Charts */}
          <button
            onClick={() => { onChart?.(instrument); onClose(); }}
            className="w-full flex items-center gap-4 px-2 py-3.5 hover:bg-blue-50 rounded-xl transition-colors"
          >
            <BarChart2 size={20} className="text-blue-600" />
            <span className="text-[15px] font-semibold text-blue-600">Charts</span>
          </button>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => { onDelete?.(instrument); onClose(); }}
              className="w-full flex items-center gap-4 px-2 py-3.5 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Trash2 size={20} className="text-red-400" />
              <span className="text-[15px] font-semibold text-red-400">Delete</span>
            </button>
          )}
        </div>

        {/* Safe area padding — accounts for iPhone home indicator (34px on Pro models) */}
        <div className="safe-bottom" />
      </div>
    </>
  );
}
