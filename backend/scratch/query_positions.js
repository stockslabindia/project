require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

async function main() {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .eq('symbol', 'RELIANCE');

  if (error) {
    console.error('Error fetching positions:', error);
  } else {
    console.log('Fetched Positions:', JSON.stringify(data, null, 2));
  }
  process.exit(0);
}

main();
