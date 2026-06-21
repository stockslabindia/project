const https = require('https');

async function testYahooSymbol(symbol) {
  return new Promise((resolve) => {
    // We don't even need cookie/crumb for the public v7 quote endpoint if we use query1
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000,
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const result = json.quoteResponse?.result;
            if (result && result.length > 0) {
              resolve({ success: true, symbol, price: result[0].regularMarketPrice, name: result[0].shortName || result[0].longName });
            } else {
              resolve({ success: false, symbol, error: 'No data returned' });
            }
          } catch (e) {
            resolve({ success: false, symbol, error: e.message });
          }
        } else {
          resolve({ success: false, symbol, error: `HTTP Status ${res.statusCode}` });
        }
      });
    }).on('error', (err) => {
      resolve({ success: false, symbol, error: err.message });
    });
  });
}

async function run() {
  const symbols = [
    'NIFTY=F',
    'IN=F',
    '^IN=F',
    'SGXNIFTY',
    'GIFc1',
    'GIFc1=F',
    '^NSEI', // Nifty 50 Spot to compare
    '^NSEBANK',
    'IN1!',
    'IN1! =F'
  ];

  console.log('Testing Nifty futures symbols on Yahoo Finance...');
  for (const sym of symbols) {
    const res = await testYahooSymbol(sym);
    if (res.success) {
      console.log(`✅ SUCCESS [${res.symbol}]: Price = ${res.price}, Name = "${res.name}"`);
    } else {
      console.log(`❌ FAILED  [${res.symbol}]: ${res.error}`);
    }
  }
}

run();
