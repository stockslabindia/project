import { useState } from 'react';
import { X, Minus, Plus, AlertCircle, TrendingUp, TrendingDown, Bookmark, Check } from 'lucide-react';
import { cn, formatPrice } from '../../utils/helpers';
import SlideToConfirm from '../../components/ui/SlideToConfirm';
import { api } from '../../services/api';
import { useTradeStore } from '../../store/useTradeStore';
import { usePriceStore } from '../../store/usePriceStore';

export default function OptionsTradePanel({ option, onClose, onSuccess }) {
  const [side, setSide] = useState('buy'); // 'buy' | 'sell'
  const [numLots, setNumLots] = useState(1);
  const [productType, setProductType] = useState('intraday'); // 'intraday' (MIS) | 'overnight' (NRML)
  const [orderType, setOrderType] = useState('market');
  const [limitPrice, setLimitPrice] = useState(option?.ltp ? String(option.ltp) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const addToast = useTradeStore(s => s.addToast);
  const loadInitialData = useTradeStore(s => s.loadInitialData);

  // Watchlist integration
  const watchlists = usePriceStore(s => s.watchlists);
  const activeWatchlistId = usePriceStore(s => s.activeWatchlistId);
  const updateWatchlists = usePriceStore(s => s.updateWatchlists);

  if (!option) return null;

  const currentList = watchlists[activeWatchlistId] || [];
  const isWatchlisted = currentList.includes(option.symbol);

  const handleToggleWatchlist = () => {
    const updatedList = isWatchlisted
      ? currentList.filter(s => s !== option.symbol)
      : [...currentList, option.symbol];

    updateWatchlists({
      ...watchlists,
      [activeWatchlistId]: updatedList
    });

    addToast({
      type: isWatchlisted ? 'info' : 'success',
      title: isWatchlisted ? 'Removed from Watchlist' : 'Added to Watchlist',
      message: `${option.symbol} ${isWatchlisted ? 'removed from' : 'added to'} ${activeWatchlistId}`
    });
  };

  const lotSize = option.lot_size || (option.underlying_symbol === 'NIFTY' ? 65 : 30);
  const totalQuantity = numLots * lotSize;
  const currentLtp = Number(option.ltp || option.last_price || option.base_price || 0);
  const executionPrice = orderType === 'limit' ? (Number(limitPrice) || currentLtp) : currentLtp;
  
  const requiredMargin = executionPrice * totalQuantity;

  // Break-Even calculation
  const strike = Number(option.strike_price || 0);
  const breakEven = option.option_type === 'CE' 
    ? (side === 'buy' ? strike + executionPrice : strike - executionPrice)
    : (side === 'buy' ? strike - executionPrice : strike + executionPrice);

  const handlePlaceOrder = async () => {
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const payload = {
        symbol: option.symbol,
        side: side,
        order_type: orderType,
        quantity: numLots, // quantity passed in lots to backend validator
        price: orderType === 'limit' ? Number(limitPrice) : null,
        product_type: productType
      };

      const res = await api.post('/orders', payload);

      if (res && (res.order || res.position || res.success)) {
        addToast({
          type: 'success',
          title: `Option ${side.toUpperCase()} Order Placed!`,
          message: `${side === 'buy' ? 'Bought' : 'Sold'} ${numLots} Lot(s) of ${option.symbol} @ ₹${executionPrice.toFixed(2)}`
        });

        await loadInitialData();
        onSuccess?.();
        onClose?.();
      } else {
        throw new Error(res.error || 'Failed to place order.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to place option order.');
      addToast({
        type: 'error',
        title: 'Order Failed',
        message: err.message || 'Could not place option order.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-xs" onClick={onClose} />

      {/* Sheet Container */}
      <div className="fixed bottom-0 left-0 right-0 z-[101] bg-surface-2 border-t border-border rounded-t-2xl shadow-2xl max-w-lg mx-auto overflow-hidden animate-slideUp">
        {/* Handle Bar */}
        <div className="flex justify-center pt-2 pb-1 bg-surface-2">
          <div className="w-10 h-1 bg-border/60 rounded-full" />
        </div>

        {/* Header Section */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-surface-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider',
                option.option_type === 'CE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              )}>
                {option.underlying_symbol} {option.option_type}
              </span>
              <h3 className="text-base font-bold text-text-primary">{option.symbol}</h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Strike: <span className="font-mono font-semibold text-text-primary">₹{option.strike_price}</span> | Exp: {option.expiry_date}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Watchlist Bookmark Button */}
            <button 
              onClick={handleToggleWatchlist}
              title={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
              className={cn(
                "p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold border",
                isWatchlisted 
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-xs" 
                  : "bg-surface-3 text-text-muted border-border/40 hover:text-text-primary hover:bg-surface-3/80"
              )}
            >
              <Bookmark size={16} className={isWatchlisted ? "fill-amber-400 text-amber-400" : ""} />
              <span className="hidden sm:inline">{isWatchlisted ? 'Watchlisted' : 'Watchlist'}</span>
            </button>

            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface-3 transition-colors text-text-muted">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* BUY / SELL Side Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-3 rounded-xl border border-border/40">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={cn(
                'py-2.5 rounded-lg text-xs font-extrabold tracking-wider transition-all uppercase flex items-center justify-center gap-1.5',
                side === 'buy'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {side === 'buy' && <Check size={14} />}
              BUY
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={cn(
                'py-2.5 rounded-lg text-xs font-extrabold tracking-wider transition-all uppercase flex items-center justify-center gap-1.5',
                side === 'sell'
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {side === 'sell' && <Check size={14} />}
              SELL
            </button>
          </div>

          {/* Price Overview Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-3/50 border border-border/30">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase">Option Premium LTP</p>
              <p className="text-lg font-extrabold text-text-primary tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{formatPrice(currentLtp)}
              </p>
            </div>
            <div className="text-right">
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md',
                (option.change || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              )}>
                {(option.change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {(option.change || 0) >= 0 ? '+' : ''}{(option.change || 0).toFixed(2)} ({(option.changePercent || 0).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Lots Counter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Lots Quantity</label>
              <span className="text-xs font-semibold text-text-muted">
                1 Lot = <span className="text-text-primary font-bold">{lotSize} Qty</span> ({totalQuantity} Shares total)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNumLots(Math.max(1, numLots - 1))}
                className="w-12 h-11 rounded-xl bg-surface-3 border border-border/60 flex items-center justify-center text-text-primary font-bold hover:bg-surface-3/80 active:scale-95 transition-transform"
              >
                <Minus size={18} />
              </button>
              <div className="flex-1 h-11 bg-surface-3 border border-border/60 rounded-xl flex items-center justify-center px-4">
                <span className="text-base font-extrabold text-text-primary tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {numLots} {numLots === 1 ? 'Lot' : 'Lots'}
                </span>
              </div>
              <button
                onClick={() => setNumLots(numLots + 1)}
                className="w-12 h-11 rounded-xl bg-surface-3 border border-border/60 flex items-center justify-center text-text-primary font-bold hover:bg-surface-3/80 active:scale-95 transition-transform"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Product Type Selector */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Product Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProductType('intraday')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  productType === 'intraday'
                    ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                    : 'bg-surface-3/50 border-border/40 text-text-muted hover:text-text-secondary'
                )}
              >
                <p className="text-xs font-bold">MIS (Intraday)</p>
                <p className="text-[10px] opacity-80 mt-0.5">Auto cut at 3:20 PM</p>
              </button>
              <button
                type="button"
                onClick={() => setProductType('overnight')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  productType === 'overnight'
                    ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                    : 'bg-surface-3/50 border-border/40 text-text-muted hover:text-text-secondary'
                )}
              >
                <p className="text-xs font-bold">NRML (Overnight)</p>
                <p className="text-[10px] opacity-80 mt-0.5">Carry till expiry</p>
              </button>
            </div>
          </div>

          {/* Financial Breakdown Card */}
          <div className="p-3.5 rounded-xl bg-surface-3/60 border border-border/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-medium">Required Margin</span>
              <span className="font-bold text-text-primary tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{formatPrice(requiredMargin)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-medium">Break-Even Index Price</span>
              <span className="font-bold text-emerald-400 tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{formatPrice(breakEven)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-border/30 pt-2">
              <span className="text-text-muted font-medium">Risk Profile</span>
              <span className={cn("font-bold tabular-nums", side === 'buy' ? 'text-emerald-400' : 'text-amber-400')}>
                {side === 'buy' ? 'Defined Risk (Max = Premium)' : 'Unlimited Risk (Option Seller)'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Action Slider */}
          <div className="pt-2 pb-1">
            <SlideToConfirm
              label={`SLIDE TO ${side.toUpperCase()} ${option.option_type}`}
              onConfirm={handlePlaceOrder}
              disabled={isSubmitting || requiredMargin <= 0}
            />
          </div>
        </div>
      </div>
    </>
  );
}
