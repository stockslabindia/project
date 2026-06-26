require('dotenv').config();
const { redisClient } = require('../src/redis/client');

async function run() {
  console.log('Connecting to Redis/Valkey to check ticks...');
  
  if (!redisClient) {
    console.error('Redis client could not be loaded.');
    process.exit(1);
  }

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const keys = await redisClient.keys('tick:*');
    console.log(`Total active tick keys in Redis: ${keys.length}`);
    
    if (keys.length > 0) {
      console.log('\n--- Active Tick Samples ---');
      // Show up to 10 sample ticks
      const samples = keys.slice(0, 10);
      for (const key of samples) {
        const val = await redisClient.hgetall(key);
        const age = Math.round((Date.now() - parseInt(val.ts)) / 1000);
        console.log(`${key} => ltp: ${val.ltp}, bid: ${val.bid}, ask: ${val.ask}, age: ${age}s ago`);
      }
    } else {
      console.log('No tick keys found. It means no live ticks are being received or saved.');
    }
  } catch (err) {
    console.error('Error querying Redis:', err.message);
  }

  if (typeof redisClient.disconnect === 'function') {
    redisClient.disconnect();
  }
  process.exit(0);
}

run().catch(console.error);
