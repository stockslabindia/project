require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function run() {
  console.log('Querying profiles...');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, phone, full_name')
    .limit(10);
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Profiles:', data);
  }
}
run().catch(console.error);
