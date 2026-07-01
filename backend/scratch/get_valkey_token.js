require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { redisClient } = require('../src/redis/client');

async function run() {
  await new Promise(resolve => setTimeout(resolve, 2000));
  try {
    const token = await redisClient.get('fyers:access_token');
    console.log('TOKEN_VALUE:', token);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

run();
