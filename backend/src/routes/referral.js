const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

/**
 * GET /api/referral/my-stats
 * Enhanced referral stats for the logged-in trader
 */
router.get('/my-stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      { data: profile },
      { data: config },
      { data: bonusEvent },
      { data: referrals },
      { data: commissions },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('referral_code, referred_by').eq('id', userId).single(),
      supabaseAdmin.from('referral_reward_config').select('referral_program_active, referral_signup_bonus_pct, referral_signup_bonus_cap, referral_turnover_multiplier').eq('id', 1).single(),
      supabaseAdmin.from('referral_bonus_events').select('*').eq('referee_id', userId).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, status, created_at').eq('referred_by', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('referral_commissions').select('amount_earned, status').eq('referrer_id', userId),
    ]);

    const totalReferrals = (referrals || []).length;
    const activeReferrals = (referrals || []).filter(r => r.status === 'active').length;
    const totalEarned = (commissions || []).reduce((s, c) => s + parseFloat(c.amount_earned || 0), 0);
    const pendingEarned = (commissions || []).filter(c => c.status === 'pending').reduce((s, c) => s + parseFloat(c.amount_earned || 0), 0);

    // Enrich referrals using database group-by RPC to solve N+1 query bottleneck
    const { data: dbStats, error: rpcError } = await supabaseAdmin.rpc('get_referral_stats', {
      p_referrer_id: userId
    });

    if (rpcError) {
      console.error('[Referral RPC Error]', rpcError.message);
    }

    // Check which referrals have made their first deposit
    const refereeIds = (dbStats || []).map(r => r.referee_id);
    let depositMap = {};
    if (refereeIds.length > 0) {
      const { data: deposits } = await supabaseAdmin
        .from('deposit_requests')
        .select('user_id, amount')
        .in('user_id', refereeIds)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });
      // First approved deposit per referee
      (deposits || []).forEach(d => {
        if (!depositMap[d.user_id]) depositMap[d.user_id] = parseFloat(d.amount || 0);
      });
    }

    const enrichedReferrals = (dbStats || [])
      .slice(0, 20)
      .map(ref => {
        const firstDepositAmt = depositMap[ref.referee_id] || 0;
        const hasDeposited = firstDepositAmt > 0;
        return {
          id:             ref.referee_id,
          name:           ref.full_name || 'Unknown',
          status:         ref.status || 'active',
          joined:         new Date(ref.created_at).toISOString().split('T')[0],
          trades:         parseInt(ref.trade_count || 0),
          earned:         parseFloat(ref.commissions_sum || 0),
          has_deposited:  hasDeposited,
          first_deposit:  firstDepositAmt,
        };
      });

    res.json({
      referral_code: profile?.referral_code || null,
      referral_program_active: config?.referral_program_active !== false,
      signup_bonus_pending: bonusEvent?.status === 'pending' ? {
        referee_bonus: bonusEvent.bonus_referee_amount,
        message: 'Make your first deposit to unlock your signup bonus!',
      } : null,
      signup_bonus_credited: bonusEvent?.status === 'credited' ? {
        referee_bonus: bonusEvent.bonus_referee_amount,
        credited_at: bonusEvent.credited_at,
      } : null,
      stats: {
        total_referrals: totalReferrals,
        active_referrals: activeReferrals,
        total_earned: totalEarned,
        pending_earned: pendingEarned,
      },
      referrals: enrichedReferrals,
      // Simplified: flat rate for everyone, no tiers
      config: {
        bonus_pct:          parseFloat(config?.referral_signup_bonus_pct ?? 10),
        bonus_cap:          parseFloat(config?.referral_signup_bonus_cap ?? 3500),
        turnover_multiplier: parseFloat(config?.referral_turnover_multiplier ?? 7),
      },
    });
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

/**
 * GET /api/referral/bonus-history
 * Returns bonus events for the current user (as referee and referrer)
 */
router.get('/bonus-history', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: asReferrer } = await supabaseAdmin
      .from('referral_bonus_events')
      .select('*, profiles!referral_bonus_events_referee_id_fkey(full_name, client_id)')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: asReferee } = await supabaseAdmin
      .from('referral_bonus_events')
      .select('*, profiles!referral_bonus_events_referrer_id_fkey(full_name, client_id)')
      .eq('referee_id', userId)
      .maybeSingle();

    res.json({
      as_referrer: (asReferrer || []).map(e => ({
        id: e.id,
        referee_name: e.profiles?.full_name || 'Unknown',
        referee_client_id: e.profiles?.client_id,
        bonus_amount: e.bonus_referrer_amount,
        status: e.status,
        created_at: e.created_at,
        credited_at: e.credited_at,
      })),
      as_referee: asReferee ? {
        id: asReferee.id,
        bonus_amount: asReferee.bonus_referee_amount,
        status: asReferee.status,
        created_at: asReferee.created_at,
        credited_at: asReferee.credited_at,
      } : null,
    });
  } catch (err) {
    console.error('Bonus history error:', err);
    res.status(500).json({ error: 'Failed to fetch bonus history' });
  }
});

/**
 * GET /api/referral/validate/:code
 * Public: validate a referral or affiliate code before signup
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    // Check referral code first
    const { data: referrer } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('referral_code', code)
      .maybeSingle();

    if (referrer) {
      return res.json({ valid: true, type: 'referral', name: referrer.full_name?.split(' ')[0] || 'a friend' });
    }

    // Check affiliate code
    const { data: affiliate } = await supabaseAdmin
      .from('affiliate_accounts')
      .select('id, name, status')
      .eq('affiliate_code', code)
      .maybeSingle();

    if (affiliate && affiliate.status === 'active') {
      return res.json({ valid: true, type: 'affiliate', name: affiliate.name?.split(' ')[0] || 'a partner' });
    }

    res.json({ valid: false });
  } catch (err) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

module.exports = router;
