require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../src/config/supabase');

async function run() {
  console.log('--- STARTING AFFILIATE BACKEND TEST ---');
  
  // 1. Generate test details
  const testEmail = `test_aff_${Date.now()}@stockslab.live`;
  const password = 'testpassword123';
  const code = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;

  console.log(`Creating test affiliate: Email: ${testEmail}, Code: ${code}`);

  // 2. Hash password
  const password_hash = await bcrypt.hash(password, 10);

  // 3. Insert into DB
  const { data: aff, error } = await supabaseAdmin
    .from('affiliate_accounts')
    .insert({
      name: 'Test Affiliate Partner',
      email: testEmail,
      affiliate_code: code,
      deposit_commission_pct: 4.5,
      trade_commission_pct: 0.8,
      status: 'active',
      password_hash
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert affiliate:', error.message);
    process.exit(1);
  }

  console.log('Affiliate inserted successfully with ID:', aff.id);

  // 4. Verify password comparison
  const isValid = await bcrypt.compare(password, aff.password_hash);
  console.log('Password comparison check:', isValid ? 'SUCCESS' : 'FAILED');

  // 5. Test sign token and decode
  const token = jwt.sign(
    { id: aff.id, email: aff.email, name: aff.name, type: 'affiliate' },
    process.env.AFFILIATE_JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '24h' }
  );

  const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET || process.env.JWT_SECRET || 'fallback_secret');
  console.log('JWT sign/verify check: Decoded ID:', decoded.id === aff.id ? 'SUCCESS' : 'FAILED');

  // 6. Cleanup test account
  const { error: deleteError } = await supabaseAdmin
    .from('affiliate_accounts')
    .delete()
    .eq('id', aff.id);

  if (deleteError) {
    console.error('Failed to clean up test account:', deleteError.message);
  } else {
    console.log('Cleanup completed successfully.');
  }

  console.log('--- ALL BACKEND CHECKS COMPLETED ---');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
