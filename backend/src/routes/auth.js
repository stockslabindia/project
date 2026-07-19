const router = require('express').Router();
const { supabaseAdmin, supabasePublic } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { queueEmail } = require('../services/emailService');

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

    // Validate password length BEFORE sending OTP (so user is not surprised later)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password should be at least 6 characters.' });
    }

    // 1. Check if user already exists in DB profiles
    const cleanedPhone = phone ? phone.trim() : null;
    let query = supabaseAdmin.from('profiles').select('id, email, phone');
    if (cleanedPhone) {
      query = query.or(`email.eq.${email},phone.eq.${cleanedPhone}`);
    } else {
      query = query.eq('email', email);
    }
    const { data: existingUser, error: checkError } = await query.maybeSingle();

    if (checkError) {
      console.error('[Signup check error]', checkError);
    }

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      if (cleanedPhone && existingUser.phone === cleanedPhone) {
        return res.status(400).json({ error: 'An account with this phone number already exists' });
      }
    }

    // 2. Generate UUID for sessionId
    const { v4: uuidv4 } = require('uuid');
    const sessionId = uuidv4();

    // 3. Generate 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Save registration details in Redis under signup_pending:${sessionId} with 5-minute TTL
    const signupPayload = {
      otp,
      email,
      password,
      full_name,
      phone: cleanedPhone,
      referral_code
    };

    const { redisClient } = require('../redis/client');
    await redisClient.setex(`signup_pending:${sessionId}`, 300, JSON.stringify(signupPayload));

    // 5. Send via APITxT (SMS/WhatsApp)
    const { sendOtp } = require('../services/otpService');
    await sendOtp(cleanedPhone, otp);

    res.status(201).json({
      message: 'OTP sent successfully. Please verify your phone number.',
      user: {
        id: sessionId, // Map sessionId to user.id so frontend stores it in state as userId
        email,
        phone: cleanedPhone,
      },
      requires_otp: true,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and activate user
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId: sessionId, otp, email, password } = req.body;
    if (!sessionId || !otp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Retrieve pending signup payload from Redis
    const { redisClient } = require('../redis/client');
    const pendingDataStr = await redisClient.get(`signup_pending:${sessionId}`);
    
    if (!pendingDataStr) {
      return res.status(400).json({ error: 'OTP session has expired or is invalid. Please sign up again.' });
    }

    const pendingData = JSON.parse(pendingDataStr);

    const isDev = process.env.NODE_ENV !== 'production';
    const isMockBypass = isDev && (!process.env.APITXT_AUTH_KEY || otp === '123456');

    if (pendingData.otp !== otp && !isMockBypass) {
      return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
    }

    // OTP is verified! Now create the user in Supabase
    // 1. Create auth user via standard signUp
    const { data: signUpData, error: signUpError } = await supabasePublic.auth.signUp({
      email: pendingData.email,
      password: pendingData.password,
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }

    if (!signUpData.user || signUpData.user.identities?.length === 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // 2. Auto-confirm the email via admin API
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      signUpData.user.id,
      { email_confirm: true }
    );
    if (confirmError) {
      console.warn('[Signup] Could not auto-confirm email:', confirmError.message);
    }

    // 3. Resolve the referral/affiliate code
    let referredBy = null;
    let affiliateId = null;
    let affiliateCodeUsed = null;
    let codeType = null;
    let referrerName = null;

    if (pendingData.referral_code) {
      const code = pendingData.referral_code.trim().toUpperCase();
      const { data: referrer } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('referral_code', code)
        .maybeSingle();
      if (referrer) {
        referredBy = referrer.id;
        codeType = 'referral';
        referrerName = referrer.full_name;
      } else {
        const { data: affiliate } = await supabaseAdmin
          .from('affiliate_accounts')
          .select('id, status, full_name')
          .eq('affiliate_code', code)
          .maybeSingle();
        if (affiliate && affiliate.status === 'active') {
          affiliateId = affiliate.id;
          affiliateCodeUsed = code;
          codeType = 'affiliate';
          referrerName = affiliate.full_name || 'Affiliate';
        }
      }
    }

    // 4. Create profile via Security Definer RPC function
    const { data: profile, error: profileError } = await supabasePublic.rpc('create_user_profile', {
      p_id: signUpData.user.id,
      p_full_name: pendingData.full_name,
      p_email: pendingData.email,
      p_phone: pendingData.phone || null,
      p_referred_by: referredBy,
      p_affiliate_id: affiliateId,
      p_affiliate_code_used: affiliateCodeUsed,
    });

    if (profileError) {
      // Rollback auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id);
      return res.status(500).json({ error: 'Failed to create profile: ' + profileError.message });
    }

    // 5. Update profile status to active explicitly
    const { error: activateError } = await supabaseAdmin.from('profiles').update({ status: 'active' }).eq('id', profile.id);
    if (activateError) {
      console.error('Failed to activate profile:', activateError);
      // Non-fatal, but log it
    }

    // 6. Delete OTP session from Redis
    await redisClient.del(`signup_pending:${sessionId}`);

    // 7. Sign in
    const { data: session, error: signInError } = await supabasePublic.auth.signInWithPassword({
      email: pendingData.email,
      password: pendingData.password,
    });

    if (signInError) {
      return res.status(500).json({ error: 'Verified but login failed. Please try logging in.' });
    }

    setAuthCookies(res, session.session);

    // Send Welcome Email
    setImmediate(() => {
      queueEmail('welcome', {
        to: pendingData.email,
        name: profile.full_name,
        clientId: profile.client_id,
        userId: profile.id,
      }).catch(err => console.error('[Email] Welcome email failed:', err.message));
      
      // Send Telegram Signup Alert
      const { sendNewUserAlert } = require('../core/telegram/alerts/identityAlerts');
      if (sendNewUserAlert) {
        sendNewUserAlert(profile, referrerName, codeType).catch(() => {});
      }
    });

    res.json({
      message: 'Phone verified and logged in successfully',
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
      }
    });

  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(400).json({ error: err.message || 'OTP Verification failed' });
  }
});

/**
 * POST /api/auth/resend-otp
 * Resend OTP to user's phone via APITxT
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const { userId: sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const { redisClient } = require('../redis/client');
    const pendingDataStr = await redisClient.get(`signup_pending:${sessionId}`);

    if (!pendingDataStr) {
      return res.status(404).json({ error: 'OTP session expired or invalid. Please sign up again.' });
    }

    const pendingData = JSON.parse(pendingDataStr);

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update Redis
    pendingData.otp = otp;
    await redisClient.setex(`signup_pending:${sessionId}`, 300, JSON.stringify(pendingData));

    // Send via APITxT
    const { sendOtp } = require('../services/otpService');
    const otpSent = await sendOtp(pendingData.phone, otp);

    if (!otpSent && process.env.APITXT_AUTH_KEY) {
      return res.status(500).json({ error: 'Failed to send OTP via SMS/WhatsApp' });
    }

    res.json({ message: 'OTP resent successfully', phone: pendingData.phone });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Failed to resend OTP' });
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

    // Resolve email and check user existence/status using SECURITY DEFINER RPC to bypass RLS
    const { data: profiles, error: profileError } = await supabaseAdmin.rpc('get_profile_by_identifier', {
      p_identifier: identifier
    });
    
    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (profileError || !profile) {
      console.error('[Login Debug] identifier:', identifier, 'profileError:', profileError, 'profiles:', profiles);
      return res.status(401).json({ error: 'Invalid Email, Mobile, or User ID', debug: profileError });
    }

    if (profile.status === 'pending_otp') {
      // Allow user to trigger OTP flow again from frontend if they try to login while pending
      return res.status(403).json({ 
        error: 'Phone verification required', 
        requires_otp: true,
        user: { id: profile.id, email: profile.email, phone: profile.phone }
      });
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
    await supabaseAdmin.rpc('update_login_stats', { p_id: profile.id });

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
      .select('id, user_id, balance, used_margin, available_margin, today_pnl, week_pnl, total_pnl, total_deposited, total_withdrawn, bonus_balance')
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
    const [notifResult, readResult] = await Promise.all([
      supabaseAdmin
        .from('system_notifications')
        .select('id, title, message, type, created_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50),
      // Fetch which notifications this user has already read (Bug #21)
      supabaseAdmin
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', req.user.id)
    ]);

    if (notifResult.error) {
      return res.status(500).json({ error: notifResult.error.message });
    }

    // Build a Set of read notification IDs for O(1) lookup
    const readIds = new Set(
      (readResult.data || []).map(r => r.notification_id)
    );

    const notifications = (notifResult.data || []).map(n => ({
      id: n.id,
      type: n.type === 'alert' ? 'alert' : n.type === 'trade' ? 'trade' : n.type === 'broadcast' ? 'broadcast' : 'system',
      message: n.message || n.title,
      title: n.title,
      time: formatTimeAgo(n.created_at),
      read: readIds.has(n.id),
    }));

    res.json({ notifications });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/auth/notifications/mark-read
 * Mark one or all notifications as read for the current user
 * Body: { notificationId: 'uuid' } or { all: true }
 */
router.post('/notifications/mark-read', authenticateUser, async (req, res) => {
  try {
    const { notificationId, all } = req.body;
    const userId = req.user.id;

    if (all) {
      // Mark all active notifications as read
      const { data: active } = await supabaseAdmin
        .from('system_notifications')
        .select('id')
        .eq('is_active', true);

      if (active && active.length > 0) {
        const inserts = active.map(n => ({ user_id: userId, notification_id: n.id }));
        await supabaseAdmin
          .from('notification_reads')
          .upsert(inserts, { onConflict: 'user_id,notification_id', ignoreDuplicates: true });
      }
    } else if (notificationId) {
      await supabaseAdmin
        .from('notification_reads')
        .upsert({ user_id: userId, notification_id: notificationId }, { onConflict: 'user_id,notification_id', ignoreDuplicates: true });
    } else {
      return res.status(400).json({ error: 'Provide notificationId or all:true' });
    }

    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Mark-read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
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

