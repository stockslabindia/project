require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteTestUsers() {
  const testUserIds = [
    'd44f6cf7-68eb-4343-ab1e-ea3f4641d53c',
    'a445885b-6864-4c4c-8a98-fe8638130d81'
  ];

  console.log('Attempting to delete test users:', testUserIds);

  for (const userId of testUserIds) {
    try {
      // 1. Delete from profiles table first (in case trigger doesn't cascade)
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileErr) {
        console.warn(`Warning deleting profile ${userId}:`, profileErr.message);
      } else {
        console.log(`Deleted profile ${userId} from profiles table`);
      }

      // 2. Delete auth user
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authErr) {
        console.error(`Error deleting auth user ${userId}:`, authErr.message);
      } else {
        console.log(`Deleted auth user ${userId} from Supabase Auth`);
      }
    } catch (e) {
      console.error(`Error processing userId ${userId}:`, e.message);
    }
  }

  console.log('Cleanup completed!');
}

deleteTestUsers();
