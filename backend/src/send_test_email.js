const { supabaseAdmin } = require('./src/config/supabase');
const { queueEmail } = require('./src/services/emailService');

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
    console.log(`Sending sample Deposit Approval test email to: ${p.email} (${p.full_name || 'Trader'})`);
    await queueEmail('deposit_approved', {
      to: p.email,
      name: p.full_name || 'Trader',
      amount: 10000,
      newBalance: 10000,
      referenceId: 'TEST-DEP-9988',
      method: 'UPI Instant',
      userId: p.id
    });
  }

  console.log('✅ All test emails successfully queued into BullMQ queue!');
  setTimeout(() => process.exit(0), 3000);
}

sendTestEmails();
