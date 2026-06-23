const { supabaseAdmin } = require('../config/supabase');
const { queueEmail } = require('./emailService');

// Shared utility for deposit/withdrawal hooks
async function _handleDepositCommissionHooks(userId, depositId, depositAmount) {
  const { data: config } = await supabaseAdmin.from('referral_reward_config').select('*').eq('id', 1).single();
  if (!config) return;

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('referred_by, affiliate_id').eq('id', userId).single();
  if (!profile) return;

  // Check if this is the user's first deposit
  const { count: prevCount } = await supabaseAdmin
    .from('deposit_requests').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('status', 'approved').neq('id', depositId);
  const isFirstDeposit = (prevCount || 0) === 0;

  // 1. REFERRAL FIRST DEPOSIT COMMISSION
  if (isFirstDeposit && config.referral_program_active && profile.referred_by) {
    const referrerId = profile.referred_by;
    const { count: refCount } = await supabaseAdmin
      .from('profiles').select('*', { count: 'exact', head: true }).eq('referred_by', referrerId);
    const { data: tiers } = await supabaseAdmin
      .from('referral_tiers').select('*').eq('is_active', true).order('sort_order');
    const activeTier = (tiers || []).find(t => (refCount || 0) >= t.min_referrals && (t.max_referrals == null || (refCount || 0) < t.max_referrals));
    const commPct = parseFloat(activeTier?.deposit_commission_pct ?? config.referral_deposit_commission_pct ?? 0);
    const commAmount = Math.round((depositAmount * commPct / 100) * 100) / 100;
    if (commAmount > 0) {
      const { data: rWallet } = await supabaseAdmin.from('wallets').select('balance, bonus_balance, bonus_turnover_required').eq('user_id', referrerId).single();
      if (rWallet) {
        const newBonus = parseFloat(rWallet.bonus_balance || 0) + commAmount;
        const newTurnover = parseFloat(rWallet.bonus_turnover_required || 0) + (commAmount * parseFloat(config.bonus_turnover_multiplier || 5));
        await supabaseAdmin.from('wallets').update({ bonus_balance: newBonus, bonus_turnover_required: newTurnover }).eq('user_id', referrerId);
        await supabaseAdmin.from('wallet_transactions').insert({
          user_id: referrerId, type: 'bonus', amount: commAmount,
          balance_after: rWallet.balance, reference_id: depositId,
          reference_type: 'referral_deposit_commission',
          description: `Referral 1st deposit commission (${commPct}% of ₹${depositAmount} deposit)`,
        });
        const today = new Date().toISOString().split('T')[0];
        await supabaseAdmin.from('referral_commissions').upsert({
          referrer_id: referrerId, referee_id: userId, date: today,
          trade_volume: depositAmount, amount_earned: commAmount, status: 'paid', paid_at: new Date().toISOString(),
        }, { onConflict: 'referrer_id,referee_id,date', ignoreDuplicates: false });
        console.log(`[Referral] First deposit commission of ₹${commAmount} credited to referrer ${referrerId}`);
      }
    }
  }

  // 3. AFFILIATE DEPOSIT COMMISSION
  if (profile.affiliate_id && config.affiliate_program_active) {
    const { data: aff } = await supabaseAdmin
      .from('affiliate_accounts').select('id, deposit_commission_pct, status, pending_balance, total_earnings')
      .eq('id', profile.affiliate_id).single();
    if (aff && aff.status === 'active') {
      const commPct = parseFloat(aff.deposit_commission_pct ?? config.affiliate_default_deposit_pct);
      const commAmount = Math.round((depositAmount * commPct / 100) * 100) / 100;
      if (commAmount > 0) {
        await supabaseAdmin.from('affiliate_commissions').insert({
          affiliate_id: aff.id, referred_user_id: userId, commission_type: 'deposit',
          source_id: depositId, source_amount: depositAmount,
          commission_pct: commPct, commission_amount: commAmount, status: 'pending',
        });
        await supabaseAdmin.from('affiliate_accounts').update({
          pending_balance: parseFloat(aff.pending_balance || 0) + commAmount,
          total_earnings: parseFloat(aff.total_earnings || 0) + commAmount,
        }).eq('id', aff.id);
        console.log(`[Affiliate] Commission ₹${commAmount} → affiliate ${aff.id}`);
      }
    }
  }
}

async function approveDeposit(depositId, adminId, ipAddress = '127.0.0.1') {
  const { data: deposit } = await supabaseAdmin.from('deposit_requests').select('*').eq('id', depositId).eq('status', 'pending').single();
  if (!deposit) throw new Error('Pending deposit not found');

  await supabaseAdmin.from('deposit_requests').update({ status: 'approved', approved_by: adminId, approved_at: new Date().toISOString(), credited_to_wallet: true }).eq('id', deposit.id);

  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('credit_wallet', {
    p_user_id: deposit.user_id,
    p_amount: deposit.amount,
    p_reference_id: deposit.id,
    p_reference_type: 'deposit',
    p_description: `Deposit approved via ${deposit.method}`,
    p_admin_id: adminId,
  });
  if (rpcErr) throw new Error('Wallet credit failed: ' + rpcErr.message);
  let newBalance = result?.new_balance ?? 0;

  if (deposit.payment_method_slot === 3) {
    try {
      const { data: bonusSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'crypto_deposit_bonus_pct').single();
      const bonusPercentage = bonusSetting ? Number(bonusSetting.value) : 10;
      if (bonusPercentage > 0) {
        const bonusAmount = Math.round(((deposit.amount * bonusPercentage) / 100) * 100) / 100;
        if (bonusAmount > 0) {
          const { data: bonusResult, error: bonusRpcErr } = await supabaseAdmin.rpc('credit_wallet', {
            p_user_id: deposit.user_id, p_amount: bonusAmount, p_reference_id: deposit.id, p_reference_type: 'bonus', p_description: `Crypto deposit ${bonusPercentage}% bonus`, p_admin_id: adminId,
          });
          if (!bonusRpcErr && bonusResult) {
            newBalance = bonusResult.new_balance ?? newBalance;
          }
          const { data: wallet } = await supabaseAdmin.from('wallets').select('bonus_balance, bonus_turnover_required').eq('user_id', deposit.user_id).single();
          if (wallet) {
            const { data: referralConfig } = await supabaseAdmin.from('referral_reward_config').select('bonus_turnover_multiplier').eq('id', 1).single();
            const multiplier = referralConfig ? Number(referralConfig.bonus_turnover_multiplier) : 5;
            const newBonusBalance = Number(wallet.bonus_balance || 0) + bonusAmount;
            const newTurnoverRequired = Number(wallet.bonus_turnover_required || 0) + (bonusAmount * multiplier);
            await supabaseAdmin.from('wallets').update({ bonus_balance: newBonusBalance, bonus_turnover_required: newTurnoverRequired }).eq('user_id', deposit.user_id);
          }
        }
      }
    } catch (bonusErr) { console.error('Failed to apply crypto deposit bonus:', bonusErr.message); }
  }

  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'approve_deposit', target_type: 'deposit', target_id: deposit.id, description: `Approved ₹${deposit.amount} deposit for user ${deposit.user_id}`, ip_address: ipAddress });

  try { const cache = require('../core/cache'); cache.delete(`wallet:${deposit.user_id}`); } catch (e) {}

  setImmediate(() => _handleDepositCommissionHooks(deposit.user_id, deposit.id, parseFloat(deposit.amount)).catch(e => console.error('[Commission Hook Error]', e.message)));

  setImmediate(async () => {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', deposit.user_id).single();
      if (profile) queueEmail('deposit_approved', { to: profile.email, name: profile.full_name, amount: deposit.amount, newBalance, referenceId: deposit.id, method: deposit.method, userId: deposit.user_id }).catch(e => console.error('[Email] Deposit approved email failed:', e.message));
    } catch (e) { console.error('[Email] lookup failed:', e.message); }
  });

  return newBalance;
}

async function rejectDeposit(depositId, adminId, reason, ipAddress = '127.0.0.1') {
  const { data: deposit } = await supabaseAdmin.from('deposit_requests').update({ status: 'rejected', reject_reason: reason || 'Rejected by admin', rejected_by: adminId, rejected_at: new Date().toISOString() }).eq('id', depositId).select().single();
  if (!deposit) throw new Error('Deposit not found');
  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'reject_deposit', target_type: 'deposit', target_id: depositId, description: `Rejected deposit: ${reason}`, ip_address: ipAddress });

  setImmediate(async () => {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', deposit.user_id).single();
      if (profile) queueEmail('deposit_rejected', { to: profile.email, name: profile.full_name, amount: deposit.amount, reason: reason || 'Rejected by admin', referenceId: deposit.id, userId: deposit.user_id }).catch(e => console.error('[Email] Deposit rejected email failed:', e.message));
    } catch (e) {}
  });
}

async function approveWithdrawal(withdrawalId, adminId, ipAddress = '127.0.0.1') {
  const { data: wd } = await supabaseAdmin.from('withdrawal_requests').select('*').eq('id', withdrawalId).in('status', ['pending', 'flagged']).single();
  if (!wd) throw new Error('Withdrawal not found');

  await supabaseAdmin.from('withdrawal_requests').update({ status: 'approved', approved_by: adminId, approved_at: new Date().toISOString() }).eq('id', wd.id);

  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, total_withdrawn').eq('user_id', wd.user_id).single();
  let currentBalance = 0;
  if (wallet) {
    currentBalance = Number(wallet.balance);
    await supabaseAdmin.from('wallets').update({ total_withdrawn: (Number(wallet.total_withdrawn) || 0) + Number(wd.amount) }).eq('user_id', wd.user_id);
  }

  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'approve_withdrawal', target_type: 'withdrawal', target_id: wd.id, description: `Approved ₹${wd.amount} withdrawal`, ip_address: ipAddress });

  try { const cache = require('../core/cache'); cache.delete(`wallet:${wd.user_id}`); } catch (e) {}

  setImmediate(async () => {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', wd.user_id).single();
      if (profile) queueEmail('withdrawal_approved', { to: profile.email, name: profile.full_name, amount: wd.amount, bankName: wd.bank_name, accountNumber: wd.account_number, userId: wd.user_id }).catch(e => console.error('[Email] Withdrawal approved email failed:', e.message));
    } catch (e) {}
  });

  return currentBalance;
}

async function rejectWithdrawal(withdrawalId, adminId, reason, ipAddress = '127.0.0.1') {
  const { data: wd } = await supabaseAdmin.from('withdrawal_requests').select('*').eq('id', withdrawalId).in('status', ['pending', 'flagged']).single();
  if (!wd) throw new Error('Withdrawal request not found or already processed');

  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', wd.user_id).single();
  if (!wallet) throw new Error('Wallet not found');

  const newBalance = Number(wallet.balance) + Number(wd.amount);
  const { error: refundErr } = await supabaseAdmin.from('wallets').update({ balance: newBalance }).eq('user_id', wd.user_id);
  if (refundErr) throw new Error('Failed to refund wallet balance');

  await supabaseAdmin.from('wallet_transactions').insert({ user_id: wd.user_id, type: 'refund', amount: wd.amount, balance_after: newBalance, reference_id: wd.id, reference_type: 'withdrawal', description: `Refund: Withdrawal request rejected: ${reason || 'Rejected by admin'}`, admin_id: adminId });
  await supabaseAdmin.from('withdrawal_requests').update({ status: 'rejected', reject_reason: reason || 'Rejected by admin', rejected_by: adminId, rejected_at: new Date().toISOString() }).eq('id', wd.id);
  await supabaseAdmin.from('audit_logs').insert({ admin_id: adminId, action: 'reject_withdrawal', target_type: 'withdrawal', target_id: wd.id, description: `Rejected withdrawal: ${reason || 'Rejected by admin'}`, ip_address: ipAddress });

  try { const cache = require('../core/cache'); cache.delete(`wallet:${wd.user_id}`); } catch (e) {}

  setImmediate(async () => {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', wd.user_id).single();
      if (profile) queueEmail('withdrawal_rejected', { to: profile.email, name: profile.full_name, amount: wd.amount, reason: reason || 'Rejected by admin', userId: wd.user_id }).catch(e => console.error('[Email] Withdrawal rejected email failed:', e.message));
    } catch (e) {}
  });
}

module.exports = {
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal
};
