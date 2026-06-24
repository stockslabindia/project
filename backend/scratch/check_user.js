const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabaseAdmin } = require('../src/config/supabase');

async function fixStuckUsers() {
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error('Auth error:', error);
    return;
  }
  
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email');
  const profileEmails = new Set(profiles.map(p => p.email.toLowerCase()));

  for (const user of users.users) {
    if (!profileEmails.has(user.email.toLowerCase())) {
      console.log(`Deleting stuck auth user: ${user.email} (ID: ${user.id})`);
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error(`Failed to delete ${user.email}:`, delErr.message);
      } else {
        console.log(`Deleted successfully.`);
      }
    }
  }
  console.log('Done.');
}

fixStuckUsers().then(() => process.exit());
