const Redis = require('ioredis');

// For local dev, defaults to redis://localhost:6379
// In production, configure REDIS_URL in Render or .env
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`🔗 Redis connecting to: ${REDIS_URL.replace(/\/\/.*@/, '//***@')}`); // Log URL (masked)

/**
 * Parse REDIS_URL into a connection options object.
 * BullMQ needs raw options (not an ioredis client instance) so it can
 * create its own internal duplicate connections with maxRetriesPerRequest: null.
 */
function parseRedisUrl(url) {
  try {
    const parsed = new URL(url);
    const base = {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      keepAlive: 10000,
      pingInterval: 10000,           // Send application-level PINGs every 10s
      retryStrategy: (times) => {
        if (times % 10 === 0) {
          console.warn(`🔄 Redis reconnecting: attempt #${times}`);
        }
        return Math.min(times * 200, 5000);
      },
    };
    if (parsed.password) base.password = decodeURIComponent(parsed.password);
    if (parsed.username && parsed.username !== 'default') base.username = parsed.username;
    if (parsed.protocol === 'rediss:') base.tls = {};
    return base;
  } catch (err) {
    console.error('Failed to parse REDIS_URL:', err.message);
    return { host: 'localhost', port: 6379 };
  }
}

const baseOpts = parseRedisUrl(REDIS_URL);

/**
 * BullMQ options — requires maxRetriesPerRequest: null.
 * Uses the shared base options (offline queue enabled so BullMQ
 * can queue its own startup commands safely).
 */
const redisOpts = {
  ...baseOpts,
  maxRetriesPerRequest: null, // Required by BullMQ
};

/**
 * Primary cache client — used for key/value caching, rate limiting, risk keys.
 * enableOfflineQueue: false so a Redis blip immediately throws and falls back
 * to DB, rather than silently queuing requests and stalling the event loop.
 * commandTimeout: abort slow commands after 3s to prevent hung requests.
 */
const redisClient = new Redis({
  ...baseOpts,
  enableOfflineQueue: true,   // Allow queuing during initial startup connection
  connectTimeout: 5000,       // Fail connection attempt after 5s
  commandTimeout: 3000,       // Abort individual commands after 3s
});

/**
 * Pub/Sub clients — used by Socket.IO Redis adapter for horizontal scaling.
 * MUST keep enableOfflineQueue: true (default) so startup namespace registration
 * commands can be queued while the connection is still being established.
 * Setting enableOfflineQueue: false here causes the "Stream isn't writeable" error
 * at server startup when Socket.IO registers namespaces before Redis is ready.
 */
const pubClient = new Redis(baseOpts);
const subClient = new Redis(baseOpts);

// Basic error logging (non-crashing)
redisClient.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.error(`❌ Redis connection refused. Make sure REDIS_URL is set correctly!`);
  } else {
    console.error('Redis Client Error:', err.message);
  }
});

pubClient.on('error', (err) => {
  console.error('Redis Pub Client Error:', err.message);
});

subClient.on('error', (err) => {
  console.error('Redis Sub Client Error:', err.message);
});

redisClient.on('connect', () => console.log('✅ Connected to Redis (Primary)'));
redisClient.on('ready', () => {
  console.log('⚡ Redis Client (Primary) is ready. Disabling offline queue for runtime fail-fast behavior.');
  redisClient.options.enableOfflineQueue = false;
});
pubClient.on('connect', () => console.log('✅ Connected to Redis (Pub)'));
subClient.on('connect', () => console.log('✅ Connected to Redis (Sub)'));

module.exports = {
  redisClient,
  redisOpts, // Export raw options for BullMQ
  pubClient,
  subClient
};

