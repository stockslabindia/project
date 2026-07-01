require('dotenv').config();
const { fetchAllActiveInstruments } = require('../src/config/supabase');

async function run() {
  console.log('Fetching active instruments...');
  const instruments = await fetchAllActiveInstruments();
  
  const segments = {};
  instruments.forEach(i => {
    segments[i.segment] = (segments[i.segment] || 0) + 1;
  });
  console.log('Segments counts:', segments);
  
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
