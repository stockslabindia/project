import React, { useState, useMemo, useCallback, useRef, memo } from 'react';
import { Search, Maximize2, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTradeStore } from '../../store/useTradeStore';
import { usePriceStore } from '../../store/usePriceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { cn , formatPrice} from '../../utils/helpers';
import ScriptActionSheet from '../../components/ui/ScriptActionSheet';
import SideDrawer from '../../components/ui/SideDrawer';
import InstrumentBrowser from '../../components/ui/InstrumentBrowser';
import { usePullToRefresh, PullIndicator } from '../../hooks/usePullToRefresh';

// ── Swipeable Row Component ──
function SwipeableRow({ children, onDelete }) {
  const rowRef = useRef(null);
  const startX = useRef(0);
  const isSwiping = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const THRESHOLD = 70;

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };
  const handleTouchMove = (e) => {
    if (!isSwiping.current) return;
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setSwipeOffset(Math.min(diff, 100));
    else setSwipeOffset(0);
  };
  const handleTouchEnd = () => {
    isSwiping.current = false;
    if (swipeOffset >= THRESHOLD) { setShowDelete(true); setSwipeOffset(THRESHOLD); }
    else { setSwipeOffset(0); setShowDelete(false); }
  };
  const handleDelete = () => { setSwipeOffset(0); setShowDelete(false); onDelete?.(); };
  const resetSwipe = () => { setSwipeOffset(0); setShowDelete(false); };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-end bg-red-600 w-full">
        <button onClick={handleDelete} className="flex items-center justify-center w-[70px] h-full">
          <Trash2 size={20} className="text-white" />
        </button>
      </div>
      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={showDelete ? resetSwipe : undefined}
        style={{ transform: `translateX(-${swipeOffset}px)`, transition: isSwiping.current ? 'none' : 'transform 0.3s ease-out' }}
        className="relative bg-surface z-10"
      >
        {children}
      </div>
    </div>
  );
}

// ── Memoized Instrument Row for watchlist ──
const InstrumentRow = memo(({ inst, onTap, onDelete, formatPrice, cn, fmtChange }) => {
  const change = inst.change || 0;
  const pct = inst.changePercent || 0;
  const isUp = change >= 0;

  return (
    <SwipeableRow onDelete={onDelete}>
      <div 
        className="flex items-center justify-between px-4 py-3 border-b border-border/40 cursor-pointer active:bg-surface-2 contain-intrinsic-size-[50px] [contain:layout_style] [content-visibility:auto]"
        onClick={() => onTap(inst)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-text-primary">{inst.symbol}</p>
          <p className="text-[12px] text-text-muted truncate">{inst.name}</p>
        </div>
        <div className="text-right ml-3">
          <p className="text-[14px] font-bold text-text-primary tabular-nums">{formatPrice(inst.price)}</p>
          <p className={cn('text-[12px] font-medium tabular-nums', isUp ? 'text-emerald-400' : 'text-red-400')}>{fmtChange(change, pct)}</p>
        </div>
      </div>
    </SwipeableRow>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.inst.symbol === nextProps.inst.symbol &&
    prevProps.inst.price === nextProps.inst.price &&
    prevProps.inst.change === nextProps.inst.change &&
    prevProps.inst.changePercent === nextProps.inst.changePercent
  );
});

// ── Memoized Instrument Row for search results ──
const InstrumentRowSearch = memo(({ inst, isInWatchlist, onTap, addToWatchlist, formatPrice, cn, fmtChange }) => {
  const change = inst.change || 0;
  const pct = inst.changePercent || 0;
  const isUp = change >= 0;

  return (
    <div 
      className="flex items-center justify-between px-4 py-3 border-b border-border/40 hover:bg-surface-2 transition-colors cursor-pointer [contain:layout_style] [content-visibility:auto] contain-intrinsic-size-[50px]"
      onClick={() => isInWatchlist ? onTap(inst) : addToWatchlist(inst.symbol)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-text-primary">{inst.symbol}</p>
        <p className="text-[12px] text-text-muted truncate">{inst.name}</p>
      </div>
      <div className="text-right ml-3">
        <p className="text-[14px] font-bold text-text-primary tabular-nums">{formatPrice(inst.price)}</p>
        <p className={cn('text-[12px] font-medium tabular-nums', isUp ? 'text-emerald-400' : 'text-red-400')}>{fmtChange(change, pct)}</p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.inst.symbol === nextProps.inst.symbol &&
    prevProps.inst.price === nextProps.inst.price &&
    prevProps.inst.change === nextProps.inst.change &&
    prevProps.inst.changePercent === nextProps.inst.changePercent &&
    prevProps.isInWatchlist === nextProps.isInWatchlist
  );
});

// ── HeaderTickers component that subscribes directly to Nifty & BankNifty futures prices ──
const HeaderTickers = memo(({ userInitial, setDrawerOpen }) => {
  const nifty = usePriceStore(useCallback(state => 
    state.instrumentsMap?.get('NIFTY26JULFUT') || 
    state.instrumentsMap?.get('NIFTY50') || 
    state.instrumentsMap?.get('NIFTY'), []));
    
  const bankNifty = usePriceStore(useCallback(state => 
    state.instrumentsMap?.get('BANKNIFTY26JULFUT') || 
    state.instrumentsMap?.get('BANKNIFTY'), []));

  const tickerFmt = (data, defaultPrice, defaultChange, defaultPct) => {
    const rawPrice = Number(data?.price || data?.last_price || 0);
    const priceVal = rawPrice > 0 ? rawPrice : defaultPrice;
    const changeVal = (data && data.change !== undefined && data.change !== null) ? Number(data.change) : defaultChange;
    const pctVal = (data && data.changePercent !== undefined && data.changePercent !== null) ? Number(data.changePercent) : defaultPct;

    return {
      price: formatPrice(priceVal),
      change: (changeVal >= 0 ? '+' : '') + changeVal.toFixed(2),
      pct: `(${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%)`,
      isUp: changeVal >= 0
    };
  };

  const niftyData = tickerFmt(nifty, 24774.50, 124.50, 0.51);
  const bnData = tickerFmt(bankNifty, 58247.30, 342.10, 0.59);

  return (
    /* safe-top ensures content starts BELOW the iPhone notch / Dynamic Island */
    <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-border lg:hidden safe-top">
      <div className="flex items-center gap-1">
        <button onClick={() => setDrawerOpen(true)} className="w-7 h-7 rounded bg-surface-3 flex items-center justify-center mr-1">
          <span className="text-text-primary text-xs font-bold">≡</span>
        </button>
        {/* NIFTY 50 */}
        <div className="bg-surface-3 rounded-lg px-2.5 py-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-text-muted uppercase">NIFTY FUT</span>
            <span className={cn('text-[10px] font-bold', niftyData.isUp ? 'text-emerald-400' : 'text-red-400')}>{niftyData.change}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-text-primary tabular-nums">{niftyData.price}</span>
            <span className={cn('text-[9px]', niftyData.isUp ? 'text-emerald-400' : 'text-red-400')}>{niftyData.pct}</span>
          </div>
        </div>
        {/* BANK NIFTY */}
        <div className="bg-surface-3 rounded-lg px-2.5 py-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-text-muted uppercase">BANKNIFTY FUT</span>
            <span className={cn('text-[10px] font-bold', bnData.isUp ? 'text-emerald-400' : 'text-red-400')}>{bnData.change}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-text-primary tabular-nums">{bnData.price}</span>
            <span className={cn('text-[9px]', bnData.isUp ? 'text-emerald-400' : 'text-red-400')}>{bnData.pct}</span>
          </div>
        </div>
      </div>
      <button onClick={() => setDrawerOpen(true)} className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/20">
        {userInitial}
      </button>
    </div>
  );
});

// ── MarketInstrumentRow wrapper component ──
const MarketInstrumentRow = memo(({ symbol, onTap, onDelete }) => {
  const inst = usePriceStore(useCallback(state => state.instrumentsMap?.get(symbol), [symbol]));
  if (!inst) return null;
  return (
    <InstrumentRow
      inst={inst}
      onTap={onTap}
      onDelete={onDelete}
      formatPrice={formatPrice}
      cn={cn}
      fmtChange={(change, pct) => `${(change || 0).toFixed(2)} (${(pct || 0).toFixed(2)}%)`}
    />
  );
});

// ── SearchInstrumentRow wrapper component ──
const SearchInstrumentRow = memo(({ symbol, isInWatchlist, onTap, addToWatchlist }) => {
  const inst = usePriceStore(useCallback(state => state.instrumentsMap?.get(symbol), [symbol]));
  if (!inst) return null;
  return (
    <InstrumentRowSearch
      inst={inst}
      isInWatchlist={isInWatchlist}
      onTap={onTap}
      addToWatchlist={addToWatchlist}
      formatPrice={formatPrice}
      cn={cn}
      fmtChange={(change, pct) => `${(change || 0).toFixed(2)} (${(pct || 0).toFixed(2)}%)`}
    />
  );
});

export default function Markets() {
  const user = useAuthStore(state => state.user);
  const setOrderSide = useOrderStore(state => state.setOrderSide);
  
  // Use fine-grained selectors instead of destructuring the whole store
  const instruments = usePriceStore(state => state.instruments);
  const setSelectedInstrument = usePriceStore(state => state.setSelectedInstrument);
  const watchlists = usePriceStore(state => state.watchlists);
  const activeWatchlistId = usePriceStore(state => state.activeWatchlistId);
  const setActiveWatchlistId = usePriceStore(state => state.setActiveWatchlistId);
  const updateWatchlists = usePriceStore(state => state.updateWatchlists);

  const loadInitialData = useTradeStore(state => state.loadInitialData);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionInstrument, setActionInstrument] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);

  const { containerRef, containerProps, isRefreshing, pullProgress } = usePullToRefresh(async () => {
    await loadInitialData();
  });

  const activeTab = activeWatchlistId;
  const activeSymbols = watchlists[activeTab] || [];
  const userName = user?.name || user?.full_name || user?.email?.split('@')[0] || 'S';
  const userInitial = userName.charAt(0).toUpperCase();

  // Prefetch Option Chain expiries in background so Option Chain opens instantly
  useEffect(() => {
    import('../../store/useOptionChainStore').then(({ useOptionChainStore }) => {
      useOptionChainStore.getState().fetchExpiries('NIFTY');
    }).catch(() => {});
  }, []);

  const displaySymbols = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const filtered = instruments.filter(i =>
        i.symbol.toLowerCase().includes(query) || i.name.toLowerCase().includes(query)
      ).slice(0, 20);
      return filtered.map(i => i.symbol);
    }
    return activeSymbols;
  }, [instruments, searchQuery, activeSymbols]);

  const isInWatchlist = useCallback((symbol) => activeSymbols.includes(symbol), [activeSymbols]);

  const addToWatchlist = (symbol) => {
    if (!watchlists[activeTab].includes(symbol)) {
      updateWatchlists({
        ...watchlists,
        [activeTab]: [...watchlists[activeTab], symbol]
      });
    }
    setSearchQuery('');
  };
  
  const removeFromWatchlist = (symbol) => {
    updateWatchlists({
      ...watchlists,
      [activeTab]: watchlists[activeTab].filter(s => s !== symbol)
    });
  };
  
  const switchTab = (tab) => {
    setActiveWatchlistId(tab);
  };

  const handleInstrumentTap = (inst) => setActionInstrument(inst);
  const handleBuy = (inst) => { setSelectedInstrument(inst); setOrderSide('buy'); navigate('/trade'); };
  const handleSell = (inst) => { setSelectedInstrument(inst); setOrderSide('sell'); navigate('/trade'); };
  const handleChart = (inst) => { setSelectedInstrument(inst); navigate('/charts'); };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-surface min-h-full" {...containerProps}>
      <PullIndicator isRefreshing={isRefreshing} progress={pullProgress} />
      
      {/* ── Top Ticker Bar (Subscribes directly to ticker prices) ── */}
      <HeaderTickers
        userInitial={userInitial}
        setDrawerOpen={setDrawerOpen}
      />

      {/* ── Search Bar ── */}
      <div className="px-3 pt-3 pb-2 bg-surface">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search symbols..."
              className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-4 py-2.5 text-base text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 transition-colors" />
          </div>
          <button className="p-2.5 bg-surface-2 border border-border rounded-lg text-text-muted hover:text-text-primary transition-colors">
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => setShowBrowser(true)}
            className="p-2.5 bg-primary/10 border border-primary/20 rounded-lg text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Option Chain Quick Entry Chips ── */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => navigate('/options/nifty')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-surface-2 hover:bg-surface-3 border border-border/40 rounded-lg transition-colors text-xs font-bold text-text-primary"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>NIFTY Option Chain</span>
          </button>
          <button
            onClick={() => navigate('/options/banknifty')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-surface-2 hover:bg-surface-3 border border-border/40 rounded-lg transition-colors text-xs font-bold text-text-primary"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>BANKNIFTY Option Chain</span>
          </button>
        </div>
      </div>


      {/* ── Instrument List ── */}
      {/* pb accounts for: bottom-nav (~56px) + watchlist-tabs (~44px) + safe-area-inset-bottom */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
        {searchQuery ? (
          displaySymbols.length > 0 ? (
            displaySymbols.map((symbol) => (
              <SearchInstrumentRow
                key={symbol}
                symbol={symbol}
                isInWatchlist={isInWatchlist(symbol)}
                onTap={handleInstrumentTap}
                addToWatchlist={addToWatchlist}
              />
            ))
          ) : (
            <div className="py-16 text-center"><Search size={32} className="mx-auto text-text-muted/30 mb-3" /><p className="text-sm text-text-muted">No instruments found</p></div>
          )
        ) : (
          displaySymbols.length > 0 ? (
            displaySymbols.map((symbol) => (
              <MarketInstrumentRow
                key={symbol}
                symbol={symbol}
                onTap={handleInstrumentTap}
                onDelete={() => removeFromWatchlist(symbol)}
              />
            ))
          ) : (
            <div className="py-16 text-center"><p className="text-sm text-text-muted mb-2">Watchlist is empty</p><p className="text-xs text-text-muted/60">Search for symbols to add them</p></div>
          )
        )}
      </div>

      {/* ── Bottom Watchlist Tabs ── */}
      <div className="fixed left-0 right-0 bg-surface border-t border-border z-30 max-w-lg mx-auto lg:hidden" style={{ bottom: 'calc(48px + max(env(safe-area-inset-bottom, 0px), 6px))' }}>
        <div className="flex items-center px-1">
          <button className="p-2 text-text-muted"><span className="text-lg">‹</span></button>
          <div className="flex-1 flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {Object.keys(watchlists).map((tab) => (
              <button key={tab} onClick={() => switchTab(tab)}
                className={cn('px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors relative', activeTab === tab ? 'text-blue-500' : 'text-text-muted hover:text-text-secondary')}>
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />}
              </button>
            ))}
          </div>
          <button className="p-2 text-text-muted"><span className="text-lg">›</span></button>
        </div>
      </div>

      {actionInstrument && (
        <ScriptActionSheet instrument={actionInstrument} onClose={() => setActionInstrument(null)}
          onBuy={handleBuy} onSell={handleSell} onChart={handleChart}
          onDelete={(inst) => removeFromWatchlist(inst.symbol)} />
      )}
      <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── MT5-Style Instrument Browser ── */}
      {showBrowser && (
        <InstrumentBrowser
          instruments={instruments}
          activeSymbols={activeSymbols}
          onAdd={(symbol) => {
            addToWatchlist(symbol);
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
