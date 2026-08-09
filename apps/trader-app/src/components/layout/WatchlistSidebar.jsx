import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, X, Plus, Trash2, Maximize2, Minimize2, GripVertical, Edit3, Check } from 'lucide-react';
import { useTradeStore } from '../../store/useTradeStore';
import { cn , formatPrice} from '../../utils/helpers';

import React, { memo } from 'react';

// ── WatchlistSidebarRow wrapper component ──
const WatchlistSidebarRow = memo(({ symbol, isExpanded, onClick, onRemove }) => {
  const inst = useTradeStore(state => state.instrumentsMap?.get(symbol));
  if (!inst) return null;

  const isUp = (inst.change || 0) >= 0;
  const isFreshTick = Date.now() - (inst.lastTickTime || 0) < 350;

  if (isExpanded) {
    return (
      <div
        onClick={() => onClick(inst)}
        className="w-full flex items-center px-3 py-2 text-left border-b border-border/10 hover:bg-surface-2/60 transition-colors min-w-max group cursor-pointer"
      >
        <div className="w-[180px] flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-text-primary">{inst.symbol}</span>
            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-surface-2 text-text-muted/70 uppercase">
              {inst.segment === 'nse_equity' ? 'NSE' : inst.segment === 'forex' ? 'FX' : inst.segment === 'mcx' ? 'MCX' : 'BSE'}
            </span>
          </div>
          <p className="text-[10px] text-text-muted/60 truncate leading-tight">{inst.name}</p>
        </div>
        <span
          className={cn(
            'w-[90px] text-right text-[12px] font-bold tabular-nums flex-shrink-0 transition-all duration-300 ease-out',
            isFreshTick && inst.tickDirection === 'up' && 'text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded scale-[1.03] duration-75',
            isFreshTick && inst.tickDirection === 'down' && 'text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded scale-[1.03] duration-75',
            (!isFreshTick || inst.tickDirection === 'none') && (isUp ? 'text-text-primary' : 'text-red-500')
          )}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {formatPrice(inst.price)}
        </span>
        <span className={cn('w-[80px] text-right text-[11px] font-bold tabular-nums flex-shrink-0', isUp ? 'text-emerald-500' : 'text-red-500')}>
          {isUp ? '+' : ''}{(inst.change || 0).toFixed(2)}
        </span>
        <span className={cn('w-[70px] text-right text-[11px] font-bold tabular-nums flex-shrink-0', isUp ? 'text-emerald-500' : 'text-red-500')}>
          {isUp ? '+' : ''}{(inst.changePercent || 0).toFixed(2)}%
        </span>
        <span className="w-[90px] text-right text-[11px] text-text-muted tabular-nums flex-shrink-0">
          {inst.volume || '0'}
        </span>
        <span className="w-[80px] text-right text-[11px] text-text-muted tabular-nums flex-shrink-0">
          {formatPrice(inst.open || 0)}
        </span>
        <span className="w-[80px] text-right text-[11px] text-text-muted tabular-nums flex-shrink-0">
          {formatPrice(inst.high || 0)}
        </span>
        <span className="w-[80px] text-right text-[11px] text-text-muted tabular-nums flex-shrink-0">
          {formatPrice(inst.low || 0)}
        </span>
        <span className="w-[90px] text-right text-[11px] text-text-muted tabular-nums flex-shrink-0">
          {formatPrice(inst.prevClose || 0)}
        </span>
        <span className="w-[50px] text-right flex-shrink-0">
          <button
            onClick={(e) => onRemove(inst.symbol, e)}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-text-muted/40 transition-all"
            title="Remove from watchlist"
          >
            <X size={12} />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick(inst)}
      className={cn(
        'w-full flex items-center justify-between px-3 py-[7px] text-left transition-colors group cursor-pointer',
        'hover:bg-surface-2/80 border-b border-border/10'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[12px] font-bold text-text-primary truncate">{inst.symbol}</span>
          {inst.segment && (
            <span className="text-[9px] font-medium text-text-muted/50 uppercase">
              {inst.segment === 'nse_equity' ? '' : 
               inst.segment === 'forex' ? '.fx' : 
               inst.segment === 'crypto' ? '.cry' :
               inst.segment === 'us_equity' ? '.us' :
               inst.segment === 'mcx' ? '.mcx' : ''}
            </span>
          )}
        </div>
        <p className="text-[10px] text-text-muted/60 truncate leading-tight">{inst.name}</p>
      </div>
      <div className="text-right ml-2 flex-shrink-0 flex items-center gap-1.5">
        <div>
          <p
            className={cn(
              "text-[12px] font-bold tabular-nums text-text-primary transition-all duration-300 ease-out",
              isFreshTick && inst.tickDirection === 'up' && 'text-emerald-400 bg-emerald-500/20 px-1 py-0.5 rounded scale-[1.03] duration-75',
              isFreshTick && inst.tickDirection === 'down' && 'text-red-400 bg-red-500/20 px-1 py-0.5 rounded scale-[1.03] duration-75'
            )}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {formatPrice(inst.price)}
          </p>
          <p className={cn(
            'text-[10px] font-bold tabular-nums',
            (inst.change || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
          )}>
            {(inst.change || 0) >= 0 ? '+' : ''}{(inst.change || 0).toFixed(2)}
          </p>
        </div>
        <button
          onClick={(e) => onRemove(inst.symbol, e)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-text-muted/30 transition-all"
          title="Remove"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
});

export default function WatchlistSidebar({ isExpanded, onToggleExpand }) {
  // Use fine-grained selectors instead of destructuring the whole store
  const instruments = useTradeStore(state => state.instruments);
  const setSelectedInstrument = useTradeStore(state => state.setSelectedInstrument);
  const activeWatchlistId = useTradeStore(state => state.activeWatchlistId);
  const watchlists = useTradeStore(state => state.watchlists);
  const updateWatchlists = useTradeStore(state => state.updateWatchlists);

  const navigate = useNavigate();

  // Watchlist name is just the ID for now since we have MW-1 to MW-5
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const renameInputRef = useRef(null);

  const watchlistSymbols = watchlists[activeWatchlistId] || [];

  // Derive the display name for the active watchlist
  const watchlistNames = JSON.parse(localStorage.getItem('tradex_watchlist_names') || '{}');
  const watchlistName = watchlistNames[activeWatchlistId] || activeWatchlistId;

  const setWatchlistSymbolsState = (newSymbols) => {
    updateWatchlists({ ...watchlists, [activeWatchlistId]: newSymbols });
  };

  // ═══ Resizable sidebar width ═══
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('tradex_sidebar_width');
    return saved ? Number(saved) : 280;
  });
  const isResizing = useRef(false);
  const sidebarRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(500, Math.max(200, startWidth + (e.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Width is persisted by the useEffect below on every change
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('tradex_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  // ── Search results — instruments matching search that are NOT in the watchlist ──
  const searchResults = useMemo(() => {
    if (!sidebarSearch.trim()) return [];
    const q = sidebarSearch.toLowerCase();
    return instruments.filter(i =>
      !watchlistSymbols.includes(i.symbol) &&
      (i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [instruments, sidebarSearch, watchlistSymbols]);

  const isSearchMode = sidebarSearch.trim().length > 0;

  // ── Actions ──
  const addToWatchlist = (symbol) => {
    const updated = [...watchlistSymbols, symbol];
    setWatchlistSymbolsState(updated);
    setSidebarSearch('');
  };

  const removeFromWatchlist = (symbol, e) => {
    if (e) e.stopPropagation();
    const updated = watchlistSymbols.filter(s => s !== symbol);
    setWatchlistSymbolsState(updated);
  };

  const handleClick = (inst) => {
    setSelectedInstrument(inst);
    navigate('/charts');
  };

  const startRename = () => {
    setRenameValue(watchlistName);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const finishRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      // Name renaming not supported in global state yet
    }
    setIsRenaming(false);
  };

  
  // ═══ EXPANDED VIEW — Full market watch table ═══
  if (isExpanded) {
    return (
      <div className="hidden lg:flex flex-col flex-1 bg-surface h-[calc(100vh-84px)] overflow-hidden border-r border-border/40">
        {/* Top bar — name + search + collapse */}
        <div className="border-b border-border/30 flex items-center px-3 py-2 gap-2">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                className="bg-surface-2 border border-primary/40 rounded px-2 py-1 text-xs font-bold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/30 w-32"
              />
              <button onClick={finishRename} className="p-1 text-primary hover:bg-primary/10 rounded">
                <Check size={12} />
              </button>
            </div>
          ) : (
            <button onClick={startRename} className="flex items-center gap-1.5 text-xs font-bold text-text-primary uppercase tracking-wider hover:text-primary transition-colors group">
              {watchlistName}
              <Edit3 size={10} className="text-text-muted/40 group-hover:text-primary" />
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/60" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search & add scripts..."
                className="bg-surface-2 border border-border/30 rounded-md pl-7 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30 w-48"
              />
            </div>
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-md hover:bg-surface-2 transition-colors text-text-muted hover:text-text-primary"
              title="Collapse market watch"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>

        {/* Search results dropdown */}
        {isSearchMode && searchResults.length > 0 && (
          <div className="border-b border-border/30 bg-surface-2/50 max-h-48 overflow-y-auto">
            <p className="px-3 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Add to watchlist</p>
            {searchResults.map(inst => (
              <button
                key={inst.symbol}
                onClick={() => addToWatchlist(inst.symbol)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 transition-colors text-left"
              >
                <div>
                  <span className="text-[12px] font-bold text-text-primary">{inst.symbol}</span>
                  <span className="text-[10px] text-text-muted ml-1.5">{inst.name}</span>
                </div>
                <Plus size={14} className="text-primary" />
              </button>
            ))}
          </div>
        )}

        {isSearchMode && searchResults.length === 0 && (
          <div className="border-b border-border/30 bg-surface-2/50 px-3 py-4 text-center">
            <p className="text-[11px] text-text-muted">No matching instruments found</p>
          </div>
        )}

        {/* Table Header */}
        <div className="flex items-center px-3 py-2 border-b border-border/30 bg-surface-2/50 text-[11px] font-bold text-text-muted uppercase tracking-wider select-none min-w-max">
          <span className="w-[180px] flex-shrink-0">Symbol</span>
          <span className="w-[90px] text-right flex-shrink-0">LTP</span>
          <span className="w-[80px] text-right flex-shrink-0">Change</span>
          <span className="w-[70px] text-right flex-shrink-0">%Chg</span>
          <span className="w-[90px] text-right flex-shrink-0">Volume</span>
          <span className="w-[80px] text-right flex-shrink-0">Open</span>
          <span className="w-[80px] text-right flex-shrink-0">Day High</span>
          <span className="w-[80px] text-right flex-shrink-0">Day Low</span>
          <span className="w-[90px] text-right flex-shrink-0">Prev Close</span>
          <span className="w-[50px] text-right flex-shrink-0"></span>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-hide">
          {watchlistSymbols.length === 0 && !isSearchMode ? (
            <div className="py-12 text-center">
              <Star size={24} className="mx-auto text-text-muted/20 mb-2" />
              <p className="text-sm font-semibold text-text-muted">Watchlist is empty</p>
              <p className="text-xs text-text-muted/60 mt-1">Search for scripts above to add them</p>
            </div>
          ) : (
            watchlistSymbols.map((symbol) => (
              <WatchlistSidebarRow
                key={symbol}
                symbol={symbol}
                isExpanded={true}
                onClick={handleClick}
                onRemove={removeFromWatchlist}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // ═══ NORMAL COMPACT VIEW ═══
  return (
    <aside
      ref={sidebarRef}
      className="hidden lg:flex flex-col border-r border-border/40 bg-surface h-[calc(100vh-84px)] overflow-hidden relative select-none"
      style={{ width: sidebarWidth, minWidth: 200, maxWidth: 500 }}
    >
      {/* Search + Expand */}
      <div className="px-2 pt-2 pb-1">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/60" />
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search & add scripts..."
            className="w-full bg-surface-2 border border-border/30 rounded-md pl-7 pr-16 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {sidebarSearch && (
              <button onClick={() => setSidebarSearch('')} className="p-1 text-text-muted/50 hover:text-text-muted rounded">
                <X size={11} />
              </button>
            )}
            <button
              onClick={onToggleExpand}
              className="p-1 text-text-muted/50 hover:text-primary rounded hover:bg-primary/5 transition-colors"
              title="Expand to full market watch"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Watchlist Name (renameable) */}
      <div className="px-3 py-1.5 border-b border-border/20 flex items-center justify-between">
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              className="bg-surface-2 border border-primary/40 rounded px-2 py-0.5 text-[11px] font-bold text-text-primary focus:outline-none w-full"
            />
            <button onClick={finishRename} className="p-0.5 text-primary">
              <Check size={11} />
            </button>
          </div>
        ) : (
          <button onClick={startRename} className="flex items-center gap-1 text-[11px] font-bold text-text-muted uppercase tracking-wider hover:text-primary transition-colors group">
            {watchlistName}
            <Edit3 size={9} className="text-text-muted/30 group-hover:text-primary" />
          </button>
        )}
        <span className="text-[10px] text-text-muted/50">{watchlistSymbols.length}</span>
      </div>

      {/* Search Results — Add to watchlist */}
      {isSearchMode && (
        <div className="border-b border-border/30 bg-surface-2/30 max-h-48 overflow-y-auto">
          {searchResults.length > 0 ? (
            <>
              <p className="px-3 py-1 text-[9px] font-bold text-text-muted uppercase tracking-wider">Add to {watchlistName}</p>
              {searchResults.map(inst => (
                <button
                  key={inst.symbol}
                  onClick={() => addToWatchlist(inst.symbol)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-text-primary">{inst.symbol}</span>
                    <span className="text-[9px] text-text-muted/60 ml-1 truncate">{inst.name}</span>
                  </div>
                  <Plus size={12} className="text-primary flex-shrink-0" />
                </button>
              ))}
            </>
          ) : (
            <p className="px-3 py-3 text-[10px] text-text-muted text-center">No matching instruments</p>
          )}
        </div>
      )}

      {/* Instrument List — Current Watchlist */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {!isSearchMode && watchlistSymbols.length === 0 ? (
          <div className="py-10 text-center px-4">
            <Star size={20} className="mx-auto text-text-muted/20 mb-2" />
            <p className="text-[11px] font-semibold text-text-muted">Empty watchlist</p>
            <p className="text-[10px] text-text-muted/50 mt-1">Type a script name in the search bar above to add it</p>
          </div>
        ) : (
          watchlistSymbols.map((symbol) => (
            <WatchlistSidebarRow
              key={symbol}
              symbol={symbol}
              isExpanded={false}
              onClick={handleClick}
              onRemove={removeFromWatchlist}
            />
          ))
        )}
      </div>

      {/* Bottom info */}
      <div className="border-t border-border/30 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-text-muted/50">{watchlistSymbols.length} scripts</span>
      </div>

      {/* ═══ Resize Handle ═══ */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-10 group hover:bg-primary/20 transition-colors"
        title="Drag to resize"
      >
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-[5px] h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={10} className="text-primary/60" />
        </div>
      </div>
    </aside>
  );
}
