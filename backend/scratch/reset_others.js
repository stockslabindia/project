require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPasswords() {
  const hash = await bcrypt.hash('admin123', 10);
  await supabaseAdmin.from('admin_users').update({ password_hash: hash }).in('email', ['finance@stockslab.com', 'support@stockslab.com']);
  console.log('Reset passwords for finance and support');
}

resetPasswords();
