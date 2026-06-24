require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const axios = require('axios');

async function run() {
  console.log('Fetching MCX CSV from Fyers...');
  const res = await axios.get('https://public.fyers.in/sym_details/MCX_COM.csv');
  const lines = res.data.split('\n');
  const bases = new Set();
  
  lines.forEach(l => {
    const p = l.split(',');
    if (p.length > 13 && p[9].endsWith('FUT')) {
      bases.add(p[13].trim());
    }
  });

  const mcxSymbols = Array.from(bases);
  console.log(`Found ${mcxSymbols.length} active MCX base symbols.`);

  // Get existing MCX
  const { data: existing } = await supabaseAdmin.from('instruments').select('symbol').eq('exchange', 'MCX');
  const existingSet = new Set(existing.map(e => e.symbol));

  const toInsert = mcxSymbols.filter(sym => !existingSet.has(sym)).map(sym => ({
    symbol: sym,
    exchange: 'MCX',
    type: 'mcx',
    lot_size: 1, // Default lot size, admin can change later
    tick_size: 0.05,
    margin_multiplier: 1,
    trading_enabled: true,
    last_price: 100 // Default, will get updated live
  }));

  if (toInsert.length === 0) {
    console.log('No new MCX instruments to add.');
    return;
  }

  console.log(`Inserting ${toInsert.length} new MCX instruments...`);
  const { error } = await supabaseAdmin.from('instruments').insert(toInsert);
  
  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Successfully added!');
  }
}

run();
