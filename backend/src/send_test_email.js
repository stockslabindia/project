require('dotenv').config();
const { supabaseAdmin } = require('./config/supabase');
const { queueEmail } = require('./services/emailService');

async function sendTestEmails() {
  console.log('Fetching registered profiles with email addresses...');
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, client_id')
    .not('email', 'is', null);


  if (error) {
    console.error('Error fetching profiles:', error);
    process.exit(1);
  }

  console.log(`Found ${profiles.length} user accounts with email addresses.`);

  for (const p of profiles) {
    console.log(`Sending Apology notification email to: ${p.email} (${p.full_name || 'Trader'})`);
    await queueEmail('test_apology', {
      to: p.email,
      name: p.full_name || 'Valued Trader',
      userId: p.id
    });
  }

  console.log('✅ All apology clarification emails successfully queued into BullMQ queue!');
  setTimeout(() => process.exit(0), 3000);
}

sendTestEmails();
