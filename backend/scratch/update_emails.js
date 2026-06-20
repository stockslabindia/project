require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateEmails() {
  const { error: err1 } = await supabaseAdmin
    .from('admin_users')
    .update({ email: 'finance@stockslab.live' })
    .eq('email', 'finance@stockslab.com');
    
  if (err1) console.error('Error updating finance:', err1.message);
  else console.log('Updated finance to @stockslab.live');

  const { error: err2 } = await supabaseAdmin
    .from('admin_users')
    .update({ email: 'support@stockslab.live' })
    .eq('email', 'support@stockslab.com');
    
  if (err2) console.error('Error updating support:', err2.message);
  else console.log('Updated support to @stockslab.live');
}

updateEmails();
