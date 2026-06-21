const https = require('https');

async function getSession() {
  try {
    const cookie = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'fc.yahoo.com',
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 5000,
      };
      const req = https.request(options, (res) => {
        res.resume();
        const setCookies = res.headers['set-cookie'];
        if (setCookies) {
          resolve(setCookies.map(c => c.split(';')[0]).join('; '));
        } else {
          resolve('');
        }
      });
      req.on('error', reject);
      req.end();
    });

    if (!cookie) throw new Error('No cookie');

    const crumb = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'query2.finance.yahoo.com',
        path: '/v1/test/getcrumb',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': cookie,
        },
        timeout: 5000,
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 && data.trim()) {
            resolve(data.trim());
          } else {
            reject(new Error(`Crumb status ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    return { cookie, crumb };
  } catch (err) {
    console.error('Session establishment failed:', err.message);
    return null;
  }
}

async function testYahooSymbol(symbol, session) {
  return new Promise((resolve) => {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&crumb=${session.crumb}`;
    
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': session.cookie,
      },
      timeout: 5000,
    }, (res) => {
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
              resolve({ success: false, symbol, error: 'No data returned (invalid symbol)' });
            }
          } catch (e) {
            resolve({ success: false, symbol, error: e.message });
          }
        } else {
          resolve({ success: false, symbol, error: `HTTP Status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, symbol, error: err.message });
    });
  });
}

async function run() {
  console.log('Establishing session...');
  const session = await getSession();
  if (!session) {
    console.error('Failed to get session');
    return;
  }
  console.log('Session established successfully.');

  const symbols = [
    'NIFTY=F',
    'IN=F',
    '^IN=F',
    'SGXNIFTY',
    'GIFc1',
    'GIFc1=F',
    '^NSEI', // Nifty 50 Spot
    '^NSEBANK',
    'IN1!',
    'IN1!=F'
  ];

  console.log('Testing Nifty futures symbols on Yahoo Finance...');
  for (const sym of symbols) {
    const res = await testYahooSymbol(sym, session);
    if (res.success) {
      console.log(`✅ SUCCESS [${res.symbol}]: Price = ${res.price}, Name = "${res.name}"`);
    } else {
      console.log(`❌ FAILED  [${res.symbol}]: ${res.error}`);
    }
  }
}

run();
