const axios = require('axios');

async function run() {
  console.log('Downloading Fyers NSE FO Symbol Master...');
  try {
    const res = await axios.get('https://public.fyers.in/sym_details/NSE_FO_sym_master.json', { timeout: 30000 });
    const data = res.data;
    console.log('Successfully downloaded. Keys count:', Object.keys(data).length);
    
    // Find keys containing NIFTY
    const keys = Object.keys(data);
    const niftyFutures = keys.filter(k => k.includes('NIFTY') && k.includes('FUT'));
    console.log('\nSample NIFTY FUT symbols in Fyers:');
    console.log(niftyFutures.slice(0, 10));
    
    const bankNiftyFutures = keys.filter(k => k.includes('BANKNIFTY') && k.includes('FUT'));
    console.log('\nSample BANKNIFTY FUT symbols in Fyers:');
    console.log(bankNiftyFutures.slice(0, 10));
    
    // Look up details for a few keys
    if (niftyFutures.length > 0) {
      console.log('\nDetails for ' + niftyFutures[0] + ':', data[niftyFutures[0]]);
    }
  } catch (err) {
    console.error('Error fetching master:', err.message);
  }
}

run();
