const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const path = require('path');

// Start Vite dev server for trader-app
console.log('Starting Vite dev server...');
const viteProcess = exec('npm run dev', {
  cwd: path.join(__dirname, '../apps/trader-app')
});

viteProcess.stdout.on('data', data => {
  console.log(`[Vite Stdout]: ${data.trim()}`);
});

viteProcess.stderr.on('data', data => {
  console.error(`[Vite Stderr]: ${data.trim()}`);
});

async function run() {
  // Wait 3 seconds for Vite to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Log console events
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  // Log page errors
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR]: ${err.message}`);
    if (err.stack) console.error(err.stack);
  });

  // Enable request interception to mock API
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      console.log(`[API Mock] Intercepted request to: ${url}`);
      
      let responseData = {};
      
      if (url.includes('/auth/me')) {
        responseData = { user: { id: 'mock-user', email: 'test@stockslab.live', full_name: 'Test Trader', client_id: 'TS1234' } };
      } else if (url.includes('/instruments') && url.includes('/candles')) {
        responseData = {
          symbol: 'NIFTY50',
          timeframe: '5m',
          candles: [
            { time: Math.floor(Date.now() / 1000) - 300, open: 22000, high: 22050, low: 21980, close: 22010, volume: 1000 },
            { time: Math.floor(Date.now() / 1000), open: 22010, high: 22030, low: 21990, close: 22020, volume: 1200 }
          ]
        };
      } else if (url.includes('/instruments')) {
        responseData = {
          instruments: [
            { symbol: 'NIFTY50', name: 'Nifty 50 Index', last_price: 22020, change: 10.5, change_percent: 0.05, segment: 'nse_equity', is_active: true }
          ]
        };
      } else if (url.includes('/wallet')) {
        responseData = { wallet: { balance: 100000, availableMargin: 100000 } };
      } else if (url.includes('/positions')) {
        responseData = { positions: [] };
      } else if (url.includes('/orders')) {
        responseData = { orders: [] };
      } else if (url.includes('/watchlist')) {
        responseData = { watchlist: { active: 'MW-1', lists: { 'MW-1': ['NIFTY50'] } } };
      } else if (url.includes('/notifications')) {
        responseData = { notifications: [] };
      }

      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    } else {
      req.continue();
    }
  });

  // Set local storage before navigating
  console.log('Navigating to http://localhost:3000/login to setup auth...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    localStorage.setItem('tradex_access_token', 'mock-access-token');
    localStorage.setItem('tradex_user', JSON.stringify({ id: 'mock-user', email: 'test@stockslab.live', full_name: 'Test Trader' }));
  });

  console.log('Navigating to http://localhost:3000/charts ...');
  await page.goto('http://localhost:3000/charts', { waitUntil: 'networkidle2' });

  console.log('Waiting 5 seconds for chart to render...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const screenshotPath = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\516fe178-a345-4e69-923b-a0753601797b\\charts_screenshot.png';
  console.log(`Taking screenshot to: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath });

  const rootHtml = await page.evaluate(() => {
    return document.getElementById('root').innerHTML;
  });
  console.log('--- ROOT HTML CONTENT ---');
  console.log(rootHtml);
  console.log('-------------------------');

  await browser.close();
  viteProcess.kill();
  console.log('Done!');
}

run().catch(err => {
  console.error('Run failed:', err);
  viteProcess.kill();
});
