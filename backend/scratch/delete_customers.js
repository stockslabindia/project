require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteCustomerAccounts() {
  console.log('Fetching all auth users...');
  
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }

  console.log(`Found ${users.length} users in Supabase Auth.`);

  for (const user of users) {
    console.log(`Deleting user: ${user.email} (${user.id})...`);
    
    // Deleting from auth.users should cascade-delete profiles and wallets if foreign keys are set up correctly.
    // But just in case, we can attempt to delete from profiles first, or let cascade handle it.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`Failed to delete user ${user.email}:`, deleteError.message);
    } else {
      console.log(`Successfully deleted user ${user.email}`);
    }
  }

  // Double check profiles table
  const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('id, email');
  if (profileError) {
    console.error('Error fetching profiles:', profileError.message);
  } else {
    console.log(`Profiles remaining in DB: ${profiles.length}`);
    for (const p of profiles) {
      console.log(`Cleaning up profile: ${p.email} (${p.id})...`);
      const { error } = await supabaseAdmin.from('profiles').delete().eq('id', p.id);
      if (error) console.error(`Error deleting profile ${p.email}:`, error.message);
    }
  }

  console.log('Customer account cleanup complete!');
}

deleteCustomerAccounts();
