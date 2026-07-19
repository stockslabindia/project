const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { sendKycAlert } = require('../core/telegram/alerts/identityAlerts');
// All user routes require authentication
router.use(authenticateUser);

/**
 * GET /api/users/profile
 */
router.get('/profile', async (req, res) => {
  res.json({ profile: req.user.profile });
});

/**
 * PUT /api/users/profile
 * Update user profile (limited fields)
 */
router.put('/profile', async (req, res) => {
  try {
    const allowedFields = ['full_name', 'phone', 'date_of_birth', 'gender', 'address_line1', 'address_city', 'address_state', 'address_pincode'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Invalidate Redis profile cache
    const { redisClient } = require('../redis/client');
    try {
      await redisClient.del(`auth:user:profile:${req.user.id}`);
    } catch (e) {
      console.warn('Failed to invalidate Redis cache:', e.message);
    }

    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * GET /api/users/watchlist
 * Retrieve user watchlists
 */
router.get('/watchlist', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_watchlists')
      .select('data')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    res.json({ watchlist: data ? data.data : { active: 'MW-1', lists: { 'MW-1': [], 'MW-2': [], 'MW-3': [], 'MW-4': [], 'MW-5': [] } } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

/**
 * PUT /api/users/watchlist
 * Update user watchlists
 */
router.put('/watchlist', async (req, res) => {
  try {
    const { watchlist } = req.body;
    if (!watchlist) return res.status(400).json({ error: 'Watchlist data is required' });

    const { data, error } = await supabaseAdmin
      .from('user_watchlists')
      .upsert({ user_id: req.user.id, data: watchlist, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ watchlist: data.data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

/**
 * POST /api/users/kyc
 * Submit KYC documents (Base64 file upload)
 */
router.post('/kyc', async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  try {
    const { document_type, document_number, front_image, back_image } = req.body;

    if (!document_type) {
      return res.status(400).json({ error: 'document_type is required' });
    }

    if (!['aadhaar', 'pan', 'driving_licence'].includes(document_type)) {
      return res.status(400).json({ error: 'Invalid document type. Allowed: aadhaar, pan, driving_licence' });
    }

    if (!front_image) {
      return res.status(400).json({ error: 'Front image is required' });
    }

    // Aadhar and Driving Licence require both front and back images
    if (['aadhaar', 'driving_licence'].includes(document_type) && !back_image) {
      return res.status(400).json({ error: 'Back image is required for this document type' });
    }

    // Check existing kyc status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('kyc_status')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    if (profile && profile.kyc_status === 'verified') {
      return res.status(400).json({ error: 'KYC is already verified' });
    }

    // Get any existing kyc document record for this user
    const { data: existingDoc } = await supabaseAdmin
      .from('kyc_documents')
      .select('id, status')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existingDoc && existingDoc.status === 'pending') {
      return res.status(400).json({ error: 'KYC verification is already pending approval' });
    }

    // Helper to save base64 to backend/uploads
    const saveImage = (base64Str, side) => {
      const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let ext = '.png';
      let buffer;
      
      if (matches && matches.length === 3) {
        const type = matches[1].toLowerCase();
        // Allow list of MIME types
        const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedMime.includes(type)) {
          throw new Error('Invalid file format. Only JPEG, PNG, WEBP, and PDF are allowed.');
        }
        
        buffer = Buffer.from(matches[2], 'base64');
        if (type.includes('jpeg') || type.includes('jpg')) ext = '.jpg';
        else if (type.includes('gif')) ext = '.gif';
        else if (type.includes('webp')) ext = '.webp';
        else if (type.includes('pdf')) ext = '.pdf';
      } else {
        // Assume raw base64 string
        buffer = Buffer.from(base64Str, 'base64');
      }

      const filename = `kyc_${req.user.id}_${document_type}_${side}_${Date.now()}${ext}`;
      const filePath = path.join(__dirname, '../../uploads', filename);
      
      fs.writeFileSync(filePath, buffer);
      return `/uploads/${filename}`;
    };

    // Make sure uploads folder exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const frontUrl = saveImage(front_image, 'front');
    let documentUrls = [frontUrl];

    if (['aadhaar', 'driving_licence'].includes(document_type) && back_image) {
      const backUrl = saveImage(back_image, 'back');
      documentUrls.push(backUrl);
    }

    const document_url = documentUrls.join(',');

    let docResult;
    if (existingDoc) {
      const { data, error } = await supabaseAdmin
        .from('kyc_documents')
        .update({
          document_type,
          document_url,
          document_number: document_number || null,
          status: 'pending',
          reject_reason: null,
          verified_by: null,
          verified_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id)
        .select()
        .single();
      if (error) throw error;
      docResult = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('kyc_documents')
        .insert({
          user_id: req.user.id,
          document_type,
          document_url,
          document_number: document_number || null,
          status: 'pending'
        })
        .select()
        .single();
      if (error) throw error;
      docResult = data;
    }

    // Update profiles kyc_status to pending
    const { error: updateProfileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        kyc_status: 'pending',
        kyc_rejected_reason: null
      })
      .eq('id', req.user.id);

    if (updateProfileErr) throw updateProfileErr;

    // Invalidate Redis profile cache
    const { redisClient } = require('../redis/client');
    try {
      await redisClient.del(`auth:user:profile:${req.user.id}`);
    } catch (e) {
      console.warn('Failed to invalidate Redis cache:', e.message);
    }

    // Telegram alert
    sendKycAlert({
      ...docResult, 
      document_front_url: req.protocol + '://' + req.get('host') + frontUrl,
      document_back_url: back_image ? req.protocol + '://' + req.get('host') + docResult.document_url.split(',')[1] : null
    }, req.user.profile);

    res.json({ message: 'KYC submitted successfully', document: docResult });
  } catch (err) {
    console.error('KYC submission error:', err);
    res.status(500).json({ error: 'KYC submission failed: ' + err.message });
  }
});

/**
 * GET /api/users/push-subscription/vapid-public-key
 * Fetch VAPID public key for subscribing
 */
router.get('/push-subscription/vapid-public-key', async (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({ error: 'Push notifications are not configured on this server.' });
    }
    res.json({ publicKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

/**
 * POST /api/users/push-subscription
 * Register a web push subscription for a user
 */
router.post('/push-subscription', async (req, res) => {
  try {
    const { endpoint, keys, expirationTime } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Endpoint and subscription keys (auth, p256dh) are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: req.user.id,
          endpoint,
          expiration_time: expirationTime || null,
          keys_p256dh: keys.p256dh,
          keys_auth: keys.auth,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id, endpoint' }
      )
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Subscription registered successfully', subscription: data });
  } catch (err) {
    console.error('Subscription error:', err);
    res.status(500).json({ error: 'Failed to register subscription' });
  }
});

/**
 * DELETE /api/users/push-subscription
 * Remove a push subscription for a user
 */
router.delete('/push-subscription', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required to remove subscription' });
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', req.user.id)
      .eq('endpoint', endpoint);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Subscription removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

module.exports = router;
