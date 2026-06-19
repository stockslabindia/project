const router = require('express').Router();
const { supabaseAdmin, supabasePublic } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

function setAuthCookies(res, session) {
  if (session && session.access_token) {
    res.cookie('access_token', session.access_token, cookieOptions);
  }
  if (session && session.refresh_token) {
    res.cookie('refresh_token', session.refresh_token, cookieOptions);
  }
}

/**
 * POST /api/auth/signup
 * Register a new trader user via Supabase Auth
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, phone, referral_code } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full_name are required' });
    }

    // 1. Create auth user in Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // 2. Resolve the referral/affiliate code (if provided)
    let referredBy = null;
    let affiliateId = null;
    let affiliateCodeUsed = null;
    let codeType = null; // 'referral' | 'affiliate' | null

    if (referral_code) {
      const code = referral_code.trim().toUpperCase();
      // Check referral code first (user's personal code)
      const { data: referrer } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();
      if (referrer) {
        referredBy = referrer.id;
        codeType = 'referral';
      } else {
        // Check affiliate code
        const { data: affiliate } = await supabaseAdmin
          .from('affiliate_accounts')
          .select('id, status')
          .eq('affiliate_code', code)
          .maybeSingle();
        if (affiliate && affiliate.status === 'active') {
          affiliateId = affiliate.id;
          affiliateCodeUsed = code;
          codeType = 'affiliate';
        }
      }
    }

    // 3. Create profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name,
        email,
        phone: phone || null,
        referred_by: referredBy,
        affiliate_id: affiliateId,
        affiliate_code_used: affiliateCodeUsed,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user if profile fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create profile: ' + profileError.message });
    }

    // 4. Signup bonus event disabled (rewards are now strictly percentage-based on first deposit)

    // 5. Sign in to get session
    const { data: session, error: signInError } = await supabasePublic.auth.signInWithPassword({
      email, password,
    });

    if (signInError) {
      return res.status(500).json({ error: 'Account created but login failed' });
    }

    setAuthCookies(res, session.session);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: profile.id,
        client_id: profile.client_id,
        email: profile.email,
        full_name: profile.full_name,
        referral_code: profile.referral_code,
      },
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
      },
      bonus_pending: codeType === 'referral',
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

/**
 * POST /api/auth/login
 * Login trader user
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const identifier = (req.body.identifier || req.body.email || '').trim();
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Mobile/User ID and password are required' });
    }

    // Resolve email and check user existence/status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`email.eq.${identifier.toLowerCase()},phone.eq.${identifier},client_id.eq.${identifier.toUpperCase()}`)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Invalid Email, Mobile, or User ID' });
    }

    if (profile.status !== 'active') {
      return res.status(403).json({ error: `Account is ${profile.status}. Contact support.` });
    }

    // Authenticate with Supabase using the resolved email and password
    const { data, error: authError } = await supabasePublic.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (authError) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Update last login
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString(), login_count: (profile.login_count || 0) + 1 })
      .eq('id', profile.id);

    setAuthCookies(res, data.session);

    res.json({
      user: {
        id: profile.id,
        client_id: profile.client_id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        tier: profile.tier,
        kyc_status: profile.kyc_status,
        referral_code: profile.referral_code,
        trading_enabled: profile.trading_enabled,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    // Sign out the specific user (not the server's shared session)
    await supabaseAdmin.auth.admin.signOut(req.user.id);
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    // Still return success — client should clear local tokens regardless
    res.json({ message: 'Logged out' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh session using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const refresh_token = req.body.refresh_token || req.cookies.refresh_token;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { data, error } = await supabasePublic.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    setAuthCookies(res, data.session);

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile + wallet
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    res.json({
      user: req.user.profile,
      wallet: wallet || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * POST /api/auth/change-password
 * Change current user's password (requires current password verification)
 */
router.post('/change-password', authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Verify current password by attempting sign-in
    const { error: verifyError } = await supabasePublic.auth.signInWithPassword({
      email: req.user.profile.email,
      password: currentPassword,
    });

    if (verifyError) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password: newPassword,
    });

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update password: ' + updateError.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * GET /api/auth/referrals
 * Get current user's referral data (people they referred)
 */
router.get('/referrals', authenticateUser, async (req, res) => {
  try {
    // Get users who were referred by the current user
    const { data: referrals, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, status, created_at')
      .eq('referred_by', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Enrich with trade count and actual commission earned
    const enrichedReferrals = await Promise.all(
      (referrals || []).map(async (ref) => {
        // Get total trades
        const { count: tradeCount } = await supabaseAdmin
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', ref.id);
          
        const trades = tradeCount || 0;
        
        // Get total earned from this referee
        const { data: commissions } = await supabaseAdmin
          .from('referral_commissions')
          .select('amount_earned')
          .eq('referrer_id', req.user.id)
          .eq('referee_id', ref.id);
          
        const earned = (commissions || []).reduce((sum, c) => sum + parseFloat(c.amount_earned || 0), 0);

        return {
          id: ref.id,
          name: ref.full_name || 'Unknown',
          status: ref.status || 'active',
          joined: new Date(ref.created_at).toISOString().split('T')[0],
          trades: trades,
          earned: earned,
        };
      })
    );

    res.json({ referrals: enrichedReferrals });
  } catch (err) {
    console.error('Referrals fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

/**
 * GET /api/auth/notifications
 * Get notifications for the current user (system broadcasts)
 */
router.get('/notifications', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_notifications')
      .select('id, title, message, type, created_at, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const notifications = (data || []).map(n => ({
      id: n.id,
      type: n.type === 'alert' ? 'alert' : n.type === 'trade' ? 'trade' : n.type === 'broadcast' ? 'broadcast' : 'system',
      message: n.message || n.title,
      title: n.title,
      time: formatTimeAgo(n.created_at),
      read: false, // Could be enhanced with a read-status table per user
    }));

    res.json({ notifications });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Helper for relative time
function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * GET /api/auth/system/debug
 * Exposes live diagnostics for feed connection monitoring
 */
router.get('/system/debug', authenticateUser, async (req, res) => {
  try {
    const { redisClient } = require('../redis/client');
    const { getFeedStatus } = require('../ws/priceEngine');
    
    // Check Redis connection status
    let redisStatus = 'OFFLINE';
    if (redisClient) {
      redisStatus = redisClient.status || (redisClient.connected ? 'CONNECTED' : 'UNKNOWN');
    }

    const feedStatus = getFeedStatus();

    res.json({
      timestamp: Date.now(),
      status: 'success',
      diagnostics: {
        feeds: {
          finnhub: feedStatus.finnhub,
          binance: feedStatus.binance,
          lastLiveTickAge: feedStatus.lastLiveTickAge,
          totalSymbolsTracked: feedStatus.totalSymbolsTracked,
        },
        redis: {
          status: redisStatus
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

