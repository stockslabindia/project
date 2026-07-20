import { useState, useEffect, useRef } from 'react';
import { Radio, RefreshCw, AlertTriangle, Wifi, WifiOff, Activity, ShieldAlert, Cpu } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function FeedStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const [fyersToken, setFyersToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  const [animatorSettings, setAnimatorSettings] = useState({});
  const [animatorStats, setAnimatorStats] = useState(null);
  const [updatingSegment, setUpdatingSegment] = useState(null);
  const [statusUpdatedAt, setStatusUpdatedAt] = useState(0);
  const statusRequestInFlight = useRef(false);

  const fetchStatus = async (isManual = false) => {
    // Avoid overlapping requests when the backend is slow or the browser tab
    // resumes after being in the background.
    if (statusRequestInFlight.current) return;
    statusRequestInFlight.current = true;

    try {
      if (isManual) setRefreshing(true);
      setError(null);

      const [feedRes, animatorRes] = await Promise.allSettled([
        adminApi.getFeedStatus(),
        adminApi.getAnimatorSettings()
      ]);

      if (feedRes.status === 'fulfilled' && feedRes.value?.success) {
        setData(feedRes.value.status);
      } else if (feedRes.status === 'rejected') {
        throw new Error(feedRes.reason?.message || 'Failed to load live feed status');
      } else if (feedRes.value && !feedRes.value.success) {
        throw new Error(feedRes.value.error || 'Failed to load live feed status');
      }

      if (animatorRes.status === 'fulfilled' && animatorRes.value?.success) {
        setAnimatorSettings(animatorRes.value.settings || {});
        setAnimatorStats(animatorRes.value.stats || null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load live feed status');
    } finally {
      statusRequestInFlight.current = false;
      setStatusUpdatedAt(Date.now());
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initialFetch = setTimeout(() => fetchStatus(), 0);
    // Monitoring does not need tick-level polling. 15 seconds stays well below
    // the authenticated telemetry limit while retaining a responsive status UI.
    const interval = setInterval(() => fetchStatus(), 15000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, []);

  const handleToggleAnimator = async (segment, enabled) => {
    try {
      setUpdatingSegment(segment);
      const res = await adminApi.updateAnimatorSetting(segment, enabled);
      if (res && res.success) {
        setAnimatorSettings(res.settings || {});
        // Refresh details
        const fresh = await adminApi.getAnimatorSettings();
        if (fresh && fresh.success) {
          setAnimatorSettings(fresh.settings || {});
          setAnimatorStats(fresh.stats || null);
        }
      } else {
        throw new Error(res.error || 'Failed to update animator settings');
      }
    } catch (err) {
      alert(`Error updating animator: ${err.message}`);
    } finally {
      setUpdatingSegment(null);
    }
  };

  const handleResetFyers = async () => {
    const confirmReset = window.confirm(
      'Are you sure you want to reset the Fyers connection circuit breaker?\nThis will clear the connection attempt limit and trigger an immediate reconnect.'
    );
    if (!confirmReset) return;

    try {
      setResetting(true);
      const res = await adminApi.resetFyersFeed();
      if (res && res.success) {
        alert('Fyers feed reset successfully! Triggered WebSocket reconnection.');
        fetchStatus();
      } else {
        throw new Error(res.error || 'Failed to reset Fyers feed');
      }
    } catch (err) {
      alert(`Error resetting Fyers feed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const handleSwitchProvider = async (provider) => {
    try {
      setSwitching(true);
      const res = await adminApi.switchIndianFeed(provider);
      if (res && res.success) {
        alert(res.message || `Switched feed to ${provider}`);
        fetchStatus(true);
      } else {
        throw new Error(res.error || 'Failed to switch feed provider');
      }
    } catch (err) {
      alert(`Error switching feed: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  const handleSaveFyersToken = async () => {
    if (!fyersToken.trim()) return alert('Please enter a valid token');
    setSavingToken(true);
    try {
      const res = await adminApi.setFyersToken(fyersToken.trim());
      if (res && res.success) {
        alert(res.message || 'Token updated successfully');
        setFyersToken('');
        fetchStatus(true);
      } else {
        throw new Error(res.error || 'Failed to update token');
      }
    } catch (err) {
      alert(`Error updating token: ${err.message}`);
    } finally {
      setSavingToken(false);
    }
  };

  const formatAge = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return 'N/A';
    if (ms > 864000000) return 'Never';
    const sec = Math.floor(ms / 1000);
    if (sec < 0) return '0s ago';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    return `${min}m ${sec % 60}s ago`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-2">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <p className="font-medium text-sm">Loading live tick feeds status...</p>
      </div>
    );
  }

  // Determine market-type active status and current providers
  const isFyersActive = data?.fyers?.status === 'CONNECTED';
  const isShoonyaActive = data?.shoonya?.status === 'CONNECTED';
  const isNseActive = data?.nse?.status === 'CONNECTED';
  const activeProvider = data?.activeIndianFeed || 'shoonya';
  
  // 1. Indian Equities & Futures
  const indianFeedActive = activeProvider === 'shoonya'
    ? (isShoonyaActive ? 'Shoonya (Primary)' : (isNseActive ? 'Yahoo (Fallback)' : 'None'))
    : (isFyersActive ? 'Fyers (Primary)' : (isNseActive ? 'Yahoo (Fallback)' : 'None'));
  const indianFeedStatus = activeProvider === 'shoonya'
    ? (isShoonyaActive ? 'primary' : (isNseActive ? 'fallback' : 'offline'))
    : (isFyersActive ? 'primary' : (isNseActive ? 'fallback' : 'offline'));

  // 2. US Stocks & Forex: Finnhub WS / Polling
  const usFeedActive = data?.finnhub?.wsStatus === 'CONNECTED' ? 'Finnhub WS (Primary)' : (data?.finnhub?.pollSymbolCount > 0 ? 'Finnhub REST (Fallback)' : 'None');
  const usFeedStatus = data?.finnhub?.wsStatus === 'CONNECTED' ? 'primary' : (data?.finnhub?.pollSymbolCount > 0 ? 'fallback' : 'offline');

  // 3. Crypto: Binance WS
  const cryptoFeedActive = data?.binance?.status === 'CONNECTED' ? 'Binance WS (Primary)' : 'None';
  const cryptoFeedStatus = data?.binance?.status === 'CONNECTED' ? 'primary' : 'offline';

  // 4. Global Indices: Finnhub / Yahoo (internal charting fallback)
  const indicesFeedActive = data?.finnhub?.wsStatus === 'CONNECTED' ? 'Finnhub WS' : 'Yahoo Finance (Chart API)';
  const indicesFeedStatus = data?.finnhub?.wsStatus === 'CONNECTED' ? 'primary' : 'fallback';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="h-6 w-6 text-blue-600 animate-pulse" />
            Live Tick Feed Status
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor real-time price feeds, fallback statuses, data tick frequency, and control feed circuit breakers.
          </p>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center rounded-md text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 h-10 px-4 transition-all"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Force Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Error loading live feeds</h4>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Feed Selection Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Indian Market Data Source</h3>
        <p className="text-sm text-gray-500 mb-4">Select which broker API to use as the primary live feed for Indian Equities and F&O.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => handleSwitchProvider('shoonya')} 
            disabled={switching}
            className={`flex-1 p-4 border rounded-lg flex flex-col items-center justify-center transition-all ${
              activeProvider === 'shoonya' 
                ? 'border-blue-500 bg-blue-50 shadow-sm' 
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="font-bold text-gray-900">Shoonya</div>
            <div className={`text-xs mt-1 font-semibold ${isShoonyaActive ? 'text-green-600' : 'text-gray-500'}`}>
              {isShoonyaActive ? 'CONNECTED' : (data?.shoonya?.status || 'STANDBY')}
            </div>
            <div className="text-xs text-gray-400 mt-2 text-center">(Fully Automated via QuickAuth API)</div>
          </button>

          <button 
            onClick={() => handleSwitchProvider('fyers')} 
            disabled={switching}
            className={`flex-1 p-4 border rounded-lg flex flex-col items-center justify-center transition-all ${
              activeProvider === 'fyers' 
                ? 'border-blue-500 bg-blue-50 shadow-sm' 
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="font-bold text-gray-900">Fyers</div>
            <div className={`text-xs mt-1 font-semibold ${isFyersActive ? 'text-green-600' : 'text-gray-500'}`}>
              {isFyersActive ? 'CONNECTED' : (data?.fyers?.status || 'STANDBY')}
            </div>
            <div className="text-xs text-gray-400 mt-2 text-center">(Manual Daily Login Required)</div>
          </button>
        </div>
      </div>

      {/* Global Health Bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Active Price Streamers</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{data?.totalSymbolsTracked || 0} Symbols</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            (data?.lastLiveTickAge || 0) < 10000 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {(data?.lastLiveTickAge || 0) < 10000 ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Time Since Last Tick</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatAge(data?.lastLiveTickAge)}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Primary Feed Status</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isFyersActive ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
              <span className="text-sm font-bold text-gray-900">{isFyersActive ? 'Fyers Live' : 'Fallback Active'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* High-Frequency Price Animator Control Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-blue-600" />
            High-Frequency Price Animator Control
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Toggle the artificial price animator for each market segment. Turning a segment <strong>OFF</strong> bypasses random-walk price animations, broadcasting exact, flat exchange ticks directly to clients.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { id: 'nse_stocks', label: 'NSE Stocks', desc: 'Indian Equities (NSE/BSE)' },
            { id: 'mcx', label: 'MCX Commodities', desc: 'Metal, Energy & Agriculture Futures' },
            { id: 'forex', label: 'Forex Currencies', desc: 'USD, EUR, GBP & INR Pairs' },
            { id: 'crypto', label: 'Cryptocurrencies', desc: 'BTC, ETH, SOL & Altcoins' },
            { id: 'us_stocks', label: 'US Stocks', desc: 'NASDAQ & NYSE Equities' },
            { id: 'global_indices', label: 'Global Indices', desc: 'NIFTY, BANKNIFTY & DJI Benchmarks' },
          ].map((seg) => {
            const isEnabled = !!animatorSettings[seg.id];
            const isUpdating = updatingSegment === seg.id;
            
            return (
              <div key={seg.id} className="border border-gray-150 rounded-lg p-4 bg-gray-50/50 flex flex-col justify-between space-y-4 hover:shadow-sm transition-all dark:border-gray-800">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-sm">{seg.label}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                      isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isEnabled ? 'flicker active' : 'flat feed'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-normal">{seg.desc}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleAnimator(seg.id, true)}
                    disabled={isUpdating}
                    className={`flex-1 inline-flex items-center justify-center rounded-md text-xs font-bold h-8 transition-colors select-none cursor-pointer ${
                      isEnabled 
                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' 
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => handleToggleAnimator(seg.id, false)}
                    disabled={isUpdating}
                    className={`flex-1 inline-flex items-center justify-center rounded-md text-xs font-bold h-8 transition-colors select-none cursor-pointer ${
                      !isEnabled 
                        ? 'bg-gray-800 text-white shadow-sm hover:bg-gray-900' 
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {animatorStats && (
          <div className="bg-blue-50/40 border border-blue-100/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-blue-800">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <span className="text-blue-600 font-semibold uppercase tracking-wider block text-[10px]">Animator Status</span>
                <span className="font-bold text-sm text-blue-900">{animatorStats.running ? 'Running' : 'Stopped'}</span>
              </div>
              <div>
                <span className="text-blue-600 font-semibold uppercase tracking-wider block text-[10px]">Active Watchlist Keys</span>
                <span className="font-bold text-sm text-blue-900">{animatorStats.anchorSymbols} symbols</span>
              </div>
              <div>
                <span className="text-blue-600 font-semibold uppercase tracking-wider block text-[10px]">Broadcast Frequency</span>
                <span className="font-bold text-sm text-blue-900">~{animatorStats.ticksPerSecond} ticks/sec</span>
              </div>
              <div>
                <span className="text-blue-600 font-semibold uppercase tracking-wider block text-[10px]">Total Ticks Dispatched</span>
                <span className="font-bold text-sm text-blue-900">{animatorStats.totalMicroTicks?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market Segments Status Board */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-gray-700" />
          Active Market Feed Mapping
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Indian Equities & Futures */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Indian Stocks & F&O</div>
              <h4 className="text-lg font-extrabold text-gray-900 mt-0.5">NSE / NFO</h4>
            </div>
            <div>
              <div className="text-xs text-gray-500">Active Price Provider:</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{indianFeedActive}</div>
            </div>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                indianFeedStatus === 'primary' ? 'bg-green-100 text-green-700' : (indianFeedStatus === 'fallback' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')
              }`}>
                {indianFeedStatus === 'primary' ? 'primary active' : (indianFeedStatus === 'fallback' ? 'fallback active' : 'offline')}
              </span>
            </div>
          </div>

          {/* US Stocks & Forex */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">US Equities & Forex</div>
              <h4 className="text-lg font-extrabold text-gray-900 mt-0.5">US / FX / Currencies</h4>
            </div>
            <div>
              <div className="text-xs text-gray-500">Active Price Provider:</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{usFeedActive}</div>
            </div>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                usFeedStatus === 'primary' ? 'bg-green-100 text-green-700' : (usFeedStatus === 'fallback' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')
              }`}>
                {usFeedStatus === 'primary' ? 'primary active' : (usFeedStatus === 'fallback' ? 'fallback active' : 'offline')}
              </span>
            </div>
          </div>

          {/* Crypto */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cryptocurrencies</div>
              <h4 className="text-lg font-extrabold text-gray-900 mt-0.5">Crypto Pairs</h4>
            </div>
            <div>
              <div className="text-xs text-gray-500">Active Price Provider:</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{cryptoFeedActive}</div>
            </div>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                cryptoFeedStatus === 'primary' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {cryptoFeedStatus === 'primary' ? 'primary active' : 'offline'}
              </span>
            </div>
          </div>

          {/* Global Indices */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Indices & Benchmarks</div>
              <h4 className="text-lg font-extrabold text-gray-900 mt-0.5">DJI / NASDAQ / NIFTY</h4>
            </div>
            <div>
              <div className="text-xs text-gray-500">Active Price Provider:</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{indicesFeedActive}</div>
            </div>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                indicesFeedStatus === 'primary' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {indicesFeedStatus === 'primary' ? 'primary active' : 'fallback active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Shoonya Panel */}
        <div className={`bg-white rounded-lg border ${activeProvider === 'shoonya' ? 'border-blue-300 ring-1 ring-blue-300' : 'border-gray-200'} shadow-sm p-6 space-y-6 flex flex-col justify-between`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-bold text-gray-900">Shoonya Feed</h4>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider ${
                isShoonyaActive ? 'bg-green-100 text-green-800' : (data?.shoonya?.status === 'CONNECTING' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-red-100 text-red-800')
              }`}>
                {data?.shoonya?.status || 'UNKNOWN'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
              <div>
                <span className="text-gray-500 block">Total Ticks Streamed</span>
                <span className="font-bold text-gray-800 text-base">{(data?.shoonya?.stats?.ticksReceived || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Connection Failures</span>
                <span className="font-bold text-red-600 text-base">{data?.shoonya?.stats?.reconnectCount || 0}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 block">Last Feed Update</span>
                <span className="font-bold text-gray-800 text-base">{formatAge(data?.shoonya?.stats?.lastTickTime ? statusUpdatedAt - data.shoonya.stats.lastTickTime : null)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Fyers Panel */}
        <div className={`bg-white rounded-lg border ${activeProvider === 'fyers' ? 'border-blue-300 ring-1 ring-blue-300' : 'border-gray-200'} shadow-sm p-6 space-y-6 flex flex-col justify-between`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-bold text-gray-900">Fyers (Primary Indian Feed)</h4>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider ${
                isFyersActive ? 'bg-green-100 text-green-800' : (data?.fyers?.status === 'CONNECTING' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-red-100 text-red-800')
              }`}>
                {data?.fyers?.status || 'UNKNOWN'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
              <div>
                <span className="text-gray-500 block">Active Subscriptions</span>
                <span className="font-bold text-gray-800 text-base">{data?.fyers?.activeSymbolCount || 0} symbols</span>
              </div>
              <div>
                <span className="text-gray-500 block">Total Ticks Streamed</span>
                <span className="font-bold text-gray-800 text-base">{(data?.fyers?.stats?.ticksReceived || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Connection Failures</span>
                <span className="font-bold text-red-600 text-base">{data?.fyers?.stats?.errorsEncountered || 0}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Last Feed Update</span>
                <span className="font-bold text-gray-800 text-base">{formatAge(data?.fyers?.stats?.lastTickTime ? statusUpdatedAt - data.fyers.stats.lastTickTime : null)}</span>
              </div>
            </div>

            {data?.fyers?.stats?.lastError && (
              <div className="text-xs bg-red-50 border border-red-100 text-red-700 p-2.5 rounded">
                <strong>Last error:</strong> {data?.fyers?.stats?.lastError}
              </div>
            )}

            {/* Manual Token Entry */}
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
              <h5 className="text-sm font-bold text-gray-900 mb-2">Manual Access Token</h5>
              <p className="text-xs text-gray-500 mb-3">
                If automated login fails, you can use a manual token. <br />
                <a href="https://fyers.in/web/api-dashboard/user-apps" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Click here to go to the new Fyers API Dashboard
                </a>
              </p>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  value={fyersToken}
                  onChange={(e) => setFyersToken(e.target.value)}
                  placeholder="Paste long access token here..." 
                  className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <button 
                  onClick={handleSaveFyersToken}
                  disabled={savingToken}
                  className="inline-flex items-center justify-center rounded-md text-xs font-extrabold uppercase bg-gray-900 text-white hover:bg-black h-9 px-4 select-none shrink-0 transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingToken ? 'Saving...' : 'Apply Token'}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500 max-w-xs">
              If the feed stops tick streams, the circuit breaker halts reconnections after 10 attempts to avoid flooding. Reset manually here to retry.
            </div>
            <button
              onClick={handleResetFyers}
              disabled={resetting}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-md text-xs font-extrabold uppercase bg-red-600 text-white hover:bg-red-700 h-9 px-4 select-none shrink-0 transition-colors shadow-sm disabled:opacity-50"
            >
              Reset Circuit Breaker
            </button>
          </div>
        </div>

        {/* Finnhub Panel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-bold text-gray-900">Finnhub (US Stocks, Forex & Indices)</h4>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider ${
              data?.finnhub?.wsStatus === 'CONNECTED' ? 'bg-green-100 text-green-800' : (data?.finnhub?.wsStatus === 'CONNECTING' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-red-100 text-red-800')
            }`}>
              {data?.finnhub?.wsStatus || 'DISABLED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
            <div>
              <span className="text-gray-500 block">WS Subscribed</span>
              <span className="font-bold text-gray-800 text-base">{data?.finnhub?.subscribedCount || 0} symbols</span>
            </div>
            <div>
              <span className="text-gray-500 block">REST Polled</span>
              <span className="font-bold text-gray-800 text-base">{data?.finnhub?.pollSymbolCount || 0} symbols</span>
            </div>
            <div>
              <span className="text-gray-500 block">WebSocket Ticks</span>
              <span className="font-bold text-gray-800 text-base">{(data?.finnhub?.stats?.wsTicksReceived || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500 block">REST Quote Ticks</span>
              <span className="font-bold text-gray-800 text-base">{(data?.finnhub?.stats?.pollTicksReceived || 0).toLocaleString()}</span>
            </div>
          </div>

          {data?.finnhub?.stats?.lastError && (
            <div className="text-xs bg-red-50 border border-red-100 text-red-700 p-2.5 rounded">
              <strong>Last error:</strong> {data?.finnhub?.stats?.lastError}
            </div>
          )}
        </div>

        {/* Yahoo Finance Panel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-bold text-gray-900">Yahoo Finance (Delayed Fallback Feed)</h4>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider ${
              data?.nse?.status === 'CONNECTED' ? 'bg-green-100 text-green-800 animate-pulse' : 'bg-gray-100 text-gray-800'
            }`}>
              {data?.nse?.status === 'CONNECTED' ? 'POLLING' : 'STANDBY'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
            <div>
              <span className="text-gray-500 block">Active Polling List</span>
              <span className="font-bold text-gray-800 text-base">{data?.nse?.activeSymbolsCount || 0} symbols</span>
            </div>
            <div>
              <span className="text-gray-500 block">Ticks Received</span>
              <span className="font-bold text-gray-800 text-base">{(data?.nse?.stats?.ticksReceived || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500 block">API Errors</span>
              <span className="font-bold text-red-600 text-base">{data?.nse?.stats?.errorsEncountered || 0}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Last Tick Timestamp</span>
              <span className="font-bold text-gray-800 text-base">{formatAge(data?.nse?.stats?.lastTickTime ? statusUpdatedAt - data.nse.stats.lastTickTime : null)}</span>
            </div>
          </div>
        </div>

        {/* Binance Panel */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-bold text-gray-900">Binance (Crypto Feed)</h4>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider ${
              data?.binance?.status === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {data?.binance?.status || 'DISCONNECTED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-md">
            <div>
              <span className="text-gray-500 block">Ticks Received</span>
              <span className="font-bold text-gray-800 text-base">{(data?.binance?.stats?.ticksReceived || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Stream Errors</span>
              <span className="font-bold text-red-600 text-base">{data?.binance?.stats?.errorsEncountered || 0}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 block">Last Tick Streamed</span>
              <span className="font-bold text-gray-800 text-base">{formatAge(data?.binance?.stats?.lastTickTime ? statusUpdatedAt - data.binance.stats.lastTickTime : null)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
