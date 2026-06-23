import React, { useState, useEffect } from 'react';
import { Activity, Layers, ArrowRightLeft, ShieldAlert, Zap, DollarSign, Crosshair, TrendingDown, Target, RefreshCw } from 'lucide-react';
import { initAdminSocket, subscribeToTickers, unsubscribeFromTickers, onMarketTick } from '../services/adminSocket';
import { adminApi } from '../services/adminApi';

export default function DealingDesk() {
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [activeTab, setActiveTab] = useState('virtual_dealer');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [orderBook, setOrderBook] = useState(null);
  const [loadingBook, setLoadingBook] = useState(true);

  // VDP settings state
  const [vdpExecutionDelay, setVdpExecutionDelay] = useState(500);
  const [vdpAsymmetric, setVdpAsymmetric] = useState(true);
  const [newsMultiplier, setNewsMultiplier] = useState(1.0);
  const [vdpLongSwap, setVdpLongSwap] = useState(-0.045);
  const [vdpShortSwap, setVdpShortSwap] = useState(-0.035);

  // Client profiling state
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Fetch VDP settings on mount
  useEffect(() => {
    adminApi.getDealingDeskSettings().then(res => {
      const s = res.settings;
      if (s) {
        if (s.vdp_execution_delay_ms !== undefined) setVdpExecutionDelay(s.vdp_execution_delay_ms);
        if (s.vdp_asymmetric_delay_enabled !== undefined) setVdpAsymmetric(s.vdp_asymmetric_delay_enabled);
        if (s.news_spread_multiplier !== undefined) setNewsMultiplier(s.news_spread_multiplier);
        if (s.vdp_long_swap_pct !== undefined) setVdpLongSwap(s.vdp_long_swap_pct);
        if (s.vdp_short_swap_pct !== undefined) setVdpShortSwap(s.vdp_short_swap_pct);
      }
    }).catch(err => {
      console.error('Failed to load VDP settings:', err);
    });
  }, []);

  // Fetch client profiling data when tab changes to profiling
  const fetchClients = () => {
    setLoadingClients(true);
    adminApi.getClientProfiling().then(data => {
      setClients(data.clients || []);
      setLoadingClients(false);
    }).catch(err => {
      console.error('Failed to fetch client profiling:', err);
      setLoadingClients(false);
    });
  };

  useEffect(() => {
    if (activeTab === 'profiling') {
      fetchClients();
    }
  }, [activeTab]);

  // Orderbook and live tick subscription
  useEffect(() => {
    let isMounted = true;
    setLoadingBook(true);
    
    // Initial fetch
    adminApi.getDealingDeskOrderBook(selectedSymbol, 0).then(data => {
      if (isMounted) {
        setOrderBook(data);
        setLoadingBook(false);
      }
    }).catch(err => {
      console.error(err);
      if (isMounted) setLoadingBook(false);
    });

    initAdminSocket();
    subscribeToTickers([selectedSymbol]);

    const unsubscribeTicks = onMarketTick((tick) => {
      if (tick && tick.symbol === selectedSymbol) {
        setCurrentPrice(tick.price);
        // Only regenerate order book sometimes to simulate realistic jitter without spamming API too hard
        if (Math.random() > 0.5) {
          adminApi.getDealingDeskOrderBook(selectedSymbol, tick.price).then(data => {
            if (isMounted) setOrderBook(data);
          }).catch(console.error);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFromTickers([selectedSymbol]);
      unsubscribeTicks();
    };
  }, [selectedSymbol]);

  // Apply VDP settings to the database
  const handleApplyVdpSettings = async () => {
    try {
      await adminApi.saveDealingDeskSettings({
        vdp_execution_delay_ms: vdpExecutionDelay,
        vdp_asymmetric_delay_enabled: vdpAsymmetric,
        news_spread_multiplier: newsMultiplier,
        vdp_long_swap_pct: vdpLongSwap,
        vdp_short_swap_pct: vdpShortSwap
      });
      alert('Virtual Dealer Plugin settings applied successfully!');
    } catch (err) {
      alert('Failed to apply VDP settings: ' + err.message);
    }
  };

  // Toggle route book for a user
  const handleToggleBook = async (userId, currentBook) => {
    const nextBook = currentBook === 'A-Book' ? 'B-Book' : 'A-Book';
    try {
      await adminApi.toggleRouteBook(userId, nextBook);
      alert(`User routing updated to ${nextBook}`);
      fetchClients();
    } catch (err) {
      alert(`Failed to update routing: ${err.message}`);
    }
  };

  // Trigger stop loss radar price shock
  const handleTriggerRadar = async (action) => {
    try {
      const res = await adminApi.triggerRadarAction(selectedSymbol, action);
      alert(res.message);
    } catch (err) {
      alert("Failed to trigger radar shock: " + err.message);
    }
  };

  // Lock in profits (logs to audit_logs)
  const handleLockProfits = async () => {
    try {
      await adminApi.lockProfits("Dealing Desk: Executed global lock-profits surveillance run.");
      alert("Surveillance profit locking completed and logged.");
    } catch (err) {
      alert("Failed to lock profits: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Dealing Desk</h1>
          <p className="text-sm text-gray-500 mt-1">L2 Order Flow, B-Book Revenue Optimization, and Execution Plugins.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="border border-gray-300 rounded-md text-sm font-bold bg-white px-4 py-2"
          >
            <option>RELIANCE</option>
            <option>NIFTY50</option>
            <option>XAUUSD</option>
            <option>HDFCBANK</option>
            <option>EURUSD</option>
            <option>SBIN</option>
          </select>
          <button onClick={handleLockProfits} className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2 shadow-sm">
            <DollarSign className="h-4 w-4 mr-2" />
            Lock In Profits
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-1">
        <nav className="flex space-x-1">
          <button onClick={() => setActiveTab('virtual_dealer')} className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'virtual_dealer' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Zap className="h-4 w-4" /> Virtual Dealer Plugin (VDP)
          </button>
          <button onClick={() => setActiveTab('profiling')} className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'profiling' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Target className="h-4 w-4" /> Client Profiling & Hedging
          </button>
          <button onClick={() => setActiveTab('order_book')} className={`flex-1 py-2.5 px-4 text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'order_book' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Layers className="h-4 w-4" /> L2 Depth & Stop Hunting
          </button>
        </nav>
      </div>

      {activeTab === 'virtual_dealer' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-purple-600" />
              Asymmetric Slippage (Execution Delay)
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Forces a micro-delay on market orders. If the price moves in favor of the client during the delay, the system issues a "Requote" or executes at the worse price. If it moves in the broker's favor, it executes immediately.
            </p>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-bold text-gray-700">Execution Delay (ms)</label>
                  <span className="text-sm font-bold text-purple-600">{vdpExecutionDelay} ms</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2000" 
                  value={vdpExecutionDelay} 
                  onChange={(e) => setVdpExecutionDelay(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600" 
                />
              </div>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Enable Asymmetric Logic</h4>
                  <p className="text-xs text-gray-500 mt-1">Guarantees execution edge for the house.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={vdpAsymmetric} 
                    onChange={(e) => setVdpAsymmetric(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Dynamic Spread Widening
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Temporarily increase the spread before high-impact news. This triggers tight stop-losses and forces clients to enter at extremely unfavorable prices, locking in spread profit.
            </p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Current Base Spread</label>
                <input type="text" disabled value="0.10 (0.003%)" className="w-full border border-gray-200 rounded p-2 text-sm bg-gray-100 font-mono text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Markup Multiplier</label>
                <div className="flex gap-2">
                  <button onClick={() => setNewsMultiplier(1.0)} className={`flex-1 py-2 border rounded font-bold text-sm ${newsMultiplier === 1.0 ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>1x</button>
                  <button onClick={() => setNewsMultiplier(3.0)} className={`flex-1 py-2 border rounded font-bold text-sm ${newsMultiplier === 3.0 ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>3x</button>
                  <button onClick={() => setNewsMultiplier(5.0)} className={`flex-1 py-2 border rounded font-bold text-sm ${newsMultiplier === 5.0 ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>5x</button>
                  <button onClick={() => setNewsMultiplier(10.0)} className={`flex-1 py-2 border rounded font-bold text-sm ${newsMultiplier === 10.0 ? 'border-red-500 bg-red-50 text-red-700 shadow-sm' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>10x</button>
                </div>
              </div>
              <button onClick={handleApplyVdpSettings} className="w-full bg-red-600 text-white font-bold py-2.5 rounded shadow-sm hover:bg-red-700 transition-colors">
                Apply Spread Markup Instantly
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Overnight Financing (Swap Bleed)</h2>
            <p className="text-sm text-gray-600 mb-4">Silently increase overnight holding fees for clients holding long-term positions, gradually bleeding their margin to the house.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Long Position Daily Swap (%)</label>
                <input 
                  type="number" 
                  value={vdpLongSwap} 
                  onChange={(e) => setVdpLongSwap(parseFloat(e.target.value) || 0)}
                  step="0.001" 
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Short Position Daily Swap (%)</label>
                <input 
                  type="number" 
                  value={vdpShortSwap} 
                  onChange={(e) => setVdpShortSwap(parseFloat(e.target.value) || 0)}
                  step="0.001" 
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 font-medium" 
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleApplyVdpSettings} className="bg-purple-600 text-white font-bold px-4 py-2 text-sm rounded shadow-sm hover:bg-purple-700 transition-colors">
                Apply Holding Swap Rates
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profiling' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              A-Book / B-Book Hybrid Routing
            </h2>
            <p className="text-sm text-gray-600">
              Categorize clients based on historical performance. Keep consistent losers on B-Book (you keep their losses). Route consistent winners to A-Book (exchange) so you don't take the risk.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[11px] text-gray-500 uppercase bg-gray-100 border-b border-gray-200 tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-semibold">Client ID</th>
                  <th className="px-6 py-3 font-semibold text-right">Net PNL</th>
                  <th className="px-6 py-3 font-semibold text-center">Win Rate</th>
                  <th className="px-6 py-3 font-semibold">Current Route</th>
                  <th className="px-6 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loadingClients ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500 font-bold">Loading client routing metrics...</td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500 font-bold">No clients found.</td>
                  </tr>
                ) : clients.map(client => (
                  <tr key={client.id} className={`hover:bg-gray-50 ${client.book_type === 'A-Book' ? 'bg-blue-50/10' : ''}`}>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div>{client.full_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{client.client_id}</div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${client.net_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {client.net_pnl >= 0 ? '+' : ''}₹{client.net_pnl.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-600">{client.win_rate}% ({client.total_trades} trades)</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${client.book_type === 'A-Book' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {client.book_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleToggleBook(client.id, client.book_type)} 
                        className={`font-bold text-xs px-3 py-1.5 rounded transition-colors shadow-sm ${client.book_type === 'A-Book' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'}`}
                      >
                        Move to {client.book_type === 'A-Book' ? 'B-Book (Internal)' : 'A-Book (Hedging)'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'order_book' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] relative">
            {loadingBook && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-20"><RefreshCw className="h-6 w-6 text-gray-400 animate-spin" /></div>}
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-600" />
                Aggregated L2 Depth
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-0 flex flex-col text-sm font-mono">
              <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide sticky top-0 z-10">
                <div className="text-left">Orders</div>
                <div className="text-right">Size</div>
                <div className="text-right">Price</div>
              </div>
              <div className="flex flex-col-reverse divide-y divide-gray-50 border-b border-gray-200">
                {orderBook?.asks?.map((ask, i) => (
                  <div key={`ask-${i}`} className="grid grid-cols-3 gap-2 px-4 py-1.5 hover:bg-red-50 relative group cursor-pointer">
                    <div className="absolute right-0 top-0 bottom-0 bg-red-100 opacity-20" style={{ width: `${(ask.qty / 15000) * 100}%` }}></div>
                    <div className="text-left text-gray-500 z-10">{ask.orders}</div>
                    <div className="text-right text-gray-900 z-10">{ask.qty?.toLocaleString()}</div>
                    <div className="text-right text-red-600 font-bold z-10">{parseFloat(ask.price).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="py-2 text-center text-xs font-bold text-gray-500 bg-gray-50 border-b border-gray-200">
                Spread: 0.10 (0.003%) | Mark: {currentPrice ? currentPrice.toFixed(2) : 'Loading...'}
              </div>
              <div className="flex flex-col divide-y divide-gray-50">
                {orderBook?.bids?.map((bid, i) => (
                  <div key={`bid-${i}`} className="grid grid-cols-3 gap-2 px-4 py-1.5 hover:bg-green-50 relative group cursor-pointer">
                    <div className="absolute right-0 top-0 bottom-0 bg-green-100 opacity-20" style={{ width: `${(bid.qty / 15000) * 100}%` }}></div>
                    <div className="text-left text-gray-500 z-10">{bid.orders}</div>
                    <div className="text-right text-gray-900 z-10">{bid.qty?.toLocaleString()}</div>
                    <div className="text-right text-green-600 font-bold z-10">{parseFloat(bid.price).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-red-200 shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldAlert className="h-32 w-32 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900 mb-2 flex items-center gap-2 relative z-10">
              <Zap className="h-6 w-6" />
              Stop-Loss Radar (Liquidity Traps)
            </h2>
            <p className="text-sm text-red-700 mb-8 relative z-10">
              Identified clusters of client stop-loss orders. Sweeping these zones guarantees immediate PNL for the house before bouncing the price back.
            </p>

            <div className="space-y-4 relative z-10">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-bold text-lg text-red-900">Cluster at ₹2945.00</div>
                  <div className="text-sm text-red-700 mt-1 font-bold">12 Orders • 45,000 Qty</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-green-600 mb-2">PNL: +₹2,25,000</div>
                  <button onClick={() => handleTriggerRadar('crash')} className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded shadow-md w-full">
                    Trigger Flash Crash
                  </button>
                </div>
              </div>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-bold text-lg text-red-900">Cluster at ₹2960.00</div>
                  <div className="text-sm text-red-700 mt-1 font-bold">8 Orders • 22,000 Qty</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-green-600 mb-2">PNL: +₹1,10,000</div>
                  <button onClick={() => handleTriggerRadar('spike')} className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded shadow-md w-full">
                    Trigger Flash Spike
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
