const puppeteer = require('puppeteer');

async function run() {
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

  console.log('Navigating to https://web.stockslab.live/charts ...');
  await page.goto('https://web.stockslab.live/charts', { waitUntil: 'networkidle2' });

  console.log('Waiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const url = page.url();
  console.log(`Final URL: ${url}`);

  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'No #root found';
  });

  console.log('--- ROOT HTML CONTENT ---');
  console.log(rootHtml);
  console.log('-------------------------');

  await browser.close();
}

run().catch(err => {
  console.error('Script failed:', err);
});
