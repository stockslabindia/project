const { supabaseAdmin } = require('../config/supabase');
const { queueEmail } = require('./emailService');

async function approveKyc(kycId, adminId, ipAddress = '127.0.0.1') {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('kyc_documents')
    .update({ status: 'verified', verified_by: adminId, verified_at: new Date().toISOString() })
    .eq('id', kycId)
    .select('user_id')
    .single();
    
  if (docErr) throw new Error(docErr.message);
  if (!doc) throw new Error('KYC document not found');

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({ 
      kyc_status: 'verified', 
      kyc_verified_at: new Date().toISOString(),
      kyc_rejected_reason: null
    })
    .eq('id', doc.user_id);

  if (profileErr) throw new Error(profileErr.message);

  const { redisClient } = require('../redis/client');
  try { await redisClient.del(`auth:user:profile:${doc.user_id}`); } catch (e) {}

  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'verify_kyc', target_type: 'kyc', target_id: kycId, description: `Verified KYC document`, ip_address: ipAddress });

  setImmediate(async () => {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name, client_id').eq('id', doc.user_id).single();
      if (profile) queueEmail('kyc_approved', { to: profile.email, name: profile.full_name, clientId: profile.client_id, userId: doc.user_id }).catch(e => console.error('[Email] KYC approved email failed:', e.message));
    } catch (e) {}
  });
}

async function rejectKyc(kycId, adminId, reason, ipAddress = '127.0.0.1') {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('kyc_documents')
    .update({ status: 'rejected', reject_reason: reason })
    .eq('id', kycId)
    .select('user_id')
    .single();
    
  if (docErr) throw new Error(docErr.message);
  if (!doc) throw new Error('KYC document not found');

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({ kyc_status: 'rejected', kyc_rejected_reason: reason })
    .eq('id', doc.user_id);

  if (profileErr) throw new Error(profileErr.message);

  const { redisClient } = require('../redis/client');
  try { await redisClient.del(`auth:user:profile:${doc.user_id}`); } catch (e) {}

  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'reject_kyc', target_type: 'kyc', target_id: kycId, description: `Rejected KYC: ${reason}`, ip_address: ipAddress });

  setImmediate(async () => {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', doc.user_id).single();
      if (profile) queueEmail('kyc_rejected', { to: profile.email, name: profile.full_name, reason: reason, userId: doc.user_id }).catch(e => console.error('[Email] KYC rejected email failed:', e.message));
    } catch (e) {}
  });
}

async function rejectBank(bankId, adminId, reason, ipAddress = '127.0.0.1') {
  // We delete the bank account
  const { data: bank, error } = await supabaseAdmin
    .from('user_bank_accounts')
    .delete()
    .eq('id', bankId)
    .select()
    .single();

  if (error || !bank) throw new Error('Bank account not found or already deleted');

  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'reject_bank_account', target_type: 'bank_account', target_id: bankId, description: `Deleted bank account (${bank.account_number}) for user ${bank.user_id}. Reason: ${reason}`, ip_address: ipAddress });
}

module.exports = {
  approveKyc,
  rejectKyc,
  rejectBank
};
