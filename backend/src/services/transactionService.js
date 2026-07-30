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

  // ── 1. REFEREE SIGNUP BONUS ────────────────────────────────────────────────
  // When the referred user (referee) makes their FIRST deposit:
  //   • bonus = 10% of first-deposit-amount, capped at ₹3,500
  //   • turnover_required = first_deposit_amount × 7  (FIXED — subsequent
  //     deposits do NOT change this target)
  //   • bonus_first_deposit_amount is stored so the UI can display progress
  //   • Once turnover completed, SQL fn update_bonus_turnover auto-transfers
  //     bonus → main balance
  // ──────────────────────────────────────────────────────────────────────────
  if (isFirstDeposit && config.referral_program_active && profile.referred_by) {
    try {
      // Only credit if no bonus has been credited yet for this referee
      const { data: existingBonus } = await supabaseAdmin
        .from('wallets')
        .select('bonus_balance, bonus_first_deposit_amount, bonus_source')
        .eq('user_id', userId)
        .single();

      const alreadyHasReferralBonus = existingBonus?.bonus_source === 'referral' && parseFloat(existingBonus?.bonus_first_deposit_amount || 0) > 0;

      if (!alreadyHasReferralBonus) {
        // Calculate bonus: 10% of first deposit, capped at ₹3,500
        const bonusPct = parseFloat(config.referral_signup_bonus_pct ?? 10);
        const bonusCap = parseFloat(config.referral_signup_bonus_cap ?? 3500);
        const turnoverMultiplier = parseFloat(config.referral_turnover_multiplier ?? 7);

        const rawBonus = (depositAmount * bonusPct) / 100;
        const bonusAmount = Math.min(Math.round(rawBonus * 100) / 100, bonusCap);

        if (bonusAmount > 0) {
          // Turnover target is based STRICTLY on this first deposit amount
          const turnoverRequired = Math.round(depositAmount * turnoverMultiplier * 100) / 100;

          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance, bonus_balance')
            .eq('user_id', userId)
            .single();

          if (wallet) {
            const newBonusBalance = parseFloat(wallet.bonus_balance || 0) + bonusAmount;

            await supabaseAdmin.from('wallets').update({
              bonus_balance:              newBonusBalance,
              bonus_turnover_required:    turnoverRequired,
              bonus_turnover_completed:   0,
              bonus_first_deposit_amount: depositAmount,  // frozen — never overwritten by subsequent deposits
              bonus_source:              'referral',
              bonus_locked:              true,
            }).eq('user_id', userId);

            await supabaseAdmin.from('wallet_transactions').insert({
              user_id:        userId,
              type:           'bonus',
              amount:         bonusAmount,
              balance_after:  wallet.balance,              // main balance unchanged
              reference_id:   depositId,
              reference_type: 'referral_signup_bonus',
              description:    `🎁 Referral signup bonus: ₹${bonusAmount} (${bonusPct}% of ₹${depositAmount}). Trade ₹${turnoverRequired.toLocaleString('en-IN')} to unlock.`,
            });

            // Mark the referral_bonus_events row as credited (if it exists)
            const { data: bonusEvent } = await supabaseAdmin
              .from('referral_bonus_events')
              .select('id')
              .eq('referee_id', userId)
              .eq('status', 'pending')
              .maybeSingle();

            if (bonusEvent) {
              await supabaseAdmin.from('referral_bonus_events').update({
                status:             'credited',
                credited_at:        new Date().toISOString(),
                deposit_trigger_id: depositId,
                bonus_referee_amount: bonusAmount,
              }).eq('id', bonusEvent.id);
            }

            console.log(`[Referral Bonus] ₹${bonusAmount} bonus credited to referee ${userId}. Turnover required: ₹${turnoverRequired}`);
          }
        }
      }
    } catch (err) {
      console.error('[Referral Bonus] Failed to credit referee signup bonus:', err.message);
    }
  }

  // ── 2. REFERRER EARNING ───────────────────────────────────────────────────
  // When the referred user (referee) makes their FIRST deposit:
  //   • referrer earns 10% of that deposit, capped at ₹3,500
  //   • credited DIRECTLY to referrer's main balance (real funds, withdrawable)
  //   • Same % / cap as the referee bonus, but NO bonus-wallet / NO turnover lock
  //   • No tiers — flat rate for everyone
  // ──────────────────────────────────────────────────────────────────────────
  if (isFirstDeposit && config.referral_program_active && profile.referred_by) {
    try {
      const referrerId = profile.referred_by;

      const earnPct = parseFloat(config.referral_signup_bonus_pct ?? 10);
      const earnCap = parseFloat(config.referral_signup_bonus_cap ?? 3500);
      const rawEarn = (depositAmount * earnPct) / 100;
      const earnAmount = Math.min(Math.round(rawEarn * 100) / 100, earnCap);

      if (earnAmount > 0) {
        // Credit to referrer's MAIN balance (not bonus wallet)
        const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc('credit_wallet', {
          p_user_id:        referrerId,
          p_amount:         earnAmount,
          p_reference_id:   depositId,
          p_reference_type: 'referral_first_deposit',
          p_description:    `🎉 Referral earning: ₹${earnAmount} (${earnPct}% of ₹${depositAmount} first deposit by your referral)`,
          p_admin_id:       null,
        });

        if (creditErr) {
          console.error('[Referral] Failed to credit referrer earning:', creditErr.message);
        } else {
          // Record in referral_commissions for tracking
          const today = new Date().toISOString().split('T')[0];
          await supabaseAdmin.from('referral_commissions').upsert({
            referrer_id:  referrerId,
            referee_id:   userId,
            date:         today,
            trade_volume: depositAmount,
            amount_earned: earnAmount,
            status:       'paid',
            paid_at:      new Date().toISOString(),
          }, { onConflict: 'referrer_id,referee_id,date', ignoreDuplicates: false });

          console.log(`[Referral] ₹${earnAmount} credited to referrer ${referrerId} main wallet (${earnPct}% of ₹${depositAmount})`);
        }
      }
    } catch (err) {
      console.error('[Referral] Failed to credit referrer earning:', err.message);
    }
  }


  // ── 3. AFFILIATE DEPOSIT COMMISSION ───────────────────────────────────────
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

  const { data: result, error: refundErr } = await supabaseAdmin.rpc('refund_wallet', {
    p_user_id: wd.user_id,
    p_amount: wd.amount,
    p_reference_id: wd.id,
    p_reference_type: 'withdrawal',
    p_description: `Refund: Withdrawal request rejected: ${reason || 'Rejected by admin'}`,
    p_admin_id: adminId,
  });
  if (refundErr) throw new Error('Failed to refund wallet balance: ' + refundErr.message);

  const newBalance = result?.new_balance ?? 0;
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
