require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRpc() {
  const { data, error } = await supabase.rpc('create_user_profile', {
    p_id: '00000000-0000-0000-0000-000000000000',
    p_full_name: 'test',
    p_email: 'test@test.com'
  });
  console.log('Error:', error);
  console.log('Data returned:', data);
}
checkRpc();
