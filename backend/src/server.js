require('dotenv').config(); // trigger reload
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// Import routes
const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const userRoutes = require('./routes/users');
const walletRoutes = require('./routes/wallet');
const instrumentRoutes = require('./routes/instruments');
const orderRoutes = require('./routes/orders');
const positionRoutes = require('./routes/positions');
const depositRoutes = require('./routes/deposits');
const withdrawalRoutes = require('./routes/withdrawals');
const bankAccountRoutes = require('./routes/bankAccounts');
const adminRoutes = require('./routes/admin');
const referralRoutes = require('./routes/referral');

// ── Import WebSocket ──
const { initSocketServer } = require('./ws/socketServer');
const { initPriceEngine } = require('./ws/priceEngine');

// ── Import Cron Jobs ──
require('./core/cron/referralCron');
require('./core/cron/marketHoursCron');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render, Cloudflare, etc.) for rate limiting
const server = createServer(app);
const PORT = process.env.PORT || 4000;

// ── Sentry Initialization ──
const IS_PROD = process.env.NODE_ENV === 'production';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  // 1.0 in dev captures everything; 0.1 in production is sufficient (10% sampling)
  tracesSampleRate: IS_PROD ? 0.1 : 1.0,
  profilesSampleRate: IS_PROD ? 0.05 : 1.0,
});


// ── Security Middleware ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'", 
        "wss:", 
        "ws:", 
        "https://*.supabase.co", 
        "https://finnhub.io", 
        "https://*.sentry.io",
        "http://localhost:4000",
        "ws://localhost:4000",
        "wss://localhost:4000"
      ],
      imgSrc: ["'self'", "data:", "https://*.supabase.co", "https://images.unsplash.com"],
      frameAncestors: [
        "'self'", 
        process.env.FRONTEND_URL || 'http://localhost:5173', 
        process.env.ADMIN_URL || 'http://localhost:5174',
        process.env.LANDING_URL || 'http://localhost:5175',
        'http://localhost:3000'
      ],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  xFrameOptions: { action: "sameorigin" },
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    const allowed = [
      // Production domains
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      process.env.LANDING_URL,
      // Explicit production fallbacks (in case env vars not set on Render yet)
      'https://web.stockslab.live',
      'https://backoffice.stockslab.live',
      'https://stockslab.live',
      // Local development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:4173',
    ].filter(Boolean);
    
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: IS_PROD ? (parseInt(process.env.RATE_LIMIT_MAX) || 500) : 99999,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Compression (gzip) — must be before routes ──
// Compresses all responses > 1KB. Saves ~70% on JSON payloads.
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
}));

// ── Body Parsing & Logging ──
const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// ── Serve uploaded static files ──
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const { getFeedStatus } = require('./ws/priceEngine');

// ── Health Check (minimal for cron-job.org or self-ping) ──
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// ── Render Free Tier Keep-Alive ──
// Render puts free web services to sleep after 15 minutes of inactivity.
// This cron pings the server's own external URL every 10 minutes to keep it awake.
const cron = require('node-cron');
const axios = require('axios');
cron.schedule('*/10 * * * *', async () => {
  const externalUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  try {
    await axios.get(`${externalUrl}/health`);
    console.log(`[Keep-Alive] Pinged ${externalUrl}/health successfully`);
  } catch (err) {
    console.warn(`[Keep-Alive] Ping failed:`, err.message);
  }
});

// ── Ready Check (degraded state detection) ──
app.get('/ready', (req, res) => {
  try {
    const feedStatus = getFeedStatus();
    const hasFinnhub = process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY !== 'your_finnhub_api_key_here';
    const isLiveRecentlyActive = feedStatus.lastLiveTickAge < 60000; // Received a tick in last 60s
    
    if (isLiveRecentlyActive) {
      res.status(200).json({
        status: 'ready',
        feeds: {
          nse_india: feedStatus.nse.status,
          finnhub: hasFinnhub ? feedStatus.finnhub.wsStatus : 'disabled',
          binance: feedStatus.binance.status,
        },
        symbolsTracked: feedStatus.totalSymbolsTracked,
      });
    } else if (process.env.NODE_ENV !== 'production') {
      res.status(200).json({ status: 'ready', feeds: { mode: 'development_simulator' } });
    } else {
      res.status(503).json({
        status: 'degraded',
        feeds: {
          nse_india: feedStatus.nse.status,
          finnhub: hasFinnhub ? feedStatus.finnhub.wsStatus : 'no_api_key',
          binance: feedStatus.binance.status,
        },
        lastTickAge: `${Math.round(feedStatus.lastLiveTickAge / 1000)}s ago`,
      });
    }
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referral', referralRoutes);

// Optional fallback route for testing Sentry
app.get('/debug-sentry', function mainHandler(req, res) {
  throw new Error('Sentry Testing Error!');
});

// ── Sentry Error Handler (must be after routes, before custom error handlers) ──
Sentry.setupExpressErrorHandler(app);

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    sentryId: res.sentry,
  });
});

// ── Start Server ──
server.listen(PORT, () => {
  console.log(`\n🚀 TradeX Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health\n`);
});

// ── Init Socket.IO Server ──
initSocketServer(server);
initPriceEngine();

// ── Init BullMQ Worker & MTM Calculator ──
const { executionWorker } = require('./core/workers/executionWorker');
const { startMTMCalculator } = require('./core/pnl/mtmCalculator');
const { initOHLCAggregator } = require('./ws/feed/ohlcAggregator');
startMTMCalculator();
initOHLCAggregator();
console.log('⚡ Execution Worker online | 📊 MTM Calculator running | 📊 OHLC Aggregator active');

module.exports = { app, server };
