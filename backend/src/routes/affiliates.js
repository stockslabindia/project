const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateAffiliate } = require('../middleware/auth');

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * POST /api/affiliates/auth/login
 * Public: Login for affiliates
 */
router.post('/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliate_accounts')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !affiliate) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (affiliate.status !== 'active') {
      return res.status(403).json({ error: `Account is ${affiliate.status}. Contact support.` });
    }

    if (!affiliate.password_hash) {
      return res.status(401).json({ error: 'Login password has not been set by administrator' });
    }

    const isValid = await bcrypt.compare(password, affiliate.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: affiliate.id, email: affiliate.email, name: affiliate.name, type: 'affiliate' },
      process.env.AFFILIATE_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('affiliate_token', token, cookieOptions);

    const { password_hash, ...safeAffiliate } = affiliate;

    res.json({
      message: 'Logged in successfully',
      affiliate: safeAffiliate,
      token
    });
  } catch (err) {
    console.error('Affiliate login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/affiliates/auth/logout
 */
router.post('/auth/logout', authenticateAffiliate, async (req, res) => {
  res.clearCookie('affiliate_token', cookieOptions);
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/affiliates/auth/me
 */
router.get('/auth/me', authenticateAffiliate, async (req, res) => {
  const { password_hash, ...safeAffiliate } = req.affiliate;
  res.json({ affiliate: safeAffiliate });
});

/**
 * GET /api/affiliates/dashboard/stats
 */
router.get('/dashboard/stats', authenticateAffiliate, async (req, res) => {
  try {
    const affiliateId = req.affiliate.id;

    // Run parallel queries to fetch stats
    const [
      { data: freshAff },
      { count: totalReferrals },
      { count: activeReferrals },
      { count: totalLeads },
      { data: commissions }
    ] = await Promise.all([
      supabaseAdmin.from('affiliate_accounts').select('total_earnings, total_paid, pending_balance').eq('id', affiliateId).single(),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('affiliate_id', affiliateId),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('affiliate_id', affiliateId).eq('status', 'active'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('submitted_by_affiliate_id', affiliateId),
      supabaseAdmin.from('affiliate_commissions').select('commission_amount, commission_type, status').eq('affiliate_id', affiliateId)
    ]);

    // Calculate current week estimated Net Loss Share for referred traders
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let currentWeekLossShareEstimate = 0;
    let currentWeekTradersNetPnl = 0;

    const { data: traders } = await supabaseAdmin.from('profiles').select('id').eq('affiliate_id', affiliateId);
    if (traders && traders.length > 0) {
      const traderIds = traders.map(t => t.id);
      const { data: closedTrades } = await supabaseAdmin.from('trades')
        .select('net_pnl')
        .in('user_id', traderIds)
        .gte('closed_at', weekAgo);

      if (closedTrades && closedTrades.length > 0) {
        currentWeekTradersNetPnl = closedTrades.reduce((s, tr) => s + parseFloat(tr.net_pnl || 0), 0);
        if (currentWeekTradersNetPnl < 0) {
          const lossSharePct = parseFloat(req.affiliate.net_loss_share_pct || 10);
          currentWeekLossShareEstimate = Math.round(((Math.abs(currentWeekTradersNetPnl) * lossSharePct) / 100) * 100) / 100;
        }
      }
    }

    const stats = {
      total_earnings: parseFloat(freshAff?.total_earnings || 0),
      pending_balance: parseFloat(freshAff?.pending_balance || 0),
      total_paid: parseFloat(freshAff?.total_paid || 0),
      total_referrals: totalReferrals || 0,
      active_referrals: activeReferrals || 0,
      total_leads: totalLeads || 0,
      deposit_commissions_total: (commissions || []).filter(c => c.commission_type === 'deposit').reduce((s, c) => s + parseFloat(c.commission_amount || 0), 0),
      net_loss_share_total: (commissions || []).filter(c => c.commission_type === 'net_loss_share').reduce((s, c) => s + parseFloat(c.commission_amount || 0), 0),
      trade_commissions_total: (commissions || []).filter(c => c.commission_type === 'trade').reduce((s, c) => s + parseFloat(c.commission_amount || 0), 0),
      current_week_traders_net_pnl: currentWeekTradersNetPnl,
      current_week_loss_share_estimate: currentWeekLossShareEstimate,
      net_loss_share_pct: req.affiliate.net_loss_share_pct || 10
    };

    res.json({ stats });
  } catch (err) {
    console.error('Affiliate stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/affiliates/dashboard/referrals
 */
router.get('/dashboard/referrals', authenticateAffiliate, async (req, res) => {
  try {
    const affiliateId = req.affiliate.id;

    const { data: referrals, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, client_id, status, created_at')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!referrals || referrals.length === 0) {
      return res.json({ referrals: [] });
    }

    const userIds = referrals.map(r => r.id);

    // Fetch trade counts and commission totals in bulk via RPC helpers
    const [
      { data: tradeCounts, error: tradeErr },
      { data: commissionEarnings, error: commErr }
    ] = await Promise.all([
      supabaseAdmin.rpc('get_user_trade_counts', { p_user_ids: userIds }),
      supabaseAdmin.rpc('get_user_affiliate_commissions', { p_affiliate_id: affiliateId, p_user_ids: userIds })
    ]);

    if (tradeErr) throw tradeErr;
    if (commErr) throw commErr;

    const tradeMap = {};
    (tradeCounts || []).forEach(t => {
      tradeMap[t.user_id] = parseInt(t.trade_count || 0);
    });

    const commissionMap = {};
    (commissionEarnings || []).forEach(c => {
      commissionMap[c.referred_user_id] = parseFloat(c.earned || 0);
    });

    const enriched = referrals.map(ref => ({
      id: ref.id,
      name: ref.full_name || 'Unknown',
      client_id: ref.client_id,
      joined: ref.created_at,
      status: ref.status,
      trades: tradeMap[ref.id] || 0,
      earned: commissionMap[ref.id] || 0
    }));

    res.json({ referrals: enriched });
  } catch (err) {
    console.error('Affiliate referrals error:', err);
    res.status(500).json({ error: 'Failed to fetch referred traders' });
  }
});

/**
 * GET /api/affiliates/dashboard/leads
 */
router.get('/dashboard/leads', authenticateAffiliate, async (req, res) => {
  try {
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('submitted_by_affiliate_id', req.affiliate.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ leads: leads || [] });
  } catch (err) {
    console.error('Affiliate leads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * POST /api/affiliates/dashboard/leads
 */
router.post('/dashboard/leads', authenticateAffiliate, async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body;

    if (!name || (!phone && !email)) {
      return res.status(400).json({ error: 'Name and at least one contact info (Phone or Email) are required' });
    }

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        source: `Affiliate: ${req.affiliate.affiliate_code}`,
        submitted_by_affiliate_id: req.affiliate.id,
        status: 'new'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ lead });
  } catch (err) {
    console.error('Affiliate submit lead error:', err);
    res.status(500).json({ error: 'Failed to submit lead' });
  }
});

/**
 * PUT /api/affiliates/dashboard/bank-info
 */
router.put('/dashboard/bank-info', authenticateAffiliate, async (req, res) => {
  try {
    const { bank_name, bank_account_number, bank_ifsc, upi_id } = req.body;

    const { data: updated, error } = await supabaseAdmin
      .from('affiliate_accounts')
      .update({
        bank_name: bank_name || null,
        bank_account_number: bank_account_number || null,
        bank_ifsc: bank_ifsc || null,
        upi_id: upi_id || null
      })
      .eq('id', req.affiliate.id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate Redis profile cache so subsequent requests get fresh details
    const { redisClient } = require('../redis/client');
    if (redisClient) {
      try {
        await redisClient.del(`auth:affiliate:${req.affiliate.id}`);
      } catch (e) {}
    }

    const { password_hash, ...safeAffiliate } = updated;
    res.json({ message: 'Payout/Bank details updated successfully', affiliate: safeAffiliate });
  } catch (err) {
    console.error('Affiliate update bank details error:', err);
    res.status(500).json({ error: 'Failed to update payout/bank details' });
  }
});

/**
 * GET /api/affiliates/dashboard/offers
 */
router.get('/dashboard/offers', authenticateAffiliate, async (req, res) => {
  try {
    const [
      { data: config },
      { data: tiers }
    ] = await Promise.all([
      supabaseAdmin.from('referral_reward_config').select('*').eq('id', 1).single(),
      supabaseAdmin.from('affiliate_tiers').select('*').eq('is_active', true).order('sort_order')
    ]);

    const activeOffers = [
      {
        id: 'standard_revshare',
        title: 'Partner Revenue Share',
        description: `Earn 15% revenue share on EVERY client deposit (up to ₹5,000 max per deposit), plus ${req.affiliate.net_loss_share_pct || 10}% weekly net loss share on referred traders' net closed trading results.`,
        type: 'revshare',
        badge: 'Active Model'
      },
      {
        id: 'biweekly_payouts',
        title: 'Bi-Weekly Payout Cycle',
        description: 'All accrued partner earnings are finalized weekly and processed bi-weekly directly to your bank account or UPI ID.',
        type: 'payout',
        badge: 'Schedule'
      }
    ];

    res.json({
      my_rates: {
        deposit_commission_pct: req.affiliate.deposit_commission_pct || 15,
        deposit_commission_cap: req.affiliate.deposit_commission_cap || 5000,
        net_loss_share_pct: req.affiliate.net_loss_share_pct || 10
      },
      tiers: tiers || [],
      offers: activeOffers
    });
  } catch (err) {
    console.error('Affiliate offers error:', err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

/**
 * GET /api/affiliates/dashboard/payouts
 */
router.get('/dashboard/payouts', authenticateAffiliate, async (req, res) => {
  try {
    const affiliateId = req.affiliate.id;
    const { data: payouts, error } = await supabaseAdmin
      .from('affiliate_payout_requests')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('requested_at', { ascending: false });

    if (error) throw error;

    res.json({ payouts: payouts || [] });
  } catch (err) {
    console.error('Affiliate payouts error:', err);
    res.status(500).json({ error: 'Failed to fetch payout history' });
  }
});

/**
 * POST /api/affiliates/dashboard/request-payout
 */
router.post('/dashboard/request-payout', authenticateAffiliate, async (req, res) => {
  try {
    const affiliateId = req.affiliate.id;

    // Check bank details
    if (!req.affiliate.bank_account_number && !req.affiliate.upi_id) {
      return res.status(400).json({ error: 'Please update and save your Bank Account or UPI ID details in the Payout / Bank Info tab first.' });
    }

    // Check pending balance from fresh affiliate_accounts record
    const { data: freshAff } = await supabaseAdmin
      .from('affiliate_accounts')
      .select('pending_balance, name, email, affiliate_code, bank_name, bank_account_number, bank_ifsc, upi_id')
      .eq('id', affiliateId)
      .single();

    const pendingBalance = parseFloat(freshAff?.pending_balance || 0);
    if (pendingBalance <= 0) {
      return res.status(400).json({ error: 'You have no pending balance available for payout.' });
    }

    // Check if there is already an active pending request
    const { data: existingPending } = await supabaseAdmin
      .from('affiliate_payout_requests')
      .select('id')
      .eq('affiliate_id', affiliateId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      return res.status(400).json({ error: 'You already have a payout request pending admin review.' });
    }

    // Fetch all pending commissions for this affiliate
    const { data: pendingComms } = await supabaseAdmin
      .from('affiliate_commissions')
      .select('id, commission_amount')
      .eq('affiliate_id', affiliateId)
      .eq('status', 'pending');

    const commCount = pendingComms ? pendingComms.length : 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Create payout request entry
    const { data: payout, error } = await supabaseAdmin
      .from('affiliate_payout_requests')
      .insert({
        affiliate_id: affiliateId,
        period_start: todayStr,
        period_end: todayStr,
        total_amount: pendingBalance,
        commission_count: commCount,
        status: 'pending',
        notes: `Requested by affiliate ${freshAff?.name} (${freshAff?.affiliate_code})`
      })
      .select()
      .single();

    if (error) throw error;

    // Mark pending commissions as included in this payout request
    if (pendingComms && pendingComms.length > 0) {
      await supabaseAdmin
        .from('affiliate_commissions')
        .update({ status: 'included_in_payout', payout_id: payout.id })
        .in('id', pendingComms.map(c => c.id));
    }

    res.status(201).json({
      message: 'Payout request submitted successfully. Admin will review and process payment.',
      payout
    });
  } catch (err) {
    console.error('Affiliate request payout error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit payout request' });
  }
});

module.exports = router;
