require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAuthUser() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  const recentUser = users.find(u => u.email === 'shivamaggofficial@gmail.com');
  if (recentUser) {
    console.log('User Provider:', recentUser.app_metadata.provider);
    console.log('Providers:', recentUser.app_metadata.providers);
  } else {
    console.log('User not found in auth.users');
  }
}

checkAuthUser();
