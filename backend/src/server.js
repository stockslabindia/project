require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // trigger reload
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// ── Sentry Initialization (must be called before requiring express) ──
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

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');

// ── Startup diagnostics (non-sensitive) ──
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[WARN] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Check your .env file.');
}


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
const supportRoutes = require('./routes/support');
const affiliateRoutes = require('./routes/affiliates');
const telegramRoutes = require('./routes/telegram');
const providerRoutes = require('./routes/provider');
const optionsRoutes = require('./routes/options');


// ── Import WebSocket ──
const { initSocketServer } = require('./ws/socketServer');
const { initPriceEngine } = require('./ws/priceEngine');

// ── Import Telegram ──
const { bot } = require('./core/telegram/bot');
const { setupRouter } = require('./core/telegram/router');

// ── Import Cron Jobs ──
require('./core/cron/referralCron');
require('./core/cron/marketHoursCron');
require('./core/cron/dailyReportCron');
require('./core/cron/authCleanupCron');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render, Cloudflare, etc.) for rate limiting
const server = createServer(app);
const PORT = process.env.PORT || 4000;


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
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002'
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
      process.env.AFFILIATE_PORTAL_URL,
      process.env.BACKEND_URL,
      // Explicit production fallbacks
      'https://web.stockslab.live',
      'https://backoffice.stockslab.live',
      'https://stockslab.live',
      'https://earnwith.stockslab.live',
      'https://api.stockslab.live',    // backend's own public URL (self-callbacks)
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
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
// Feed-status is a telemetry endpoint used by the authenticated admin panel. It
// has its own limiter so routine monitoring cannot exhaust the public API bucket.
const adminTelemetryPaths = new Set([
  '/api/admin/feed/status',
  '/api/admin/animator-settings',
]);

const adminTelemetryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.ADMIN_TELEMETRY_RATE_LIMIT_MAX) || 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many monitoring requests, please try again later.' },
});

app.use('/api/admin/feed/status', adminTelemetryLimiter);
app.use('/api/admin/animator-settings', adminTelemetryLimiter);

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: IS_PROD ? (parseInt(process.env.RATE_LIMIT_MAX) || 500) : 99999,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' && adminTelemetryPaths.has(req.originalUrl.split('?')[0]),
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
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
// In production: log only failed requests (status >= 400) to reduce stdout I/O.
// In development: use verbose 'dev' format for easy debugging.
if (IS_PROD) {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
  }));
} else {
  app.use(morgan('dev'));
}

// ── Serve uploaded static files ──
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const { authenticateUser, authenticateAdmin, authenticateAffiliate } = require('./middleware/auth');

// Flexible middleware to authenticate any valid session (User, Admin, or Affiliate) for file downloads
async function authenticateAny(req, res, next) {
  let authenticated = false;

  // 1. Try Admin auth
  try {
    await new Promise((resolve, reject) => {
      authenticateAdmin(req, res, (err) => {
        if (err || res.headersSent) reject(err || new Error('Auth failed'));
        else resolve();
      });
    });
    authenticated = true;
  } catch (e) {
    if (res.headersSent) return;
  }

  if (authenticated) return next();

  // 2. Try User auth
  try {
    await new Promise((resolve, reject) => {
      authenticateUser(req, res, (err) => {
        if (err || res.headersSent) reject(err || new Error('Auth failed'));
        else resolve();
      });
    });
    authenticated = true;
  } catch (e) {
    if (res.headersSent) return;
  }

  if (authenticated) return next();

  // 3. Try Affiliate auth
  try {
    await new Promise((resolve, reject) => {
      authenticateAffiliate(req, res, (err) => {
        if (err || res.headersSent) reject(err || new Error('Auth failed'));
        else resolve();
      });
    });
    authenticated = true;
  } catch (e) {
    if (res.headersSent) return;
  }

  if (authenticated) return next();

  // Return unauthorized if all failed
  return res.status(401).json({ error: 'Unauthorized to access files' });
}

app.get('/uploads/:filename', authenticateAny, (req, res) => {
  const filename = req.params.filename;
  // Prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Auth logic:
  // If it's a KYC document (starts with kyc_<userId>_...)
  if (filename.startsWith('kyc_')) {
    const parts = filename.split('_');
    const fileOwnerId = parts[1]; // kyc_<userId>_...
    const isOwner = req.user && req.user.id === fileOwnerId;
    const isAdmin = !!req.admin;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }
  }

  // Set secure headers for file download/display
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  res.sendFile(filePath);
});


// ── CSRF / Origin Enforcement ──────────────────────────────────────────────────
// For state-changing requests (POST/PUT/DELETE/PATCH) we verify that the Origin
// or Referer header is one of the known frontend origins. This is defence-in-depth
// alongside SameSite=Lax cookies. Requests with no Origin header (server-to-server,
// health checks, mobile apps with Authorization header) are allowed through.
const CSRF_ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  process.env.LANDING_URL,
  process.env.AFFILIATE_PORTAL_URL,
  'https://web.stockslab.live',
  'https://backoffice.stockslab.live',
  'https://stockslab.live',
  'https://earnwith.stockslab.live',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:4173',
].filter(Boolean);

app.use((req, res, next) => {
  // Only enforce on mutating methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // If there is no Origin header the request is likely server-to-server or from
  // a native app using the Authorization header — allow it through.
  if (!origin && !referer) return next();

  const source = origin || (referer ? new URL(referer).origin : null);
  if (source && !CSRF_ALLOWED_ORIGINS.includes(source)) {
    return res.status(403).json({ error: 'Request origin not allowed' });
  }

  next();
});


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
app.use('/api/support', supportRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/admin/feed', providerRoutes);
app.use('/api/options', optionsRoutes);


// Sentry test route — only available in non-production environments
if (!IS_PROD) {
  app.get('/debug-sentry', function mainHandler(req, res) {
    throw new Error('Sentry Testing Error!');
  });
}

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

// ── Init BullMQ Workers, MTM Calculator & Email Worker ──
const { executionWorker } = require('./core/workers/executionWorker');
const { startMTMCalculator } = require('./core/pnl/mtmCalculator');
const { initOHLCAggregator } = require('./ws/feed/ohlcAggregator');
const { startEmailWorker } = require('./core/workers/emailWorker');
startMTMCalculator();
initOHLCAggregator();
startEmailWorker();
// ── Init Cron Jobs ──
require('./core/cron/referralCron');
require('./core/cron/affiliateNetLossCron');

// ── Init Options Seeding & Expiry Settler ──
const { seedOptionContracts } = require('./services/optionSeedService');
const { processOptionsExpirySettlement } = require('./core/expiry/expirySettler');

// Seed contracts on startup
seedOptionContracts().catch(err => console.error('[OPTION_SEED] Startup seed failed:', err.message));

// Schedule daily seed job at 07:00 IST (01:30 UTC)
cron.schedule('30 1 * * *', () => {
  console.log('[CRON] Running daily option contract seeding & expiry maintenance...');
  seedOptionContracts().catch(err => console.error('[CRON] Daily option seed failed:', err.message));
});

// Schedule options expiry settlement at 15:31 IST (10:01 UTC) on Tuesdays (day 2)
cron.schedule('1 10 * * 2', () => {
  console.log('[CRON] Running options Tuesday expiry settlement...');
  processOptionsExpirySettlement().catch(err => console.error('[CRON] Options expiry settlement failed:', err.message));
});

console.log('⚡ Execution Worker online | 📊 MTM Calculator running | 📊 OHLC Aggregator active | 📧 Email Worker online | 📈 Option Seeding active');

// ── Init Telegram Bot ──
if (bot) {
  // Global error handler — prevents any Telegram API error from crashing the process
  bot.catch((err, ctx) => {
    console.error('[Telegram] Unhandled bot error:', err.message);
  });

  setupRouter();

  if (process.env.NODE_ENV === 'production') {
    const backendUrl = process.env.BACKEND_URL || 'https://api.stockslab.live';
    const webhookPath = '/api/telegram/webhook';
    const webhookUrl = `${backendUrl}${webhookPath}`;

    bot.telegram.setWebhook(webhookUrl)
      .then(() => {
        console.log(`[Telegram] Webhook set successfully to ${webhookUrl} 🚀`);
      })
      .catch((err) => {
        console.error('[Telegram] Failed to set webhook:', err);
      });
  } else {
    // In local development, use long polling
    bot.launch({ dropPendingUpdates: false }).then(() => {
      console.log('[Telegram] Bot polling launched successfully 🚀');
    }).catch((err) => {
      console.error('[Telegram] Failed to launch bot:', err);
    });
  }
  
  // Enable graceful stop
  process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch (e) {} });
  process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch (e) {} });
}

module.exports = { app, server };

