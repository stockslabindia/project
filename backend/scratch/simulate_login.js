require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simulateLogin(email, password) {
  const { data: admin, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error) {
    console.log('Error fetching user:', error.message);
    return;
  }

  if (!admin) {
    console.log('No active admin found with that email');
    return;
  }

  const validPassword = await bcrypt.compare(password, admin.password_hash);
  console.log('User found:', admin.email);
  console.log('Password valid:', validPassword);
}

simulateLogin('admin@stockslab.live', 'admin123');
simulateLogin('finance@stockslab.live', 'admin123');
simulateLogin('support@stockslab.live', 'admin123');
