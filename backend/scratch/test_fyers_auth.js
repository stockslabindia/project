require('dotenv').config();
const { fyersFeed } = require('../src/services/fyersFeed');
const { redisClient } = require('../src/redis/client');

async function run() {
  console.log('--- Fyers Authentication Test Script ---');
  console.log('FYERS_USER_ID:', process.env.FYERS_USER_ID);
  console.log('FYERS_APP_ID:', process.env.FYERS_APP_ID);
  console.log('FYERS_REDIRECT_URL:', process.env.FYERS_REDIRECT_URL);

  // Clear Redis cached token to force a fresh authentication
  if (redisClient) {
    console.log('Clearing cached token from Redis...');
    try {
      await redisClient.del('fyers:access_token');
      console.log('Cached token deleted from Redis.');
    } catch (err) {
      console.error('Failed to delete Redis key:', err.message);
    }
  } else {
    console.log('Redis client not available, will do direct authenticate.');
  }

  try {
    console.log('Attempting authentication...');
    const token = await fyersFeed._authenticate();
    console.log('✅ Authentication Succeeded! Token obtained:', token ? token.substring(0, 30) + '...' : 'null');
    
    console.log('Testing connection to Fyers DataSocket...');
    // We won't start the full feed since that runs indefinitely, but let's see what happens.
  } catch (err) {
    console.error('❌ Authentication Failed:', err);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', JSON.stringify(err.response.data));
    }
  }

  // Force close redis connection if any to let process exit
  if (redisClient && typeof redisClient.disconnect === 'function') {
    redisClient.disconnect();
  }
  process.exit(0);
}

run().catch(console.error);
