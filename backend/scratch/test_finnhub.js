require('dotenv').config({ path: '.env' });
const WebSocket = require('ws');
const axios = require('axios');

const apiKey = process.env.FINNHUB_API_KEY;
console.log('Testing Finnhub with API key:', apiKey);

if (!apiKey) {
  console.error('No FINNHUB_API_KEY found in .env');
  process.exit(1);
}

async function testREST() {
  console.log('\n--- Testing Finnhub REST Quote ---');
  try {
    const symbol = 'AAPL';
    const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
    console.log(`Successfully fetched quote for ${symbol}:`, response.data);
  } catch (error) {
    console.error('REST API Error:', error.response ? error.response.status : error.message, error.response ? error.response.data : '');
  }
}

function testWebSocket() {
  console.log('\n--- Testing Finnhub WebSocket ---');
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

  ws.on('open', () => {
    console.log('WS Connection Open! Subscribing to AAPL, EURUSD...');
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL' }));
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'BINANCE:BTCUSDT' }));
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'IC MARKETS:1' })); // Forex
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'OANDA:EUR_USD' }));
  });

  ws.on('message', (data) => {
    console.log('WS Message Received:', data.toString());
  });

  ws.on('error', (error) => {
    console.error('WS Error:', error.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`WS Connection Closed (${code}): ${reason}`);
  });

  // Close after 10 seconds
  setTimeout(() => {
    console.log('Closing WS connection after timeout.');
    ws.close();
  }, 10000);
}

async function run() {
  await testREST();
  testWebSocket();
}

run();
