const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { queueEmail } = require('../services/emailService');

router.use(authenticateUser);

/**
 * GET /api/bank-accounts
 * Retrieve user's bank accounts
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ bankAccounts: data || [] });
  } catch (err) {
    console.error('Fetch bank accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

/**
 * POST /api/bank-accounts
 * Create a new bank account
 */
router.post('/', async (req, res) => {
  try {
    const { type, bank_name, account_holder_name, account_number, ifsc_code, crypto_coin, crypto_address } = req.body;

    const isCrypto = type === 'crypto';
    let insertPayload = { user_id: req.user.id, type: isCrypto ? 'crypto' : 'bank' };

    if (isCrypto) {
      if (!crypto_coin || !crypto_address) {
        return res.status(400).json({ error: 'Crypto coin and address are required' });
      }
      if (crypto_coin !== 'BTC' && crypto_coin !== 'USDT') {
        return res.status(400).json({ error: 'Invalid crypto coin selected' });
      }
      insertPayload.crypto_coin = crypto_coin;
      insertPayload.crypto_address = crypto_address;
    } else {
      if (!bank_name || !account_holder_name || !account_number || !ifsc_code) {
        return res.status(400).json({ error: 'All bank details are required' });
      }
      insertPayload.bank_name = bank_name;
      insertPayload.account_holder_name = account_holder_name;
      insertPayload.account_number = account_number;
      insertPayload.ifsc_code = ifsc_code;
    }

    const { data, error } = await supabaseAdmin
      .from('user_bank_accounts')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // ── Send added email (non-blocking) ──
    setImmediate(() => {
      const profile = req.user.profile;
      if (isCrypto) {
        queueEmail('bank_account_added', {
          to: profile.email,
          name: profile.full_name,
          bankName: `Crypto Wallet (${crypto_coin})`,
          accountNumber: crypto_address,
          userId: req.user.id,
        }).catch(err => console.error('[Email] Crypto account added email failed:', err.message));
      } else {
        queueEmail('bank_account_added', {
          to: profile.email,
          name: profile.full_name,
          bankName: bank_name,
          accountNumber: account_number,
          userId: req.user.id,
        }).catch(err => console.error('[Email] Bank account added email failed:', err.message));
      }
    });

    res.status(201).json({ 
      message: isCrypto ? 'Crypto address saved successfully' : 'Bank account added successfully', 
      bankAccount: data 
    });
  } catch (err) {
    console.error('Create payment account error:', err);
    res.status(500).json({ error: 'Failed to add payment account' });
  }
});

/**
 * DELETE /api/bank-accounts/:id
 * Delete a user's bank account
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('user_bank_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      // If no row matches, single() may return an error code or PGRST116 (JSON object requested, multiple or no rows returned)
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bank account not found or unauthorized' });
      }
      return res.status(500).json({ error: error.message });
    }

    // ── Send bank account removed email (non-blocking) ──
    setImmediate(() => {
      const profile = req.user.profile;
      queueEmail('bank_account_removed', {
        to: profile.email,
        name: profile.full_name,
        bankName: data?.bank_name || 'your bank',
        accountNumber: data?.account_number,
        userId: req.user.id,
      }).catch(err => console.error('[Email] Bank account removed email failed:', err.message));
    });

    res.json({ message: 'Bank account deleted successfully' });
  } catch (err) {
    console.error('Delete bank account error:', err);
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

module.exports = router;
