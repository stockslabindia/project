require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminLogin() {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*');
  
  if (error) {
    console.error('Error fetching admin users:', error.message);
  } else {
    console.log('Admin users in DB:', data.map(u => ({ email: u.email, role: u.role, is_active: u.is_active })));
  }

  const { data: whitelist, error: wError } = await supabaseAdmin.from('ip_whitelist').select('*');
  if (wError) {
    console.error('Error fetching whitelist:', wError.message);
  } else {
    console.log('IP Whitelist:', whitelist);
  }
}

testAdminLogin();
