const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const { redisClient } = require('../redis/client');

const USER_CACHE_TTL = 60;  // 60 seconds
const ADMIN_CACHE_TTL = 60; // 60 seconds

/**
 * Middleware: Verify Supabase user JWT token
 * Uses Redis cache to avoid hitting Supabase on every request.
 */
async function authenticateUser(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authorization header/cookie' });
    }

    // ── Step 1: Verify token with Supabase (or cache) ──
    // We hash the last 16 chars of the token as a cache key to avoid storing full tokens
    const tokenKey = `auth:user:token:${token.slice(-16)}`;
    let userId = null;

    try {
      const cachedUserId = await redisClient.get(tokenKey);
      if (cachedUserId) {
        userId = cachedUserId;
      }
    } catch (e) { /* Redis down — fall through to Supabase */ }

    if (!userId) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      userId = user.id;

      // Cache token→userId mapping
      try { await redisClient.setex(tokenKey, USER_CACHE_TTL, userId); } catch (e) {}
    }

    // ── Step 2: Get profile (cached) ──
    const profileKey = `auth:user:profile:${userId}`;
    let profile = null;

    try {
      const cached = await redisClient.get(profileKey);
      if (cached) {
        profile = JSON.parse(cached);
      }
    } catch (e) { /* Redis down — fall through to Supabase */ }

    if (!profile) {
      const { supabasePublic } = require('../config/supabase');
      const { data: profiles } = await supabasePublic.rpc('get_profile_by_id', {
        p_id: userId
      });

      const dbProfile = profiles && profiles.length > 0 ? profiles[0] : null;

      if (!dbProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      profile = dbProfile;

      // Cache profile
      try { await redisClient.setex(profileKey, USER_CACHE_TTL, JSON.stringify(profile)); } catch (e) {}
    }

    if (profile.status !== 'active') {
      return res.status(403).json({ error: `Account is ${profile.status}` });
    }

    // Check client restrictions for login access block
    try {
      const { getClientRestrictions } = require('../core/risk/clientRestrictions');
      const restrictions = await getClientRestrictions(userId);
      if (restrictions && restrictions.login === false) {
        return res.status(403).json({ error: 'Your account access has been blocked. Contact support.' });
      }
    } catch (e) {
      console.warn('[AuthMiddleware] Client restrictions check error:', e.message);
    }

    req.user = { id: userId, email: profile.email, profile };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware: Verify admin JWT token
 * Uses Redis cache to avoid hitting Supabase on every request.
 */
async function authenticateAdmin(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authorization header/cookie' });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);

    // ── Check Redis cache first ──
    const cacheKey = `auth:admin:${decoded.id}`;
    let admin = null;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        admin = JSON.parse(cached);
      }
    } catch (e) { /* Redis down — fall through */ }

    if (!admin) {
      const { data: dbAdmin } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('id', decoded.id)
        .eq('is_active', true)
        .single();

      if (!dbAdmin) {
        return res.status(401).json({ error: 'Admin not found or inactive' });
      }
      admin = dbAdmin;

      // Cache admin profile
      try { await redisClient.setex(cacheKey, ADMIN_CACHE_TTL, JSON.stringify(admin)); } catch (e) {}
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware: Check admin role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware: Verify affiliate JWT token
 * Uses Redis cache to avoid database hits on every request.
 */
async function authenticateAffiliate(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.affiliate_token) {
      token = req.cookies.affiliate_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authorization header/cookie' });
    }

    const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET || process.env.JWT_SECRET);

    // ── Check Redis cache first ──
    const cacheKey = `auth:affiliate:${decoded.id}`;
    let affiliate = null;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        affiliate = JSON.parse(cached);
      }
    } catch (e) { /* Redis down — fall through */ }

    if (!affiliate) {
      const { data: dbAffiliate } = await supabaseAdmin
        .from('affiliate_accounts')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (!dbAffiliate) {
        return res.status(401).json({ error: 'Affiliate not found' });
      }
      affiliate = dbAffiliate;

      // Cache affiliate profile (60 seconds)
      try { await redisClient.setex(cacheKey, 60, JSON.stringify(affiliate)); } catch (e) {}
    }

    if (affiliate.status !== 'active') {
      return res.status(403).json({ error: `Affiliate account is ${affiliate.status}` });
    }

    req.affiliate = affiliate;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticateUser, authenticateAdmin, requireRole, authenticateAffiliate };

