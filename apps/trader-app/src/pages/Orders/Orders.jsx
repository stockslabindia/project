import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, X, Calendar, ClipboardList, Zap, Edit3 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, cn , formatPrice} from '../../utils/helpers';
import { usePullToRefresh, PullIndicator } from '../../hooks/usePullToRefresh';

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  filled: { icon: CheckCircle2, label: 'Filled', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  cancelled: { icon: XCircle, label: 'Cancelled', color: 'text-text-muted', bg: 'bg-surface-3' },
};

function ModifyOrderForm({ order, onClose }) {
  const { modifyOrder, updatePositionSlTgt, positions } = useTradeStore();
  const [qty, setQty] = useState(String(order.quantity));
  const [price, setPrice] = useState(String(order.price || order.trigger_price || ''));
  const [stopLoss, setStopLoss] = useState(order.is_bracket_order ? String(order.stop_loss || '') : '');
  const [takeProfit, setTakeProfit] = useState(order.is_bracket_order ? String(order.take_profit || '') : '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (order.isVirtual) {
        // Find position
        const pos = positions.find(p => p.id === order.positionId);
        if (!pos) throw new Error('Open position not found');

        const newPrice = Number(price);
        if (isNaN(newPrice) || newPrice <= 0) {
          throw new Error('Please enter a valid trigger price');
        }

        const newSl = order.virtualType === 'sl' ? newPrice : pos.stop_loss;
        const newTgt = order.virtualType === 'tgt' ? newPrice : (pos.take_profit || pos.target);

        await updatePositionSlTgt(pos.id, newSl, newTgt);
      } else {
        const newQty = Number(qty);
        const newPrice = Number(price);

        if (isNaN(newQty) || newQty <= 0) throw new Error('Please enter a valid quantity');
        if (isNaN(newPrice) || newPrice <= 0) throw new Error('Please enter a valid price');

        const payload = { quantity: newQty, price: newPrice };

        if (order.is_bracket_order) {
          const slVal = Number(stopLoss);
          const tgtVal = Number(takeProfit);
          if (isNaN(slVal) || slVal <= 0) throw new Error('Please enter a valid Stop Loss price');
          if (isNaN(tgtVal) || tgtVal <= 0) throw new Error('Please enter a valid Target price');

          const side = (order.side || '').toLowerCase();
          if (side === 'buy') {
            if (slVal >= newPrice) throw new Error('Stop Loss must be below limit price for BUY.');
            if (tgtVal <= newPrice) throw new Error('Target must be above limit price for BUY.');
          } else {
            if (slVal <= newPrice) throw new Error('Stop Loss must be above limit price for SELL.');
            if (tgtVal >= newPrice) throw new Error('Target must be below limit price for SELL.');
          }

          payload.stop_loss = slVal;
          payload.take_profit = tgtVal;
        }

        const res = await modifyOrder(order.id, payload);
        if (!res.success) throw new Error(res.error || 'Failed to modify order');
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-2.5 font-medium animate-shake">
          {error}
        </div>
      )}
      <div className="bg-surface rounded-xl p-3.5 space-y-3">
        <div className="flex justify-between text-xs border-b border-border/10 pb-2">
          <span className="text-text-muted">Instrument</span>
          <span className="font-bold text-text-primary">{order.symbol}</span>
        </div>
        <div className="flex justify-between text-xs border-b border-border/10 pb-2">
          <span className="text-text-muted">Type</span>
          <span className="font-bold text-text-primary capitalize">
            {order.is_bracket_order ? 'Bracket Order' : order.type}
          </span>
        </div>

        {/* Quantity Field (only editable for real orders) */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">Quantity</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={order.isVirtual || loading}
            required
            className="w-full bg-surface-2 border border-border/40 rounded-xl px-3 py-2 text-sm font-bold text-text-primary focus:outline-none focus:border-primary/50 disabled:opacity-50"
          />
        </div>

        {/* Price Field */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">
            {order.type?.includes('LOSS') || order.type?.includes('SL') ? 'Trigger Price' : 'Limit Price'}
          </label>
          <input
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={loading}
            required
            className="w-full bg-surface-2 border border-border/40 rounded-xl px-3 py-2 text-sm font-bold text-text-primary focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Bracket Fields */}
        {order.is_bracket_order && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/10">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">Stop Loss</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-surface-2 border border-border/40 rounded-xl px-3 py-2 text-sm font-bold text-text-primary focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider">Target</label>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-surface-2 border border-border/40 rounded-xl px-3 py-2 text-sm font-bold text-text-primary focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" fullWidth size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" variant="primary" fullWidth size="md" disabled={loading}>
          {loading ? 'Modifying...' : 'Modify'}
        </Button>
      </div>
    </form>
  );
}

export default function Orders() {
  const { activeOrderTab, setActiveOrderTab, getFilteredOrders, cancelOrder, orders, fetchOrders, positions, updatePositionSlTgt, tradeHistory, fetchHistory } = useTradeStore();
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [modifyingOrder, setModifyingOrder] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Synthesize virtual SL/TGT orders from open positions
  const virtualOrders = [];
  positions.forEach(pos => {
    if (pos.stop_loss) {
      virtualOrders.push({
        id: `v-sl-${pos.id}`,
        positionId: pos.id,
        symbol: pos.symbol,
        side: pos.type === 'BUY' ? 'SELL' : 'BUY',
        type: 'STOP LOSS',
        quantity: pos.quantity,
        price: pos.stop_loss,
        status: 'pending',
        isVirtual: true,
        virtualType: 'sl',
        createdAt: pos.opened_at || pos.created_at,
      });
    }
    if (pos.take_profit || pos.target) {
      virtualOrders.push({
        id: `v-tgt-${pos.id}`,
        positionId: pos.id,
        symbol: pos.symbol,
        side: pos.type === 'BUY' ? 'SELL' : 'BUY',
        type: 'TARGET',
        quantity: pos.quantity,
        price: pos.take_profit || pos.target,
        status: 'pending',
        isVirtual: true,
        virtualType: 'tgt',
        createdAt: pos.opened_at || pos.created_at,
      });
    }
  });

  const dbOrders = getFilteredOrders();
  let filteredOrders = dbOrders;
  if (activeOrderTab === 'open') {
    filteredOrders = [...dbOrders, ...virtualOrders];
    filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (activeOrderTab === 'trades') {
    filteredOrders = tradeHistory;
  }

  const openCount = orders.filter((o) => o.status === 'pending').length + virtualOrders.length;
  const filledCount = orders.filter((o) => o.status === 'filled').length;
  const cancelledCount = orders.filter((o) => o.status === 'cancelled').length;

  const fetchWallet = useTradeStore(s => s.fetchWallet);

  const { containerProps, isRefreshing, pullProgress } = usePullToRefresh(async () => {
    const fetchPositions = useTradeStore.getState().fetchPositions;
    await Promise.all([fetchOrders(), fetchWallet(), fetchPositions(), fetchHistory()]);
  });

  const handleCancelOrder = () => {
    if (cancellingOrder) {
      if (cancellingOrder.isVirtual) {
        const pos = positions.find(p => p.id === cancellingOrder.positionId);
        if (pos) {
          const newSl = cancellingOrder.virtualType === 'sl' ? null : pos.stop_loss;
          const newTgt = cancellingOrder.virtualType === 'tgt' ? null : (pos.take_profit || pos.target);
          updatePositionSlTgt(pos.id, newSl, newTgt);
        }
      } else {
        cancelOrder(cancellingOrder.id);
      }
      setCancellingOrder(null);
    }
  };

  const fmtTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="bg-surface min-h-full" {...containerProps}>
      <PullIndicator isRefreshing={isRefreshing} progress={pullProgress} />
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-text-primary">Orders</h1>
      </div>

      <div className="px-4 pb-20">
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <button onClick={() => setActiveOrderTab('open')}
            className={cn('bg-surface-2 rounded-xl border p-2 text-left transition-all', activeOrderTab === 'open' ? 'border-amber-500/40' : 'border-border')}>
            <div className="flex items-center gap-1.5 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><p className="text-[9px] text-text-muted font-bold uppercase">Open</p></div>
            <p className={cn('text-lg font-bold tabular-nums', openCount > 0 ? 'text-amber-400' : 'text-text-muted')}>{openCount}</p>
          </button>
          <button onClick={() => setActiveOrderTab('filled')}
            className={cn('bg-surface-2 rounded-xl border p-2 text-left transition-all', activeOrderTab === 'filled' ? 'border-emerald-500/40' : 'border-border')}>
            <div className="flex items-center gap-1.5 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><p className="text-[9px] text-text-muted font-bold uppercase">Filled</p></div>
            <p className="text-lg font-bold text-text-muted tabular-nums">{filledCount}</p>
          </button>
          <button onClick={() => setActiveOrderTab('cancelled')}
            className={cn('bg-surface-2 rounded-xl border p-2 text-left transition-all', activeOrderTab === 'cancelled' ? 'border-border' : 'border-border')}>
            <div className="flex items-center gap-1.5 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-500" /><p className="text-[9px] text-text-muted font-bold uppercase">Cancelled</p></div>
            <p className="text-lg font-bold text-text-muted tabular-nums">{cancelledCount}</p>
          </button>
          <button onClick={() => setActiveOrderTab('trades')}
            className={cn('bg-surface-2 rounded-xl border p-2 text-left transition-all', activeOrderTab === 'trades' ? 'border-blue-500/40' : 'border-border')}>
            <div className="flex items-center gap-1.5 mb-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><p className="text-[9px] text-text-muted font-bold uppercase">Trades</p></div>
            <p className={cn('text-lg font-bold tabular-nums', tradeHistory.length > 0 ? 'text-blue-400' : 'text-text-muted')}>{tradeHistory.length}</p>
          </button>
        </div>

        <div className="mt-2">
          {filteredOrders.length > 0 ? (
            <div className="space-y-2">
              {filteredOrders.map((order) => {
                if (activeOrderTab === 'trades') {
                  const trade = order;
                  const isProfit = trade.pnl >= 0;
                  return (
                    <div key={trade.id} className="bg-surface-2 rounded-xl border border-border p-3.5 overflow-hidden">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded',
                            trade.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{trade.type}</span>
                          <p className="text-sm font-bold text-text-primary">{trade.symbol}</p>
                          <span className="text-[10px] text-text-muted font-medium px-1.5 py-0.5 bg-surface rounded">REALIZED</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className={cn('text-sm font-extrabold tabular-nums', isProfit ? 'text-emerald-400' : 'text-red-400')}>
                            {isProfit ? '+' : ''}{formatCurrency(trade.pnl)}
                          </span>
                          <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5 font-medium">
                            <Calendar size={8} />
                            {fmtTime(trade.closed_at || trade.closedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div><p className="text-[10px] text-text-muted font-medium uppercase">Qty</p><p className="text-xs font-bold text-text-secondary tabular-nums">{trade.quantity}</p></div>
                          <div><p className="text-[10px] text-text-muted font-medium uppercase">Entry</p><p className="text-xs font-bold text-text-secondary tabular-nums">{formatPrice(trade.entryPrice)}</p></div>
                          <div><p className="text-[10px] text-text-muted font-medium uppercase">Exit</p><p className="text-xs font-bold text-text-primary tabular-nums">{formatPrice(trade.exitPrice)}</p></div>
                          <div><p className="text-[10px] text-text-muted font-medium uppercase">Value</p><p className="text-xs font-bold text-text-secondary tabular-nums">{formatCurrency(trade.exitPrice * trade.quantity)}</p></div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const config = statusConfig[order.status];
                const StatusIcon = config.icon;
                const isOpen = order.status === 'pending';
                return (
                  <div key={order.id} className="bg-surface-2 rounded-xl border border-border p-3.5 overflow-hidden">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded',
                          order.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{order.side}</span>
                        <p className="text-sm font-bold text-text-primary">{order.symbol}</p>
                        <span className="text-[10px] text-text-muted font-medium px-1.5 py-0.5 bg-surface rounded capitalize">{order.tag || order.type}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded', config.bg)}>
                            <StatusIcon size={10} className={config.color} /><span className={cn('text-[10px] font-bold', config.color)}>{config.label}</span>
                          </div>
                          {isOpen && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => setModifyingOrder(order)} className="p-1 hover:bg-blue-500/10 rounded transition-colors" title="Modify Order">
                                <Edit3 size={14} className="text-blue-400" />
                              </button>
                              <button onClick={() => setCancellingOrder(order)} className="p-1 hover:bg-red-500/10 rounded transition-colors" title="Cancel Order">
                                <X size={14} className="text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted flex items-center gap-1 font-medium">
                          <Calendar size={8} />
                          {fmtTime(order.filledAt || order.cancelledAt || order.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div><p className="text-[10px] text-text-muted font-medium uppercase">Qty</p><p className="text-xs font-bold text-text-secondary tabular-nums">{order.quantity}</p></div>
                        <div>
                          <p className="text-[10px] text-text-muted font-medium uppercase">Price</p>
                          <p className="text-xs font-bold text-text-primary tabular-nums">
                            {formatPrice(order.status === 'filled' ? (order.executed_price || order.avg_fill_price || order.price) : order.price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted font-medium uppercase">Value</p>
                          <p className="text-xs font-bold text-text-secondary tabular-nums">
                            {formatCurrency(
                              (order.status === 'filled' ? (order.executed_price || order.avg_fill_price || order.price) : (order.price || 0)) * order.quantity
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-2 flex items-center gap-1.5 bg-amber-500/5 rounded-lg px-2.5 py-1.5">
                        <Zap size={10} className="text-amber-400" />
                        <span className="text-[11px] font-medium text-amber-400">
                          {order.isVirtual 
                            ? `Position ${order.virtualType === 'sl' ? 'Stop Loss' : 'Target'} trigger at ${formatPrice(order.price)}` 
                            : `Awaiting execution at ${formatPrice(order.price)}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <ClipboardList size={32} className="mx-auto text-text-muted/30 mb-3" />
              <p className="text-sm font-semibold text-text-muted">
                No {activeOrderTab === 'open' ? 'open' : activeOrderTab === 'filled' ? 'filled' : activeOrderTab === 'cancelled' ? 'cancelled' : 'closed'} {activeOrderTab === 'trades' ? 'trades' : 'orders'}
              </p>
              <p className="text-xs text-text-muted/60 mt-1">
                {activeOrderTab === 'open' 
                  ? 'Place orders from Charts' 
                  : activeOrderTab === 'trades'
                    ? 'Realized profit/loss history will appear here'
                    : 'History appears here'}
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!cancellingOrder} onClose={() => setCancellingOrder(null)} title="Cancel Trigger / Order">
        {cancellingOrder && (() => {
          return (
            <div className="space-y-4">
              <div className="bg-surface rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-text-muted">Symbol</span><span className="font-bold text-text-primary">{cancellingOrder.symbol}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Side</span><span className={cn('font-semibold', cancellingOrder.side === 'BUY' ? 'text-emerald-500' : 'text-red-500')}>{cancellingOrder.side}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Type</span><span className="font-bold text-text-primary">{cancellingOrder.type}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Qty × Price</span><span className="font-bold text-text-primary">{cancellingOrder.quantity} × {formatPrice(cancellingOrder.price)}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" fullWidth size="md" onClick={() => setCancellingOrder(null)}>Keep</Button>
                <Button variant="danger" fullWidth size="md" onClick={handleCancelOrder}>
                  {cancellingOrder.isVirtual ? 'Remove Trigger' : 'Cancel Order'}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!modifyingOrder} onClose={() => setModifyingOrder(null)} title="Modify Trigger / Order">
        {modifyingOrder && (() => {
          return (
            <ModifyOrderForm order={modifyingOrder} onClose={() => setModifyingOrder(null)} />
          );
        })()}
      </Modal>
    </div>
  );
}
