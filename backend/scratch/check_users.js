require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  const { data: users, error } = await supabaseAdmin.from('profiles').select('id, email, phone, status');
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Profiles in DB:', users);
  }
}

checkUsers();
