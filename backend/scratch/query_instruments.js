require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

async function main() {
  const { data, error } = await supabaseAdmin
    .from('instruments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching instruments:', error);
  } else {
    console.log('Fetched Instruments:', data);
  }
  process.exit(0);
}

main();
