import { useEffect, useRef, useState, memo } from 'react';
import { createChart } from 'lightweight-charts';
import { io } from 'socket.io-client';
import { Loader2 } from 'lucide-react';

const TIMEFRAME_MINUTES = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1H': 60, '4H': 240, 'D': 1440, 'W': 10080, 'M': 43200,
  '1M': 1, '5M': 5, '15M': 15, '30M': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
  'd': 1440, 'w': 10080, 'm': 43200
};

function getBucketTime(timeSeconds, timeframe) {
  const intervalMin = TIMEFRAME_MINUTES[timeframe] || 5;
  if (intervalMin === 10080) { // 1w: Align to Monday 00:00 UTC
    const date = new Date(timeSeconds * 1000);
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff, 0, 0, 0, 0));
    return monday.getTime() / 1000;
  } else if (intervalMin === 1440) { // 1d: Align to UTC day start
    const date = new Date(timeSeconds * 1000);
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    return dayStart.getTime() / 1000;
  } else if (intervalMin === 43200) { // 1M: Align to calendar Month start
    const date = new Date(timeSeconds * 1000);
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
    return monthStart.getTime() / 1000;
  } else {
    const intervalSeconds = intervalMin * 60;
    return Math.floor(timeSeconds / intervalSeconds) * intervalSeconds;
  }
}

const LightweightChart = memo(function LightweightChart({ symbol, timeframe, livePrice }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const socketRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch historical data & initialize chart
  useEffect(() => {
    if (!containerRef.current) return;
    
    setLoading(true);
    setError(null);
    
    // Create chart instance
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0b0e14' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1c2030' },
        horzLines: { color: '#1c2030' },
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
      rightPriceScale: {
        borderColor: '#1c2030',
      },
      timeScale: {
        borderColor: '#1c2030',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    // Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    // Add Volume Series (Histogram overlaid)
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on the main pane
    });
    
    // Position volume at the bottom 20% of the pane
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Fetch candles from REST API
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    fetch(`${API_BASE}/instruments/${encodeURIComponent(symbol)}/candles?timeframe=${timeframe}&limit=500`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load chart data');
        return res.json();
      })
      .then(data => {
        if (data.candles && data.candles.length > 0) {
          const candleData = data.candles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          
          const volumeData = data.candles.map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
          }));
          
          candleSeries.setData(candleData);
          volumeSeries.setData(volumeData);
          
          // Save the last candle for live tick updates
          const lastCandle = candleData[candleData.length - 1];
          lastCandleRef.current = {
            ...lastCandle,
            volume: volumeData[volumeData.length - 1].value,
          };
          
          chart.timeScale().fitContent();
        } else {
          setError('No chart data available yet.');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    // Resize handler using ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.resize(width, height);
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      try {
        chart.remove();
      } catch (e) {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastCandleRef.current = null;
    };
  }, [symbol, timeframe]);

  // 2. WebSocket integration for candle close events (MARKET:CANDLE)
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:4000';
    
    const socket = io(`${API_URL}/market`, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('MARKET:SUBSCRIBE_TICKERS', [symbol]);
    });

    socket.on('MARKET:CANDLE', (data) => {
      if (data.symbol.toUpperCase() === symbol.toUpperCase() && candleSeriesRef.current && volumeSeriesRef.current) {
        const closedCandle = data.candle;
        const bucketTime = getBucketTime(closedCandle.time, timeframe);
        const last = lastCandleRef.current;
        
        let updatedCandle;
        
        if (last) {
          if (bucketTime === last.time) {
            // Update the existing forming candle (incorporate the new 1m data)
            updatedCandle = {
              time: bucketTime,
              open: last.open,
              high: Math.max(last.high, closedCandle.high),
              low: Math.min(last.low, closedCandle.low),
              close: closedCandle.close,
              volume: last.volume + closedCandle.volume
            };
          } else if (bucketTime > last.time) {
            // Start a new candle on the chart's timeframe
            updatedCandle = {
              time: bucketTime,
              open: closedCandle.open,
              high: closedCandle.high,
              low: closedCandle.low,
              close: closedCandle.close,
              volume: closedCandle.volume
            };
          } else {
            // Out of order or old bucket, skip
            return;
          }
        } else {
          // No historical candle exists, set this as the first candle
          updatedCandle = {
            time: bucketTime,
            open: closedCandle.open,
            high: closedCandle.high,
            low: closedCandle.low,
            close: closedCandle.close,
            volume: closedCandle.volume
          };
        }

        candleSeriesRef.current.update({
          time: updatedCandle.time,
          open: updatedCandle.open,
          high: updatedCandle.high,
          low: updatedCandle.low,
          close: updatedCandle.close
        });

        volumeSeriesRef.current.update({
          time: updatedCandle.time,
          value: updatedCandle.volume,
          color: updatedCandle.close >= updatedCandle.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
        });

        // Set lastCandleRef to this newly updated/completed candle
        lastCandleRef.current = updatedCandle;
        setError(null); // Clear error overlay since we now have chart data!
      }
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // 3. Real-time price feed tick integration (LTP updates the current candle)
  useEffect(() => {
    if (!candleSeriesRef.current || !livePrice) return;
    
    const last = lastCandleRef.current;
    const bucketTime = getBucketTime(Date.now() / 1000, timeframe);
    
    let updated;
    
    if (last) {
      if (bucketTime === last.time) {
        updated = {
          ...last,
          high: Math.max(last.high, livePrice),
          low: Math.min(last.low, livePrice),
          close: livePrice,
        };
      } else if (bucketTime > last.time) {
        // Start a new candle on tick (before closed candle event arrives)
        updated = {
          time: bucketTime,
          open: livePrice,
          high: livePrice,
          low: livePrice,
          close: livePrice,
          volume: 0
        };
      } else {
        return;
      }
    } else {
      // First tick on empty chart
      updated = {
        time: bucketTime,
        open: livePrice,
        high: livePrice,
        low: livePrice,
        close: livePrice,
        volume: 1
      };
    }
    
    candleSeriesRef.current.update({
      time: updated.time,
      open: updated.open,
      high: updated.high,
      low: updated.low,
      close: updated.close,
    });
    
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.update({
        time: updated.time,
        value: updated.volume,
        color: updated.close >= updated.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
      });
    }

    lastCandleRef.current = updated;
    setError(null); // Clear error overlay since we now have chart data!
  }, [livePrice, timeframe]);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-[#0b0e14]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e14]/80 z-10">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e14] z-10 px-4 text-center">
          <div className="max-w-xs">
            <p className="text-red-400 font-semibold text-sm">{error}</p>
            <p className="text-xs text-text-muted mt-2">Historical past data is empty for this symbol. Waiting for live feed data...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export default LightweightChart;
