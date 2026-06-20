require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Recent Profiles:', JSON.stringify(data, null, 2));
  }
}

checkProfiles();
