const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { sendWithdrawalAlert } = require('../core/telegram/alerts/financialAlerts');
const { sendWhaleAlert } = require('../core/telegram/alerts/riskAlerts');
router.use(authenticateUser);

/**
 * POST /api/withdrawals
 * Create a withdrawal request with friction engine
 */
router.post('/', async (req, res) => {
  try {
    const { amount, bank_account_id } = req.body;
    const userId = req.user.id;

    // Check KYC status
    const profile = req.user.profile;
    if (!profile || profile.kyc_status !== 'verified') {
      return res.status(403).json({ error: 'KYC verification is required to initiate withdrawals. Please complete your KYC verification first.' });
    }

    // Check client restrictions for withdrawal access block
    const { getClientRestrictions } = require('../core/risk/clientRestrictions');
    const restrictions = await getClientRestrictions(userId);
    if (restrictions && restrictions.withdrawals === false) {
      return res.status(403).json({ error: 'Withdrawals are currently blocked for your account. Contact support.' });
    }

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    if (amount < 500) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ₹500' });
    }

    if (!bank_account_id) {
      return res.status(400).json({ error: 'Bank account is required' });
    }

    // Get bank account details
    const { data: bankAccount, error: bankErr } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('id', bank_account_id)
      .eq('user_id', userId)
      .single();

    if (bankErr || !bankAccount) {
      return res.status(400).json({ error: 'Selected bank account was not found or is invalid' });
    }

    // Get wallet
    const { data: wallet } = await supabaseAdmin.from('wallets').select('*').eq('user_id', userId).single();
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // Check withdrawable balance (balance - used_margin - bonus_locked)
    const withdrawable = wallet.balance - wallet.used_margin - (wallet.bonus_locked ? wallet.bonus_balance : 0);
    if (amount > withdrawable) {
      return res.status(400).json({ error: 'Insufficient withdrawable balance', withdrawable });
    }

    // Check open positions
    const { count: openPositions } = await supabaseAdmin
      .from('positions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'open');

    // ── Withdrawal Friction Engine ──
    // Get system settings for delays
    const { data: holdHoursSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'withdrawal_min_hold_hours').single();
    const { data: firstWdSetting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'first_withdrawal_hold_hours').single();
    const { data: autoApproveLimit } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'withdrawal_auto_approve_limit').single();

    const minHoldHours = holdHoursSetting ? parseInt(holdHoursSetting.value) : 24;
    const firstWdHours = firstWdSetting ? parseInt(firstWdSetting.value) : 72;
    const autoLimit = autoApproveLimit ? parseInt(autoApproveLimit.value) : 10000;

    // Check if first withdrawal
    const { count: prevWithdrawals } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    const isFirstWithdrawal = prevWithdrawals === 0;
    const holdHours = isFirstWithdrawal ? firstWdHours : minHoldHours;
    const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

    let holdReason = `Standard ${holdHours}-hour processing period`;
    if (isFirstWithdrawal) holdReason = 'First withdrawal — enhanced verification required';
    if (amount > 100000) holdReason = 'Large withdrawal — manual review required';

    // Determine initial status
    let status = 'pending';
    let flagReason = null;
    if (amount > 500000) {
      status = 'flagged';
      flagReason = 'Large withdrawal exceeding ₹5L threshold';
    }

    const isCrypto = bankAccount.type === 'crypto';

    const { data, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert({
        user_id: userId,
        amount,
        method: isCrypto ? 'crypto' : 'bank_transfer',
        bank_name: isCrypto ? bankAccount.crypto_coin : bankAccount.bank_name,
        account_number: isCrypto ? bankAccount.crypto_address : bankAccount.account_number,
        ifsc_code: isCrypto ? null : bankAccount.ifsc_code,
        metadata: {
          account_holder_name: isCrypto ? null : bankAccount.account_holder_name,
          bank_account_id: bankAccount.id,
          type: bankAccount.type || 'bank',
          crypto_coin: isCrypto ? bankAccount.crypto_coin : null,
          crypto_address: isCrypto ? bankAccount.crypto_address : null
        },
        status,
        flag_reason: flagReason,
        hold_until: holdUntil.toISOString(),
        hold_reason: holdReason,
        balance_at_request: wallet.balance,
        open_positions_count: openPositions || 0,
        ip_address: req.ip,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Bug #2 + #13: Atomically deduct the withdrawal amount from the wallet balance
    // so funds cannot be double-spent while the request is pending.
    // Uses the atomic debit_wallet Postgres RPC.
    const { data: debitResult, error: reserveErr } = await supabaseAdmin.rpc('debit_wallet', {
      p_user_id: userId,
      p_amount: amount,
      p_reference_id: data.id,
      p_reference_type: 'withdrawal',
      p_description: `Withdrawal request submitted via ${isCrypto ? 'Crypto (' + bankAccount.crypto_coin + ')' : 'Bank Transfer (' + bankAccount.bank_name + ')'}`,
    });

    if (reserveErr) {
      // If reservation fails, cancel the withdrawal request to avoid inconsistency
      await supabaseAdmin.from('withdrawal_requests').update({ status: 'cancelled', flag_reason: 'Balance reservation failed' }).eq('id', data.id);
      return res.status(400).json({ error: reserveErr.message || 'Insufficient balance or a concurrent transaction conflict occurred. Please try again.' });
    }

    // Fetch user profile for Telegram alert
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (userProfile) {
      sendWithdrawalAlert(data, userProfile, bankAccount);
      if (amount > 100000) {
        sendWhaleAlert('WITHDRAWAL', amount, userProfile);
      }
    }

    res.status(201).json({ message: 'Withdrawal request submitted', withdrawal: data });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Failed to submit withdrawal request' });
  }
});

/**
 * GET /api/withdrawals
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ withdrawals: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

module.exports = router;
