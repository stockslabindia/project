require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const https = require('https');

// Mappings from internal symbol to Yahoo Finance symbol
const INDEX_MAP = {
  'SPX500':     '^GSPC',
  'NASDAQ':     '^IXIC',
  'NASDAQ100':  '^NDX',
  'DJI':        '^DJI',
  'RUSSELL2000': '^RUT',
  'VIX':        '^VIX',
  'FTSE100':    '^FTSE',
  'DAX':        '^GDAXI',
  'CAC40':      '^FCHI',
  'AEX':        '^AEX',
  'SMI':        '^SSMI',
  'OMXS30':     '^OMX',
  'NIKKEI':     '^N225',
  'HANGSENG':   '^HSI',
  'ASX200':     '^AXJO',
  'KOSPI':      '^KS11',
  'SSE':        '000001.SS',
  'SZSE':       '399001.SZ',
  'STRAITS':    '^STI',
  'TAIEX':      '^TWII',
  'IBOVESPA':   '^BVSP',
  'TSX':        '^GSPTSE',
  'SENSEX_IDX': '^BSESN',
};

async function getCookiesAndCrumb() {
  return new Promise((resolve) => {
    const options1 = {
      hostname: 'fc.yahoo.com',
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': cookie,
        },
        timeout: 5000,
      };

      const req2 = https.request(options2, (res2) => {
        let crumb = '';
        res2.on('data', chunk => crumb += chunk);
        res2.on('end', () => resolve({ cookie, crumb }));
      });
      req2.end();
    });
    req1.on('error', () => resolve({ cookie: '', crumb: '' }));
    req1.end();
  });
}

async function getBatchQuotes(symbols, cookie, crumb) {
  return new Promise((resolve) => {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${crumb}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
      },
      timeout: 10000,
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.quoteResponse?.result || []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function run() {
  console.log('Fetching cookie and crumb...');
  const { cookie, crumb } = await getCookiesAndCrumb();
  console.log('Cookie & crumb obtained:', cookie ? 'YES' : 'NO', crumb);

  const internalSymbols = Object.keys(INDEX_MAP);
  
  const { data: instruments, error } = await supabaseAdmin
    .from('instruments')
    .select('symbol, id')
    .in('symbol', internalSymbols);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${instruments.length} indices in DB to fix.`);

  const yahooSymbolsToInternal = {};
  const yahooSymbols = [];
  
  instruments.forEach(inst => {
    const ySym = INDEX_MAP[inst.symbol];
    if (ySym) {
      yahooSymbolsToInternal[ySym] = inst;
      yahooSymbols.push(ySym);
    }
  });

  console.log(`Fetching quotes from Yahoo for ${yahooSymbols.length} indices...`);
  const quotes = await getBatchQuotes(yahooSymbols, cookie, crumb);
  
  let updatedCount = 0;
  for (const quote of quotes) {
    const inst = yahooSymbolsToInternal[quote.symbol];
    if (inst && quote.regularMarketPrice) {
      console.log(`Setting ${inst.symbol} to ${quote.regularMarketPrice}`);
      const { error: updErr } = await supabaseAdmin
        .from('instruments')
        .update({ last_price: quote.regularMarketPrice })
        .eq('id', inst.id);
      
      if (!updErr) updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} index instruments!`);
}

run();
