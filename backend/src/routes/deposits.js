const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

/**
 * GET /api/deposits/payment-methods
 * Get active payment methods for slots 1, 2, and 3
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const { data: methods, error: methodsError } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('slot', { ascending: true });
    
    if (methodsError) return res.status(500).json({ error: methodsError.message });

    // Fetch crypto bonus percentage from system_settings
    const { data: bonusSetting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'crypto_deposit_bonus_pct')
      .single();

    const cryptoDepositBonusPct = bonusSetting ? Number(bonusSetting.value) : 10;
    
    res.json({ 
      paymentMethods: methods || [],
      cryptoDepositBonusPct
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * POST /api/deposits
 * Create a deposit request
 */
router.post('/', async (req, res) => {
  try {
    const { amount, utr_number, bank_reference, screenshot_base64, payment_method_slot, method, metadata } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    if (!utr_number) {
      return res.status(400).json({ error: 'UTR number is required' });
    }
    if (!screenshot_base64) {
      return res.status(400).json({ error: 'Screenshot receipt is required' });
    }
    if (!payment_method_slot) {
      return res.status(400).json({ error: 'Payment method option selection is required' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 500) {
      return res.status(400).json({ error: 'Minimum deposit is ₹500' });
    }

    // Process screenshot base64 upload
    const fs = require('fs');
    const path = require('path');
    let proof_url = null;

    try {
      const matches = screenshot_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let ext = '.png';
      let buffer;
      
      if (matches && matches.length === 3) {
        const type = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
        if (type.includes('jpeg') || type.includes('jpg')) ext = '.jpg';
        else if (type.includes('gif')) ext = '.gif';
        else if (type.includes('webp')) ext = '.webp';
      } else {
        buffer = Buffer.from(screenshot_base64, 'base64');
      }

      const filename = `deposit_${req.user.id}_${Date.now()}${ext}`;
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);
      proof_url = `/uploads/${filename}`;
    } catch (uploadErr) {
      console.error('Screenshot upload failed:', uploadErr);
      return res.status(500).json({ error: 'Failed to process screenshot upload receipt' });
    }

    const { data, error } = await supabaseAdmin
      .from('deposit_requests')
      .insert({
        user_id: req.user.id,
        amount: numericAmount,
        method: method || `Option ${payment_method_slot}`,
        utr_number,
        bank_reference: bank_reference || null,
        proof_url,
        payment_method_slot,
        ip_address: req.ip,
        status: 'pending',
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: 'Deposit request submitted successfully. Please wait to get your payment verified.', deposit: data });
  } catch (err) {
    console.error('Failed to submit deposit request:', err);
    res.status(500).json({ error: 'Failed to submit deposit request' });
  }
});

/**
 * GET /api/deposits
 * Get user's deposit history
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('deposit_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ deposits: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
});

module.exports = router;
