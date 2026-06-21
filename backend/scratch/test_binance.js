const { binanceFeed } = require('../src/services/binanceFeed');
const { loadFromDatabase } = require('../src/services/symbolMap');

async function run() {
  console.log('Loading active symbols from database...');
  await loadFromDatabase();

  console.log('Starting Binance Feed...');
  binanceFeed.on('tick', (tick) => {
    console.log('Received Binance Tick:', tick);
  });

  binanceFeed.start();

  setTimeout(() => {
    console.log('Stopping Binance Feed...');
    binanceFeed.stop();
    process.exit(0);
  }, 10000);
}

run();
