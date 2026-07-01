require('dotenv').config();
const { fyersFeed } = require('../src/services/fyersFeed');
const { redisClient } = require('../src/redis/client');

async function run() {
  console.log('Starting FyersFeed service test...');
  
  fyersFeed.on('status', (status) => {
    console.log(`Feed status changed: ${status}`);
  });

  fyersFeed.on('tick', (tick) => {
    console.log('Received tick event:', tick.symbol, 'Price:', tick.price);
  });

  const started = await fyersFeed.start();
  if (!started) {
    console.error('Failed to start FyersFeed.');
    process.exit(1);
  }

  console.log('FyersFeed started. Waiting 5 seconds to subscribe to RELIANCE and TCS...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Subscribing to RELIANCE and TCS...');
  await fyersFeed.subscribe(['RELIANCE', 'TCS']);

  console.log('Waiting 15 seconds to receive ticks...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('Stopping FyersFeed...');
  fyersFeed.stop();
  
  if (redisClient && typeof redisClient.disconnect === 'function') {
    redisClient.disconnect();
  }
  process.exit(0);
}

run().catch(console.error);
