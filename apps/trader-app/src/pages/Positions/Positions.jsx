import React, { useState, useCallback, memo } from 'react';
import { X, Search, FileSearch } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useTradeStore } from '../../store/useTradeStore';
import { formatCurrency, formatPercent, cn , formatPrice} from '../../utils/helpers';
import { usePullToRefresh, PullIndicator } from '../../hooks/usePullToRefresh';

const PositionRow = memo(({ pos, onOpenSlTgt, onClose }) => {
  const isProfit = (pos.pnl || 0) >= 0;
  return (
    <div className="bg-surface-2 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-text-primary">{pos.symbol}</p>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
              pos.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
              {pos.type}
            </span>
            <span className={cn('text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider',
              pos.product_type === 'overnight' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-amber-500/15 text-amber-400')}>
              {pos.product_type === 'overnight' ? 'Overnight' : 'Intraday'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Qty: {pos.quantity}
            {pos.stop_loss ? ` | SL: ${pos.stop_loss}` : ''}
            {pos.take_profit ? ` | TGT: ${pos.take_profit}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-bold tabular-nums', isProfit ? 'text-emerald-400' : 'text-red-400')}>
            {isProfit ? '+' : ''}{formatCurrency(pos.pnl || 0)}
          </p>
          <p className={cn('text-xs font-semibold tabular-nums', isProfit ? 'text-emerald-400/70' : 'text-red-400/70')}>
            {formatPercent(pos.pnlPercent || 0)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
        <div>
          <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Entry</p>
          <p className="text-xs font-bold text-text-secondary tabular-nums mt-0.5">{formatPrice(pos.entryPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Current</p>
          <p className={cn('text-xs font-bold tabular-nums mt-0.5', isProfit ? 'text-emerald-400' : 'text-red-400')}>{formatPrice(pos.currentPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wide">Margin</p>
          <p className="text-xs font-bold text-text-secondary tabular-nums mt-0.5">{formatCurrency(pos.margin)}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-2.5 border-t border-border/20">
        <button onClick={() => onOpenSlTgt(pos)}
          className="flex-1 py-1.5 border border-primary/30 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors touch-active-subtle">
          SL / TGT
        </button>
        <button onClick={() => onClose(pos.id, pos.quantity)}
          className="flex-1 py-1.5 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors touch-active-subtle">
          Close
        </button>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.pos.id === next.pos.id &&
         prev.pos.symbol === next.pos.symbol &&
         prev.pos.type === next.pos.type &&
         prev.pos.product_type === next.pos.product_type &&
         prev.pos.quantity === next.pos.quantity &&
         prev.pos.stop_loss === next.pos.stop_loss &&
         prev.pos.take_profit === next.pos.take_profit &&
         prev.pos.pnl === next.pos.pnl &&
         prev.pos.pnlPercent === next.pos.pnlPercent &&
         prev.pos.entryPrice === next.pos.entryPrice &&
         prev.pos.currentPrice === next.pos.currentPrice &&
         prev.pos.margin === next.pos.margin;
});

const PositionRowWrapper = memo(({ id, onOpenSlTgt, onClose }) => {
  const pos = useTradeStore(useCallback(state => state.positionsMap?.get(id), [id]));
  if (!pos) return null;
  return <PositionRow pos={pos} onOpenSlTgt={onOpenSlTgt} onClose={onClose} />;
});

export default function Positions() {
  const positions = useTradeStore(state => state.positions);
  const closePosition = useTradeStore(state => state.closePosition);
  const fetchPositions = useTradeStore(state => state.fetchPositions);
  const updatePositionSlTgt = useTradeStore(state => state.updatePositionSlTgt);
  const fetchWallet = useTradeStore(state => state.fetchWallet);

  const [closingId, setClosingId] = useState(null);
  const [closeQtyInput, setCloseQtyInput] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const [editingSlTgtId, setEditingSlTgtId] = useState(null);
  const [slInput, setSlInput] = useState('');
  const [tgtInput, setTgtInput] = useState('');

  const openSlTgtModal = useCallback((pos) => {
    setEditingSlTgtId(pos.id);
    setSlInput(pos.stop_loss ? String(pos.stop_loss) : '');
    setTgtInput(pos.take_profit ? String(pos.take_profit) : '');
  }, []);

  const handleOpenCloseModal = useCallback((id, qty) => {
    setClosingId(id);
    setCloseQtyInput(String(qty));
  }, []);

  const handleSaveSlTgt = () => {
    updatePositionSlTgt(
      editingSlTgtId,
      slInput.trim() ? Number(slInput) : null,
      tgtInput.trim() ? Number(tgtInput) : null
    );
    setEditingSlTgtId(null);
  };

  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const totalPnlPct = positions.length > 0
    ? positions.reduce((sum, p) => sum + (p.pnlPercent || 0), 0) / positions.length : 0;

  const onRefresh = useCallback(async () => {
    try { await Promise.all([fetchPositions(), fetchWallet()]); } catch (e) { /* silent */ }
  }, [fetchPositions, fetchWallet]);

  const { containerProps, isRefreshing, pullProgress } = usePullToRefresh(onRefresh);

  const handleClose = async () => {
    if (!closingId || closeLoading) return;
    const qty = parseFloat(closeQtyInput);
    const pos = positions.find((p) => p.id === closingId);
    if (!pos) return;

    if (isNaN(qty) || qty <= 0 || qty > parseFloat(pos.quantity)) {
      setCloseError('Please enter a valid quantity to close (must be positive and <= current quantity)');
      return;
    }

    setCloseLoading(true);
    setCloseError(null);
    try {
      const result = await closePosition(closingId, qty);
      if (result?.success) {
        setClosingId(null);
        // Refresh positions and wallet to reflect the closed position
        await Promise.all([fetchPositions(), fetchWallet()]);
      } else {
        setCloseError(result?.error || 'Failed to close position');
      }
    } catch (err) {
      setCloseError(err.message || 'Failed to close position');
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <div className="bg-surface min-h-full relative" {...containerProps}>
      <PullIndicator progress={pullProgress} isRefreshing={isRefreshing} />
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-text-primary">Positions</h1>
        <div className="mt-2 h-0.5 bg-blue-500 w-20 rounded-full" />
      </div>

      <div className="h-2" />

      <div className="mx-4 bg-surface-2 rounded-xl border border-border px-4 py-3.5 flex items-center justify-between">
        <span className="text-sm text-text-muted font-medium">Unrealized P&L</span>
        <span className={cn('text-base font-bold tabular-nums', totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)} ({totalPnlPct.toFixed(0)}%)
        </span>
      </div>

      <div className="mt-4 px-4">
        {positions.length > 0 ? (
          <div className="space-y-2">
            {positions.map((pos) => (
              <PositionRowWrapper
                key={pos.id}
                id={pos.id}
                onOpenSlTgt={openSlTgtModal}
                onClose={handleOpenCloseModal}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-4">
              <div className="w-16 h-20 bg-surface-3 rounded-lg border border-border flex items-center justify-center">
                <FileSearch size={28} className="text-text-muted/40" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-cyan-500/20 rounded-full flex items-center justify-center">
                <Search size={14} className="text-cyan-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-text-primary">No positions</h3>
            <p className="text-sm text-text-muted mt-1">You have no open positions at the moment</p>
          </div>
        )}
      </div>

      <Modal isOpen={!!closingId} onClose={() => setClosingId(null)} title="Close Position">
        {closingId && (() => {
          const pos = positions.find((p) => p.id === closingId);
          if (!pos) return null;
          const isProfit = (pos.pnl || 0) >= 0;
          return (
            <div className="space-y-4">
              <div className="bg-surface rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-sm"><span className="text-text-muted">Symbol</span><span className="font-bold text-text-primary">{pos.symbol}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Type</span><span className={cn('font-semibold', pos.type === 'BUY' ? 'text-emerald-500' : 'text-red-500')}>{pos.type}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Total Quantity</span><span className="font-semibold text-text-primary">{pos.quantity}</span></div>
                
                <div className="border-t border-border/50 pt-2.5 space-y-1.5">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Quantity to Close</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      max={pos.quantity}
                      value={closeQtyInput}
                      onChange={(e) => setCloseQtyInput(e.target.value)}
                      className="w-full bg-surface-3 border border-border/50 rounded-xl px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-500/40 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setCloseQtyInput(String(pos.quantity))}
                      className="absolute right-2 px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted">Estimated P&L (Proportional)</span>
                    <span className={cn('font-extrabold text-lg tabular-nums', isProfit ? 'text-emerald-500' : 'text-red-500')}>
                      {isProfit ? '+' : ''}{formatCurrency(((pos.pnl || 0) / pos.quantity) * (Number(closeQtyInput) || 0))}
                    </span>
                  </div>
                </div>
              </div>
              {closeError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400 font-medium">
                  {closeError}
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" fullWidth size="lg" onClick={() => { setClosingId(null); setCloseError(null); }} disabled={closeLoading}>Cancel</Button>
                <Button variant="danger" fullWidth size="lg" onClick={handleClose} disabled={closeLoading}>
                  {closeLoading ? 'Closing...' : 'Close Position'}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!editingSlTgtId} onClose={() => setEditingSlTgtId(null)} title="Update SL / Target">
        {editingSlTgtId && (() => {
          const pos = positions.find((p) => p.id === editingSlTgtId);
          if (!pos) return null;
          return (
            <div className="space-y-4">
              <div className="bg-surface rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-sm"><span className="text-text-muted">Symbol</span><span className="font-bold text-text-primary">{pos.symbol}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Entry Price</span><span className="font-semibold text-text-primary">{formatPrice(pos.entryPrice)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Current Price</span><span className="font-semibold text-text-primary">{formatPrice(pos.currentPrice)}</span></div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Stop Loss Price</label>
                  <input
                    type="number"
                    step="any"
                    value={slInput}
                    onChange={(e) => setSlInput(e.target.value)}
                    placeholder="No Stop Loss"
                    className="w-full bg-surface-3 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Target Price (Take Profit)</label>
                  <input
                    type="number"
                    step="any"
                    value={tgtInput}
                    onChange={(e) => setTgtInput(e.target.value)}
                    placeholder="No Target"
                    className="w-full bg-surface-3 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" fullWidth size="lg" onClick={() => setEditingSlTgtId(null)}>Cancel</Button>
                <Button variant="primary" fullWidth size="lg" onClick={handleSaveSlTgt}>
                  Save Settings
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
