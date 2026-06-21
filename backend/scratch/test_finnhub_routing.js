require('dotenv').config({ path: '.env' });
const { finnhubFeed } = require('../src/services/finnhubFeed');
const { loadFromDatabase } = require('../src/services/symbolMap');

async function run() {
  console.log('Loading active instruments from DB...');
  await loadFromDatabase();

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.error('No FINNHUB_API_KEY found in .env');
    process.exit(1);
  }

  console.log('Registering tick listener...');
  finnhubFeed.on('tick', (tick) => {
    console.log('🔔 RECEIVED TICK:', tick.symbol, 'Price:', tick.price, 'LTP:', tick.ltp, 'Change%:', tick.changePercent, 'Source:', tick._debug?.source);
  });

  console.log('Starting Finnhub Feed service...');
  await finnhubFeed.start(apiKey);

  console.log('\nRouting stats after start:');
  console.log('WS Symbols (first 5):', finnhubFeed.wsSymbols.slice(0, 5));
  console.log('Poll Symbols (first 5):', finnhubFeed.pollSymbols.slice(0, 5));
  console.log('WS Symbols count:', finnhubFeed.wsSymbols.length);
  console.log('Poll Symbols count:', finnhubFeed.pollSymbols.length);

  // Wait 15 seconds to allow at least two REST poll batches to run (each batch size 2, every 6 seconds)
  setTimeout(() => {
    console.log('\nStopping Finnhub Feed service...');
    finnhubFeed.stop();
    console.log('Final Stats:', finnhubFeed.getStatus());
    process.exit(0);
  }, 15000);
}

run();
