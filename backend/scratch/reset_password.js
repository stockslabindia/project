require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword() {
  const hash = await bcrypt.hash('admin123', 10);
  const { error } = await supabaseAdmin
    .from('admin_users')
    .update({ password_hash: hash })
    .eq('email', 'admin@stockslab.live');
    
  if (error) {
    console.error('Error updating password:', error.message);
  } else {
    console.log('Password reset to admin123 for admin@stockslab.live');
  }
}

resetPassword();
