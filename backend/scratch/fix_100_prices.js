require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const https = require('https');

async function getCookiesAndCrumb() {
  return new Promise((resolve) => {
    const options1 = {
      hostname: 'fc.yahoo.com',
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000,
    };

    const req1 = https.request(options1, (res1) => {
      const setCookies = res1.headers['set-cookie'];
      let cookie = '';
      if (setCookies) cookie = setCookies.map(c => c.split(';')[0]).join('; ');
      
      const options2 = {
        hostname: 'query2.finance.yahoo.com',
        path: '/v1/test/getcrumb',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': cookie,
        },
        timeout: 5000,
      };

      const req2 = https.request(options2, (res2) => {
        let crumb = '';
        res2.on('data', chunk => crumb += chunk);
        res2.on('end', () => {
          resolve({ cookie, crumb });
        });
      });
      req2.end();
    });
    req1.on('error', (e) => resolve({ cookie: '', crumb: '' }));
    req1.end();
  });
}

async function getBatchQuotes(symbols, cookie, crumb) {
  return new Promise((resolve, reject) => {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${crumb}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
      },
      timeout: 10000,
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`Status ${res.statusCode}: ${data}`);
            resolve([]);
            return;
          }
          const json = JSON.parse(data);
          resolve(json.quoteResponse?.result || []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', (e) => resolve([]));
  });
}

async function run() {
  console.log('Fetching cookie and crumb...');
  const { cookie, crumb } = await getCookiesAndCrumb();
  console.log('Cookie & crumb obtained:', cookie ? 'YES' : 'NO', crumb);

  console.log('Fetching instruments with price 100...');
  const { data: instruments, error } = await supabaseAdmin.from('instruments').select('symbol, exchange, id').eq('last_price', 100);
  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${instruments.length} instruments to fix.`);

  const BATCH_SIZE = 150;
  for (let i = 0; i < instruments.length; i += BATCH_SIZE) {
    const batch = instruments.slice(i, i + BATCH_SIZE);
    
    // Map internal symbols to Yahoo symbols
    const symbolMap = {};
    const yahooSymbols = batch.map(inst => {
      let ySym = inst.symbol;
      if (inst.exchange === 'NSE') ySym += '.NS';
      else if (inst.exchange === 'BSE') ySym += '.BO';
      symbolMap[ySym] = inst;
      return ySym;
    });

    console.log(`Fetching batch ${i / BATCH_SIZE + 1} (${yahooSymbols.length} symbols)...`);
    const quotes = await getBatchQuotes(yahooSymbols, cookie, crumb);
    
    let updatedCount = 0;
    for (const quote of quotes) {
      const inst = symbolMap[quote.symbol];
      if (inst && quote.regularMarketPrice) {
        const { error: updErr } = await supabaseAdmin
          .from('instruments')
          .update({ last_price: quote.regularMarketPrice })
          .eq('id', inst.id);
        
        if (!updErr) updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} instruments in batch.`);
  }

  console.log('Done!');
}

run();
