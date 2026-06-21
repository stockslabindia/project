require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetDbAndUsers() {
  console.log('Starting full database reset for users...');

  // 1. Fetch all users from Supabase Auth
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }

  if (users.length === 0) {
    console.log('No users found in Supabase Auth.');
    return;
  }

  const userIds = users.map(u => u.id);
  console.log(`Found ${users.length} users:`, users.map(u => u.email));

  // 2. Clear specialized tables (like referral events) where column is not standard user_id
  const specialTables = [
    { name: 'referral_bonus_events', columns: ['referrer_id', 'referee_id'] },
    { name: 'referral_commissions', columns: ['referrer_id', 'referee_id'] }
  ];

  for (const table of specialTables) {
    for (const col of table.columns) {
      try {
        console.log(`Clearing ${table.name} where ${col} is in userIds...`);
        const { error } = await supabaseAdmin
          .from(table.name)
          .delete()
          .in(col, userIds);

        if (error) {
          console.warn(`Warning clearing ${table.name} (${col}):`, error.message);
        }
      } catch (err) {
        console.error(`Error clearing ${table.name} (${col}):`, err.message);
      }
    }
  }

  // 3. Clear standard child tables in correct order of dependency
  const childTables = [
    { name: 'user_bank_accounts', column: 'user_id' },
    { name: 'user_watchlists', column: 'user_id' },
    { name: 'push_subscriptions', column: 'user_id' },
    { name: 'client_restrictions', column: 'user_id' },
    { name: 'user_trading_limits', column: 'user_id' },
    { name: 'kyc_documents', column: 'user_id' },
    { name: 'affiliate_commissions', column: 'affiliate_id' },
    { name: 'affiliate_payout_requests', column: 'affiliate_id' },
    { name: 'affiliate_accounts', column: 'id' },
    { name: 'wallet_transactions', column: 'user_id' },
    { name: 'deposit_requests', column: 'user_id' },
    { name: 'withdrawal_requests', column: 'user_id' },
    { name: 'trades', column: 'user_id' },
    { name: 'positions', column: 'user_id' },
    { name: 'orders', column: 'user_id' },
    { name: 'wallets', column: 'user_id' },
    { name: 'email_preferences', column: 'user_id' }
  ];

  for (const table of childTables) {
    try {
      console.log(`Clearing table: ${table.name}...`);
      const { error } = await supabaseAdmin
        .from(table.name)
        .delete()
        .in(table.column, userIds);

      if (error) {
        console.warn(`Warning: Could not clear table ${table.name}:`, error.message);
      } else {
        console.log(`Successfully cleared table ${table.name}`);
      }
    } catch (err) {
      console.error(`Error clearing table ${table.name}:`, err.message);
    }
  }

  // 4. Clear profiles table (explicitly just in case)
  try {
    console.log('Clearing profiles table...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .in('id', userIds);

    if (profileError) {
      console.error('Error clearing profiles:', profileError.message);
    } else {
      console.log('Successfully cleared profiles table');
    }
  } catch (err) {
    console.error('Error clearing profiles table:', err.message);
  }

  // 5. Delete users from Supabase Auth
  for (const user of users) {
    try {
      console.log(`Deleting Auth User: ${user.email} (${user.id})...`);
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (authError) {
        console.error(`Failed to delete Auth User ${user.email}:`, authError.message);
      } else {
        console.log(`Successfully deleted Auth User ${user.email}`);
      }
    } catch (err) {
      console.error(`Error deleting Auth User ${user.email}:`, err.message);
    }
  }

  console.log('Database reset completed successfully! All wallet balances, transactions, KYC documents, and profiles have been cleared.');
}

resetDbAndUsers();
