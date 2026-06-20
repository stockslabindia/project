require('dotenv').config();
const { redisClient } = require('../src/redis/client');

async function run() {
  try {
    console.log('1. Clearing Redis cache keys for instruments...');
    const keysToDelete = ['instruments:active_list', 'symbols:active_instruments'];
    
    for (const key of keysToDelete) {
      const deleted = await redisClient.del(key);
      console.log(`Deleted key "${key}": ${deleted ? 'YES' : 'NO (did not exist)'}`);
    }

    console.log('2. Querying all keys matching "instruments:*" or "symbols:*" to be thorough...');
    const keys = await redisClient.keys('*');
    console.log(`Total keys in Redis: ${keys.length}`);
    const filteredKeys = keys.filter(k => k.includes('instrument') || k.includes('symbol'));
    
    if (filteredKeys.length > 0) {
      console.log(`Deleting additional matching keys:`, filteredKeys);
      await redisClient.del(...filteredKeys);
    }

    console.log('Redis cache cleared successfully!');
  } catch (err) {
    console.error('Failed to clear Redis cache:', err);
  }
  process.exit(0);
}

// Wait for connection and run
redisClient.on('connect', () => {
  run();
});
