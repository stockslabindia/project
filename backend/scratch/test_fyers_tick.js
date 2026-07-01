require('dotenv').config();
const { redisClient } = require('../src/redis/client');
const { fyersDataSocket } = require('fyers-api-v3');

async function run() {
  const accessToken = await redisClient.get('fyers:access_token');
  if (!accessToken) {
    console.error('No Fyers access token found in Redis! Start backend first.');
    process.exit(1);
  }
  
  const appId = process.env.FYERS_APP_ID;
  const tokenStr = appId ? `${appId}:${accessToken}` : accessToken;
  
  console.log('Connecting to Fyers DataSocket...');
  const socket = fyersDataSocket.getInstance(tokenStr, './fyers_logs', false);
  
  socket.on('connect', () => {
    console.log('Connected! Subscribing to NSE:NIFTY26JULFUT and NSE:RELIANCE-EQ...');
    // subscribe with liteMode = false
    socket.subscribe(['NSE:NIFTY26JULFUT', 'NSE:RELIANCE-EQ'], false);
  });
  
  let tickCount = 0;
  socket.on('message', (data) => {
    console.log('\n--- Received Update ---');
    console.log(data);
    tickCount++;
    if (tickCount >= 10) {
      console.log('Finished 10 ticks. Exiting.');
      socket.close();
      process.exit(0);
    }
  });
  
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
  
  socket.on('close', () => {
    console.log('Socket closed.');
  });
  
  socket.connect();
}

run().catch(console.error);
