require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPassword() {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('email, password_hash')
    .eq('email', 'admin@stockslab.live')
    .single();
    
  if (data) {
    const valid = await bcrypt.compare('admin123', data.password_hash);
    console.log('Password valid:', valid);
  } else {
    console.log('User not found', error);
  }
}

testPassword();
