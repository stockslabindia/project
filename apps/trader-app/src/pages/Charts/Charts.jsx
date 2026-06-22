import { useState, useEffect } from 'react';
import LightweightChart from '../../components/ui/LightweightChart';
import {
  ChevronDown, X, Plus, Minus, ShoppingCart, Tag,
  RefreshCw, AlertCircle, Check, Loader2,
} from 'lucide-react';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, cn , formatPrice, getMarketStatus} from '../../utils/helpers';
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
    orderType, setOrderType, orderSide, setOrderSide,
    quantity, setQuantity, placeOrder, wallet,
    updateSubscriptions, instruments, instrumentsMap,
  } = useTradeStore();
  const navigate = useNavigate();

  const [activeTimeframe, setActiveTimeframe] = useState(1);
  const [showPicker, setShowPicker] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [limitPrice, setLimitPrice] = useState('');
  const [productType, setProductType] = useState('overnight');
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);

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
  const isIndianSegment = ['nse_equity', 'bse_equity', 'fo_futures', 'fo_options', 'mcx'].includes(instrument.segment);
  const marketStatus = getMarketStatus(instrument?.segment);
  const currSymbol = isIndianSegment ? '₹' : '$';
  const bal = wallet?.availableMargin || wallet?.balance || 0;
  const totalValue = quantity ? (Number(quantity) * instrument.price) : 0;
  const requiredMargin = totalValue * 0.1;

  
  const now = new Date();
  const ltt = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const handleOpenBuy = () => { setOrderSide('buy'); setOrderError(null); setShowOrderForm(true); };
  const handleOpenSell = () => { setOrderSide('sell'); setOrderError(null); setShowOrderForm(true); };

  const handlePlaceOrder = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return;
    setOrderLoading(true);
    setOrderError(null);
    const orderPayload = { symbol: instrument.symbol, side: orderSide, order_type: orderType, quantity: qty };
    if (orderType === 'limit' && limitPrice) orderPayload.price = Number(limitPrice);
    const result = await placeOrder(orderPayload);
    setOrderLoading(false);
    if (result?.success) {
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); setShowOrderForm(false); setQuantity(''); }, 2000);
    } else {
      setOrderError(result?.error || 'Failed to place order');
    }
  };

  const adjustQuantity = (delta) => { setQuantity(String(Math.max(1, (Number(quantity) || 0) + delta))); };

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* ── Stock Selector Header ── */}
      <header className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-border z-20 flex-wrap">
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
      <div className="flex-1 relative overflow-hidden bg-surface">
        <LightweightChart symbol={instrument.symbol} timeframe={TIMEFRAMES[activeTimeframe].label} livePrice={instrument.price} />
      </div>

      {/* ── BUY / SELL Buttons ── */}
      <div className="flex gap-3 px-4 py-3 bg-surface-2 border-t border-border" style={{ paddingBottom: '72px' }}>
        <button onClick={handleOpenBuy} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-lg transition-colors active:scale-[0.98]">BUY</button>
        <button onClick={handleOpenSell} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-base rounded-lg transition-colors active:scale-[0.98]">SELL</button>
      </div>

      {/* ── Order Form (Full Screen Overlay) ── */}
      {showOrderForm && (
        <div className="fixed inset-0 z-[200] bg-surface flex flex-col animate-slideUp">
          {/* Header */}
          <div className={cn('flex items-center justify-between px-4 py-3', orderSide === 'buy' ? 'bg-emerald-600' : 'bg-red-600')}>
            <div className="flex items-center gap-3">
              <button onClick={() => setOrderSide('buy')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                  orderSide === 'buy' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white')}>
                <ShoppingCart size={14} /> BUY
              </button>
              <button onClick={() => setOrderSide('sell')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                  orderSide === 'sell' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white')}>
                <Tag size={14} /> SELL
              </button>
              <span className="text-white font-bold text-base ml-2">{instrument.symbol}</span>
            </div>
            <button onClick={() => setShowOrderForm(false)} className="p-1 text-white/80 hover:text-white"><X size={22} /></button>
          </div>

          {/* Insufficient Funds */}
          {bal < requiredMargin && (
            <div className={cn('flex items-center gap-3 px-4 py-3', orderSide === 'buy' ? 'bg-emerald-700' : 'bg-red-700')}>
              <AlertCircle size={20} className="text-white flex-shrink-0" />
              <p className="text-white text-sm font-semibold"><span className="font-bold">Insufficient funds:</span> Not enough balance.</p>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-surface">
            {/* Price Bar */}
            <div className="mx-4 mt-4 bg-surface-2 rounded-xl p-4 border border-border">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-[11px] text-blue-500 font-bold uppercase">Best Bid</p><p className="text-sm font-bold text-blue-500 mt-0.5">{currSymbol} {formatPrice(instrument.bid_price || instrument.price * 0.999)}</p></div>
                <div><p className="text-[11px] text-emerald-500 font-bold uppercase">LTP</p><p className="text-sm font-bold text-emerald-500 mt-0.5">{currSymbol} {formatPrice(instrument.price)}</p></div>
                <div><p className="text-[11px] text-text-muted font-bold uppercase">LTT</p><p className="text-sm font-bold text-text-primary mt-0.5">{ltt}</p></div>
                <div><p className="text-[11px] text-red-500 font-bold uppercase">Best Ask</p><p className="text-sm font-bold text-red-500 mt-0.5">{currSymbol} {formatPrice(instrument.ask_price || instrument.price * 1.001)}</p></div>
              </div>
            </div>

            {/* Product Type */}
            <div className="px-4 mt-5">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Product Type</h3>
              <div className="flex bg-surface-3 rounded-xl overflow-hidden">
                <button onClick={() => setProductType('intraday')}
                  className={cn('flex-1 py-3 text-sm font-bold text-center transition-colors rounded-xl',
                    productType === 'intraday' ? 'bg-gray-700 text-white' : 'text-text-muted')}>INTRADAY</button>
                <button onClick={() => setProductType('overnight')}
                  className={cn('flex-1 py-3 text-sm font-bold text-center transition-colors rounded-xl',
                    productType === 'overnight' ? 'bg-emerald-600 text-white' : 'text-text-muted')}>OVERNIGHT</button>
              </div>
            </div>

            {/* Order Type */}
            <div className="px-4 mt-5">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Order Type</h3>
              <div className="flex bg-surface-3 rounded-xl overflow-hidden">
                {[{ key: 'limit', label: 'LIMIT' }, { key: 'market', label: 'MARKET' }, { key: 'stop_loss', label: 'SL' }].map((t) => (
                  <button key={t.key} onClick={() => setOrderType(t.key)}
                    className={cn('flex-1 py-3 text-sm font-bold text-center transition-colors rounded-xl',
                      orderType === t.key ? 'bg-emerald-600 text-white' : 'text-text-muted')}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="px-4 mt-5">
              <div className="border-2 border-red-300 rounded-xl px-4 py-3 relative">
                <label className="absolute -top-2.5 left-3 bg-surface px-1 text-xs font-semibold text-red-500">Quantity</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-muted font-medium">Qty</span>
                  <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1"
                    className="flex-1 text-lg font-bold text-text-primary outline-none bg-transparent tabular-nums" />
                  <div className="flex items-center gap-1">
                    <button onClick={() => adjustQuantity(-1)} className="w-8 h-8 bg-surface-3 rounded-lg flex items-center justify-center hover:bg-surface-2"><Minus size={14} className="text-text-muted" /></button>
                    <button onClick={() => adjustQuantity(1)} className="w-8 h-8 bg-surface-3 rounded-lg flex items-center justify-center hover:bg-surface-2"><Plus size={14} className="text-text-muted" /></button>
                  </div>
                </div>
              </div>
              <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-red-600">Min. Purchase Amount: {currSymbol}450</p>
                <p className="text-xs font-semibold text-red-600">Min. Quantity: 5</p>
              </div>
            </div>

            {/* Limit Price */}
            {(orderType === 'limit' || orderType === 'stop_loss') && (
              <div className="px-4 mt-4">
                <div className="border border-border rounded-xl px-4 py-3 relative">
                  <label className="absolute -top-2.5 left-3 bg-surface px-1 text-xs font-semibold text-text-muted">Price</label>
                  <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={formatPrice(instrument.price)}
                    className="w-full text-lg font-bold text-text-primary outline-none bg-transparent tabular-nums" />
                </div>
              </div>
            )}

            {/* Required / Available */}
            <div className="px-4 mt-5 space-y-1">
              <div className="flex items-center gap-1"><span className="text-sm text-text-secondary">Required:</span><span className="text-sm font-bold text-red-500">{currSymbol}{requiredMargin.toFixed(2)}</span></div>
              <div className="flex items-center gap-1.5"><span className="text-sm text-text-secondary">Available:</span><span className="text-sm font-bold text-red-500">{currSymbol}{bal.toFixed(2)}</span><RefreshCw size={12} className="text-text-muted" /></div>
            </div>

            {/* Order Error */}
            {orderError && (
              <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-red-400">{orderError}</span>
              </div>
            )}

            {/* Place Order Button */}
            <div className="px-4 mt-5">
              <button onClick={handlePlaceOrder} disabled={!quantity || Number(quantity) <= 0 || orderLoading}
                className={cn('w-full py-3.5 rounded-xl text-base font-bold transition-colors',
                  (!quantity || Number(quantity) <= 0) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                    orderSide === 'buy' ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]' :
                      'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]')}>
                {orderLoading ? <Loader2 size={18} className="mx-auto animate-spin" /> :
                  showSuccess ? <span className="flex items-center justify-center gap-2"><Check size={18} /> Order Placed!</span> :
                    orderSide === 'buy' ? 'BUY' : 'SELL'}
              </button>
            </div>

            {/* Add Funds */}
            <div className="px-4 mt-3">
              <button onClick={() => { setShowOrderForm(false); navigate('/wallet'); }}
                className="w-full py-3 border border-border rounded-xl text-sm font-semibold text-blue-500 flex items-center justify-center gap-1.5 hover:bg-surface-2 transition-colors">
                <Plus size={14} /> Add Funds
              </button>
            </div>

            <div className="px-4 mt-4 mb-6">
              <div className="flex items-center justify-center gap-2 py-3 bg-surface-2 rounded-xl">
                <span className="text-green-500 text-sm">🟩</span>
                <span className="text-sm text-text-muted font-medium">In Marketwatch - Tap to manage</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
