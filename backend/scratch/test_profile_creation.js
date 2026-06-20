require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRpc() {
  // 1. create dummy auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'dummy12345@test.com',
    password: 'password123',
    email_confirm: true
  });
  
  if (authErr) return console.error('Auth Error:', authErr);
  
  const userId = authData.user.id;
  
  // 2. call RPC
  const { data: profile, error: rpcErr } = await supabase.rpc('create_user_profile', {
    p_id: userId,
    p_full_name: 'Dummy Test',
    p_email: 'dummy12345@test.com',
    p_phone: '1234567890',
    p_referred_by: null,
    p_affiliate_id: null,
    p_affiliate_code_used: false
  });
  
  console.log('Profile returned:', profile);
  console.log('RPC Error:', rpcErr);
  
  // 3. Try to update status
  if (profile) {
    const updateRes = await supabase.from('profiles').update({ status: 'pending_otp' }).eq('id', profile.id);
    console.log('Update result:', updateRes);
  } else {
    console.log('Profile is null! The update query .eq("id", profile.id) will fail!');
  }
  
  // 4. cleanup
  await supabase.auth.admin.deleteUser(userId);
}

testRpc();
