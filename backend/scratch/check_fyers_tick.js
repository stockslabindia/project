require('dotenv').config();
const { fyersFeed } = require('../src/services/fyersFeed');
const { redisClient } = require('../src/redis/client');

async function main() {
  console.log('Starting Fyers Feed...');
  
  fyersFeed.on('status', (status) => {
    console.log('Fyers Feed Status:', status);
  });

  // Override _handleTick to log raw message
  const originalHandleTick = fyersFeed._handleTick.bind(fyersFeed);
  let count = 0;
  fyersFeed._handleTick = function(data) {
    count++;
    console.log(`\n--- Tick #${count} ---`);
    console.log('Raw Fyers Data:', JSON.stringify(data, null, 2));
    
    // Run original handler to see normalized tick
    originalHandleTick(data);
  };

  fyersFeed.on('tick', (tick) => {
    console.log('Normalized Tick:', JSON.stringify(tick, null, 2));
    if (count >= 5) {
      console.log('Finished 5 ticks. Exiting.');
      fyersFeed.stop();
      process.exit(0);
    }
  });

  const started = await fyersFeed.start();
  if (!started) {
    console.error('Failed to start Fyers Feed');
    process.exit(1);
  }

  // Subscribe to NIFTY future
  console.log('Subscribing to NIFTY26JULFUT...');
  await fyersFeed.subscribe(['NIFTY26JULFUT']);
  
  // Timeout safety
  setTimeout(() => {
    console.log('Timeout reached. Stopping.');
    fyersFeed.stop();
    process.exit(0);
  }, 20000);
}

// Wait for Redis to connect
setTimeout(main, 1000);
