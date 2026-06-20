require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkInstruments() {
  const { count, error } = await supabaseAdmin
    .from('instruments')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error('Error fetching count:', error.message);
  } else {
    console.log('Total instruments in DB:', count);
  }

  // Sample 5 instruments
  const { data, error: fetchError } = await supabaseAdmin
    .from('instruments')
    .select('symbol, name, segment')
    .limit(5);
    
  if (fetchError) {
    console.error('Error fetching samples:', fetchError.message);
  } else {
    console.log('Sample instruments:', data);
  }
}

checkInstruments();
