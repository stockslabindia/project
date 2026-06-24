import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Info,
  BarChart2,
  Minus,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import SlideToConfirm from '../../components/ui/SlideToConfirm';
import { useTradeStore } from '../../store/useTradeStore';
import { getDynamicMarginRequired, getMinQuantity } from '../../utils/marginUtils';
import { formatCurrency, formatPercent, cn , formatPrice, getMarketStatus} from '../../utils/helpers';


const orderTypes = [
  { key: 'market', label: 'Market' },
  { key: 'limit', label: 'Limit' },
  { key: 'stop_loss', label: 'SL' },
];

const TradeHeader = memo(({ navigate }) => {
  const selectedInstrument = useTradeStore(state => state.selectedInstrument);
  const instrument = useTradeStore(useCallback(state => {
    const inst = state.instrumentsMap?.get(selectedInstrument?.symbol);
    if (inst) return inst;
    return selectedInstrument || state.instruments[0] || { symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: 0 };
  }, [selectedInstrument]));
  const marketStatus = getMarketStatus(instrument?.segment);
  const isIndianSegment = ['nse_equity', 'bse_equity', 'fo_futures', 'fo_options', 'mcx'].includes(instrument?.segment);
  const currSymbol = isIndianSegment ? '₹' : '$';

  return (
    <header className="sticky top-0 z-30 glass-heavy safe-top border-b border-border/30">
      <div className="max-w-lg mx-auto flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg hover:bg-surface transition-colors touch-active-subtle"
        >
          <ArrowLeft size={18} className="text-text-primary" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-base font-bold text-text-primary">{instrument.symbol}</h1>
            <span className={cn(
              'flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded',
              instrument.change >= 0 ? 'text-emerald-600 bg-emerald-500/8' : 'text-red-500 bg-red-500/8'
            )}>
              {instrument.change >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
              {formatPercent(instrument.changePercent)}
            </span>
            <span className={cn(
              'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider select-none shrink-0',
              marketStatus.color
            )}>
              {marketStatus.statusText}
            </span>
          </div>
          <p className="text-sm text-text-muted truncate">{instrument.name}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-extrabold text-text-primary tabular-nums leading-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {currSymbol}{formatPrice(instrument.price)}
          </p>
          <p className={cn(
            'text-sm font-semibold',
            (instrument.change || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
          )}>
            {(instrument.change || 0) >= 0 ? '+' : ''}{(instrument.change || 0) >= 100 ? (instrument.change || 0).toFixed(2) : (instrument.change || 0).toFixed(4)}
          </p>
        </div>
      </div>
    </header>
  );
});

const TradePriceStrip = memo(() => {
  const selectedInstrument = useTradeStore(state => state.selectedInstrument);
  const instrument = useTradeStore(useCallback(state => {
    const inst = state.instrumentsMap?.get(selectedInstrument?.symbol);
    if (inst) return inst;
    return selectedInstrument || state.instruments[0] || { symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: 0 };
  }, [selectedInstrument]));

  return (
    <div className="px-3 py-3 bg-surface-2 border-b border-border/30">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'BID', value: instrument.bid_price, color: 'text-emerald-400' },
          { label: 'ASK', value: instrument.ask_price, color: 'text-red-400' },
          { label: 'SPREAD', value: instrument.spread, color: 'text-text-muted' },
          { label: 'VOL', value: instrument.volume, color: 'text-text-secondary' },
        ].map(item => (
          <div key={item.label} className="text-center">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{item.label}</p>
            <p className={cn('text-sm font-bold tabular-nums', item.color)}>
              {typeof item.value === 'number'
                ? (item.value >= 100 ? item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : item.value.toFixed(item.value < 1 ? 5 : 3))
                : '--'}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        {[
          { label: 'OPEN', value: instrument.open || instrument.day_open },
          { label: 'HIGH', value: instrument.high || instrument.day_high, color: 'text-emerald-400' },
          { label: 'LOW', value: instrument.low || instrument.day_low, color: 'text-red-400' },
          { label: 'CLOSE', value: instrument.price },
        ].map(item => (
          <div key={item.label} className="text-center">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{item.label}</p>
            <p className={cn('text-sm font-bold tabular-nums', item.color || 'text-text-primary')}>
              {typeof item.value === 'number'
                ? (item.value >= 100 ? item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : item.value.toFixed(item.value < 1 ? 5 : 3))
                : '--'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});

const MarketDepthComponent = memo(() => {
  const selectedInstrument = useTradeStore(state => state.selectedInstrument);
  const instrument = useTradeStore(useCallback(state => {
    const inst = state.instrumentsMap?.get(selectedInstrument?.symbol);
    if (inst) return inst;
    return selectedInstrument || state.instruments[0] || { symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: 0 };
  }, [selectedInstrument]));

  const [depthData, setDepthData] = useState({ bids: [], asks: [], totalBidQty: 0, totalAskQty: 0 });

  useEffect(() => {
    if (!instrument || !instrument.price) return;

    const price = instrument.price;
    const bidPrice = instrument.bid || instrument.bid_price || price * 0.9998;
    const askPrice = instrument.ask || instrument.ask_price || price * 1.0002;
    const tickSize = price > 1000 ? 0.5 : price > 100 ? 0.05 : price > 1 ? 0.01 : 0.0001;

    const bids = [];
    let totalBidQty = 0;
    for (let i = 0; i < 5; i++) {
      const levelPrice = bidPrice - (i * tickSize);
      const baseVol = Math.floor((1500 - (i * 200)) * (1 + (Math.sin(price + i) * 0.1)));
      const orders = Math.floor((12 - i) * (1 + (Math.cos(price - i) * 0.15)));
      bids.push({
        price: levelPrice,
        quantity: Math.max(10, baseVol),
        orders: Math.max(1, orders)
      });
      totalBidQty += baseVol;
    }

    const asks = [];
    let totalAskQty = 0;
    for (let i = 0; i < 5; i++) {
      const levelPrice = askPrice + (i * tickSize);
      const baseVol = Math.floor((1450 - (i * 180)) * (1 + (Math.cos(price + i) * 0.12)));
      const orders = Math.floor((11 - i) * (1 + (Math.sin(price - i) * 0.18)));
      asks.push({
        price: levelPrice,
        quantity: Math.max(10, baseVol),
        orders: Math.max(1, orders)
      });
      totalAskQty += baseVol;
    }

    setDepthData({ bids, asks, totalBidQty, totalAskQty });
  }, [instrument.price, instrument.bid_price, instrument.ask_price]);

  return (
    <div className="bg-surface-2 p-3 rounded-xl border border-border/30 space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-text-muted uppercase tracking-wider">
        <span>Market Depth</span>
        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded animate-pulse">Live Feed</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 pt-1">
        {/* Bids Header */}
        <div className="grid grid-cols-3 text-[10px] text-text-muted font-bold pb-1 border-b border-border/20">
          <span>Bid Price</span>
          <span className="text-right">Orders</span>
          <span className="text-right">Qty</span>
        </div>
        {/* Asks Header */}
        <div className="grid grid-cols-3 text-[10px] text-text-muted font-bold pb-1 border-b border-border/20">
          <span>Ask Price</span>
          <span className="text-right">Orders</span>
          <span className="text-right">Qty</span>
        </div>

        {/* Bids List */}
        <div className="space-y-0.5 mt-1">
          {depthData.bids.map((bid, idx) => {
            const pct = depthData.totalBidQty > 0 ? (bid.quantity / depthData.totalBidQty) * 100 : 0;
            return (
              <div key={`bid-${idx}`} className="orderbook-row grid grid-cols-3 relative">
                <div className="orderbook-bar orderbook-bar-bid" style={{ width: `${pct}%` }} />
                <span className="text-[#00df82] z-10">{formatPrice(bid.price)}</span>
                <span className="text-right text-text-secondary z-10 pr-1">{bid.orders}</span>
                <span className="text-right text-text-primary z-10 font-bold">{bid.quantity}</span>
              </div>
            );
          })}
        </div>

        {/* Asks List */}
        <div className="space-y-0.5 mt-1">
          {depthData.asks.map((ask, idx) => {
            const pct = depthData.totalAskQty > 0 ? (ask.quantity / depthData.totalAskQty) * 100 : 0;
            return (
              <div key={`ask-${idx}`} className="orderbook-row grid grid-cols-3 relative">
                <div className="orderbook-bar orderbook-bar-ask" style={{ width: `${pct}%` }} />
                <span className="text-[#ff3b69] z-10">{formatPrice(ask.price)}</span>
                <span className="text-right text-text-secondary z-10 pr-1">{ask.orders}</span>
                <span className="text-right text-text-primary z-10 font-bold">{ask.quantity}</span>
              </div>
            );
          })}
        </div>
      </div>

      {depthData.totalBidQty + depthData.totalAskQty > 0 && (() => {
        const total = depthData.totalBidQty + depthData.totalAskQty;
        const bidPct = (depthData.totalBidQty / total) * 100;
        const askPct = (depthData.totalAskQty / total) * 100;
        return (
          <div className="space-y-1 pt-1.5 border-t border-border/20">
            <div className="flex justify-between text-[10px] font-extrabold">
              <span className="text-[#00df82]">{bidPct.toFixed(1)}% Bids ({depthData.totalBidQty})</span>
              <span className="text-[#ff3b69]">{askPct.toFixed(1)}% Asks ({depthData.totalAskQty})</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden flex bg-surface-3">
              <div className="h-full bg-[#00df82] transition-all duration-300" style={{ width: `${bidPct}%` }} />
              <div className="h-full bg-[#ff3b69] transition-all duration-300" style={{ width: `${askPct}%` }} />
            </div>
          </div>
        );
      })()}
    </div>
  );
});

const OrderSummaryBox = memo(({ quantity, productType }) => {
  const selectedInstrument = useTradeStore(state => state.selectedInstrument);
  const instrument = useTradeStore(useCallback(state => {
    const inst = state.instrumentsMap?.get(selectedInstrument?.symbol);
    if (inst) return inst;
    return selectedInstrument || state.instruments[0] || { symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: 0 };
  }, [selectedInstrument]));
  const wallet = useTradeStore(state => state.wallet);

  if (!quantity || Number(quantity) <= 0) return null;

  const isIndianSegment = ['nse_equity', 'bse_equity', 'fo_futures', 'fo_options', 'mcx'].includes(instrument?.segment);
  const currSymbol = isIndianSegment ? '₹' : '$';

  const totalValue = quantity ? (Number(quantity) * instrument.price) : 0;
  const dynamicMarginPct = getDynamicMarginRequired(instrument, productType);
  const marginFactor = dynamicMarginPct / 100;
  const estimatedMargin = totalValue * marginFactor;
  const availableMargin = wallet?.availableMargin || 0;
  const isInsufficientMargin = availableMargin < estimatedMargin;
  const leverageMultiplier = Math.round(100 / dynamicMarginPct);

  return (
    <div className="bg-surface rounded-xl p-3 border border-border/30 space-y-1.5">
      <div className="flex items-center gap-1 mb-1">
        <Info size={11} className="text-text-muted" />
        <span className="text-base font-bold text-text-muted uppercase tracking-wider">Summary</span>
      </div>
      <div className="data-row py-1">
        <span className="data-label">Quantity × Price</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">
          {quantity} × {currSymbol}{formatPrice(instrument.price)}
        </span>
      </div>
      <div className="data-row py-1">
        <span className="data-label">Total Value</span>
        <span className="text-sm font-extrabold text-text-primary tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {formatCurrency(totalValue)}
        </span>
      </div>
      <div className="data-row py-1 border-t border-border/20 pt-1.5">
        <span className="data-label">Available Margin</span>
        <span className="text-sm font-bold text-text-primary tabular-nums">
          {formatCurrency(availableMargin)}
        </span>
      </div>
      <div className="data-row py-1">
        <span className="data-label">Margin Required ({leverageMultiplier}x)</span>
        <span className={cn("text-sm font-black tabular-nums", isInsufficientMargin ? "text-red-500 animate-pulse" : "text-primary")}>
          {formatCurrency(estimatedMargin)}
        </span>
      </div>
      {isInsufficientMargin && (
        <div className="mt-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-start gap-2 animate-pulse">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <span>Insufficient margin to place this order. Please deposit funds or close other positions.</span>
        </div>
      )}
    </div>
  );
});

const TradeStickyActionBar = memo(({ quantity, orderSide, handleConfirmOrder, isBracket, getBracketValidationError }) => {
  const selectedInstrument = useTradeStore(state => state.selectedInstrument);
  const instrument = useTradeStore(useCallback(state => {
    const inst = state.instrumentsMap?.get(selectedInstrument?.symbol);
    if (inst) return inst;
    return selectedInstrument || state.instruments[0] || { symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: 0 };
  }, [selectedInstrument]));
  const wallet = useTradeStore(state => state.wallet);
  const debugStats = useTradeStore(state => state.debugStats);

  if (!quantity || Number(quantity) <= 0) {
    return (
      <div className="sticky-action-bar max-w-lg mx-auto" style={{ bottom: '64px' }}>
        <Button
          fullWidth
          size="xl"
          variant={orderSide === 'buy' ? 'success' : 'danger'}
          disabled
          className="text-base font-extrabold tracking-wide"
        >
          Enter Quantity to {orderSide === 'buy' ? 'Buy' : 'Sell'}
        </Button>
      </div>
    );
  }

  const totalValue = quantity ? (Number(quantity) * instrument.price) : 0;
  const marginFactor = instrument.margin_required ? parseFloat(instrument.margin_required) / 100 : 1.0;
  const estimatedMargin = totalValue * marginFactor;
  const availableMargin = wallet?.availableMargin || 0;
  const isInsufficientMargin = availableMargin < estimatedMargin;

  return (
    <div className="sticky-action-bar max-w-lg mx-auto" style={{ bottom: '64px' }}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-base px-1">
          <span className="text-text-muted font-medium flex items-center gap-1.5">
            {isBracket && (
              <span className="bg-amber-500 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider leading-none">BO</span>
            )}
            {orderSide.toUpperCase()} {quantity} {instrument.symbol}
          </span>
          <span className="font-bold text-text-primary" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {formatCurrency(totalValue)}
          </span>
        </div>
        <div className={cn(debugStats?.staleWarning ? 'opacity-80' : '')}>
          {debugStats?.staleWarning && (
            <div className="text-center text-xs text-orange-500 font-bold mb-2">
              Market feed delayed. Execution price may vary.
            </div>
          )}
          <SlideToConfirm
            onConfirm={handleConfirmOrder}
            label={`Slide to ${orderSide === 'buy' ? 'Buy' : 'Sell'} ${instrument.symbol}`}
            variant={orderSide === 'buy' ? 'success' : 'danger'}
            disabled={isInsufficientMargin || !!getBracketValidationError()}
          />
        </div>
      </div>
    </div>
  );
});

export default function Trade() {
  // Use static instrument info from selectedInstrument (doesn't change on every tick)
  const selectedInstrument = useTradeStore(state => state.selectedInstrument);
  
  const orderType = useTradeStore(state => state.orderType);
  const setOrderType = useTradeStore(state => state.setOrderType);
  const orderSide = useTradeStore(state => state.orderSide);
  const setOrderSide = useTradeStore(state => state.setOrderSide);
  const quantity = useTradeStore(state => state.quantity);
  const setQuantity = useTradeStore(state => state.setQuantity);
  const placeOrder = useTradeStore(state => state.placeOrder);
  const orderLoading = useTradeStore(state => state.orderLoading);
  const updateSubscriptions = useTradeStore(state => state.updateSubscriptions);
  const setSystemBanner = useTradeStore(state => state.setSystemBanner);
  const navigate = useNavigate();
  
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [isBracket, setIsBracket] = useState(false);
  const [productType, setProductType] = useState('intraday');
  const [orderError, setOrderError] = useState(null);

  // We use the static selectedInstrument for non-price-sensitive details
  const instrument = selectedInstrument || { symbol: 'LOADING', name: '', price: 0, change: 0, changePercent: 0, high: 0, low: 0, volume: 0, segment: '' };

  // Ensure we're subscribed to the selected instrument's price feed
  useEffect(() => {
    if (selectedInstrument?.symbol) {
      updateSubscriptions();
    }
  }, [selectedInstrument?.symbol, updateSubscriptions]);

  const totalValue = quantity ? (Number(quantity) * instrument.price) : 0;
  const marginFactor = instrument.margin_required ? parseFloat(instrument.margin_required) / 100 : 1.0;
  const estimatedMargin = totalValue * marginFactor;

  const getBracketValidationError = useCallback(() => {
    if (!isBracket) return null;
    const entry = (orderType === 'market' ? instrument.price : Number(limitPrice)) || 0;
    const slVal = Number(stopLoss);
    const tgtVal = Number(takeProfit);

    if (!quantity || Number(quantity) <= 0) return 'Quantity is required.';
    if ((orderType === 'limit' || orderType === 'stop_loss') && !limitPrice) return 'Price is required.';
    if (!stopLoss || !takeProfit) return 'Both Stop Loss and Target are required in Bracket Order mode.';
    
    if (orderSide === 'buy') {
      if (slVal >= entry) return 'Stop Loss must be below entry price.';
      if (tgtVal <= entry) return 'Target must be above entry price.';
    } else {
      if (slVal <= entry) return 'Stop Loss must be above entry price.';
      if (tgtVal >= entry) return 'Target must be below entry price.';
    }
    return null;
  }, [isBracket, orderType, instrument.price, limitPrice, stopLoss, takeProfit, quantity, orderSide]);

  const handleConfirmOrder = useCallback(() => {
    setOrderError(null);
    const validationError = getBracketValidationError();
    if (validationError) {
      setOrderError(validationError);
      return;
    }

    const orderData = {
      symbol: instrument.symbol,
      side: orderSide,
      quantity: Number(quantity),
      order_type: orderType,
      is_bracket: isBracket,
      product_type: productType,
    };
    if (orderType === 'limit' && limitPrice) {
      orderData.price = Number(limitPrice);
    }
    if (orderType === 'stop_loss' && limitPrice) {
      orderData.trigger_price = Number(limitPrice);
    }
    if (isBracket) {
      orderData.stop_loss = Number(stopLoss);
      orderData.take_profit = Number(takeProfit);
    }

    // Navigate INSTANTLY — don't wait for the API round-trip
    setQuantity('');
    setLimitPrice('');
    setStopLoss('');
    setTakeProfit('');
    setIsBracket(false);
    setProductType('intraday');
    navigate('/positions');

    // Fire the order in the background (result handled via websocket notification or error banner)
    placeOrder(orderData).then((res) => {
      if (res && res.success === false) {
        setSystemBanner({
          type: 'alert',
          title: 'Order Failed',
          message: res.error || 'Failed to place order'
        });
      }
    });
  }, [getBracketValidationError, instrument.symbol, orderSide, quantity, orderType, isBracket, limitPrice, stopLoss, takeProfit, navigate, productType]);

  const adjustQuantity = (delta) => {
    const current = Number(quantity) || 0;
    const newQty = Math.max(0, current + delta);
    setQuantity(newQty > 0 ? String(newQty) : '');
  };

  const isIndianSegment = ['nse_equity', 'bse_equity', 'fo_futures', 'fo_options', 'mcx'].includes(instrument.segment);
  const currSymbol = isIndianSegment ? '₹' : '$';
  const minQty = getMinQuantity(instrument, productType);
  
  // Generate smart quick-quantity buttons starting from minQty
  const quickQtyButtons = (() => {
    if (minQty <= 1) return [1, 5, 10, 25, 50, 100];
    const base = minQty;
    const multipliers = [1, 2, 5, 10, 25, 50];
    return multipliers.map(m => base * m).filter(q => q <= base * 100).slice(0, 6);
  })();
  
  return (
    <div className="">
      {/* Compact Header */}
      <TradeHeader navigate={navigate} />

      {/* Compact Price Info Strip (replaces chart) */}
      <TradePriceStrip />

      {/* Trading Panel */}
      <div className="px-3 space-y-2.5 py-3 pb-44">

        {/* Live Level 2 Market Depth Component */}
        <MarketDepthComponent />

        {/* Buy/Sell Toggle — Large impact */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setOrderSide('buy')}
            className={cn(
              'py-3.5 rounded-xl text-base font-extrabold tracking-wide transition-all duration-200',
              orderSide === 'buy'
                ? 'bg-[#00b852] text-white shadow-lg shadow-emerald-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            )}
          >
            ▲ BUY
          </button>
          <button
            onClick={() => setOrderSide('sell')}
            className={cn(
              'py-3.5 rounded-xl text-base font-extrabold tracking-wide transition-all duration-200',
              orderSide === 'sell'
                ? 'bg-[#ef4444] text-white shadow-lg shadow-red-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            )}
          >
            ▼ SELL
          </button>
        </div>

        {/* Product Type Toggle */}
        <div className="bg-surface-2 p-1 rounded-xl border border-border/30 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setProductType('intraday')}
            className={cn(
              "py-2 rounded-lg text-sm font-extrabold transition-all duration-200",
              productType === 'intraday'
                ? "bg-surface-3 text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            INTRADAY <span className="text-[10px] font-semibold opacity-75">(MIS)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setProductType('overnight');
              setIsBracket(false);
            }}
            className={cn(
              "py-2 rounded-lg text-sm font-extrabold transition-all duration-200",
              productType === 'overnight'
                ? "bg-surface-3 text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            OVERNIGHT <span className="text-[10px] font-semibold opacity-75">(NRML)</span>
          </button>
        </div>

        {/* Order Type */}
        <Tabs tabs={orderTypes} activeTab={orderType} onChange={setOrderType} compact />

        {/* Bracket Order (BO) Toggle Switch */}
        <div className={cn(
          "flex items-center justify-between bg-surface-2 border border-border/30 rounded-xl px-3 py-2.5 transition-all",
          productType === 'overnight' && "opacity-50"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", isBracket ? "bg-amber-500 animate-pulse" : "bg-text-muted/40")} />
            <div>
              <p className="text-sm font-extrabold text-text-primary">Bracket Order (BO)</p>
              <p className="text-[10px] font-bold text-text-muted">
                {productType === 'overnight' 
                  ? "BO is not available for Overnight orders" 
                  : "Place with automatic Target & Stop Loss legs"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={productType === 'overnight'}
            onClick={() => setIsBracket(!isBracket)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isBracket ? "bg-amber-500" : "bg-surface-3",
              productType === 'overnight' && "cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isBracket ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Quantity with +/- */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-base font-semibold text-text-muted uppercase tracking-wider">Quantity</label>
            {minQty > 1 && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                Min: {minQty} qty ({currSymbol}400 capital)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustQuantity(-1)}
              className="w-10 h-10 rounded-xl bg-surface border border-border/50 flex items-center justify-center touch-active-subtle hover:bg-surface"
            >
              <Minus size={16} className="text-text-secondary" />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={minQty > 1 ? String(minQty) : '0'}
              className="flex-1 bg-surface border border-border/50 rounded-xl px-3 py-2.5 text-center text-base font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button
              onClick={() => adjustQuantity(1)}
              className="w-10 h-10 rounded-xl bg-surface border border-border/50 flex items-center justify-center touch-active-subtle hover:bg-surface"
            >
              <Plus size={16} className="text-text-secondary" />
            </button>
          </div>
          {/* Quick quantity buttons */}
          <div className="flex gap-1 mt-1">
            {quickQtyButtons.map(q => (
              <button
                key={q}
                onClick={() => setQuantity(String(q))}
                className={cn(
                  'flex-1 py-1 text-base font-semibold rounded-lg transition-all',
                  Number(quantity) === q
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-muted hover:bg-surface-2'
                )}
              >
                {q >= 1000 ? `${(q/1000).toFixed(q % 1000 === 0 ? 0 : 1)}k` : q}
              </button>
            ))}
          </div>
          {/* Below-minimum warning */}
          {quantity && Number(quantity) > 0 && Number(quantity) < minQty && (
            <p className="text-[10px] font-bold text-red-400 flex items-center gap-1 mt-0.5">
              <AlertTriangle size={10} className="shrink-0" />
              Below minimum ({minQty} qty). Order will be rejected.
            </p>
          )}
        </div>

        {/* Limit / SL Price */}
        {orderType === 'limit' && (
          <Input
            label="Limit Price"
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="Enter limit price"
            prefix={isIndianSegment ? '₹' : '$'}
            compact
          />
        )}

        {orderType === 'stop_loss' && (
          <Input
            label="Stop Loss Price"
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="Enter stop loss price"
            prefix={isIndianSegment ? '₹' : '$'}
            compact
          />
        )}

        {/* Stop Loss & Target Profit (Optional / Conditional) */}
        {isBracket && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 bg-surface-2 p-3 rounded-xl border border-border/30">
              <Input
                label="Stop Loss (SL)"
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Required"
                prefix={isIndianSegment ? '₹' : '$'}
                compact
              />
              <Input
                label="Target (TGT)"
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="Required"
                prefix={isIndianSegment ? '₹' : '$'}
                compact
              />
            </div>

            {/* Risk:Reward ratio and validations */}
            {(() => {
              const entry = (orderType === 'market' ? instrument.price : Number(limitPrice)) || 0;
              const slVal = Number(stopLoss);
              const tgtVal = Number(takeProfit);
              
              if (!entry) return null;
              
              let errorMsg = '';
              let rrRatio = '';
              
              if (stopLoss && takeProfit) {
                if (orderSide === 'buy') {
                  if (slVal >= entry) {
                    errorMsg = 'SL must be below entry price for BUY.';
                  } else if (tgtVal <= entry) {
                    errorMsg = 'Target must be above entry price for BUY.';
                  }
                } else {
                  if (slVal <= entry) {
                    errorMsg = 'SL must be above entry price for SELL.';
                  } else if (tgtVal >= entry) {
                    errorMsg = 'Target must be below entry price for SELL.';
                  }
                }
                
                if (!errorMsg) {
                  const risk = Math.abs(entry - slVal);
                  const reward = Math.abs(entry - tgtVal);
                  if (risk > 0) {
                    rrRatio = `1 : ${(reward / risk).toFixed(2)}`;
                  }
                }
              }
              
              return (
                <div className="flex flex-col gap-1 px-1">
                  {errorMsg ? (
                    <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                      <AlertTriangle size={12} className="shrink-0" /> {errorMsg}
                    </p>
                  ) : rrRatio ? (
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>✓ Legs Configured Successfully</span>
                      <span>Risk:Reward = {rrRatio}</span>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                      <Info size={10} /> Enter both targets to see the Risk:Reward ratio.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Order Summary */}
        <OrderSummaryBox quantity={quantity} productType={productType} />

        {/* Order Error */}
        {orderError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <span className="text-base font-semibold text-red-700">{orderError}</span>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <TradeStickyActionBar
        quantity={quantity}
        orderSide={orderSide}
        handleConfirmOrder={handleConfirmOrder}
        isBracket={isBracket}
        getBracketValidationError={getBracketValidationError}
      />
    </div>
  );
}
