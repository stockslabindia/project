const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { getFeedStatus, setActiveIndianFeed } = require('../ws/priceEngine');

/**
 * @route   GET /api/admin/feed/status
 * @desc    Get the status of all feeds and the active Indian feed
 * @access  Admin
 */
router.get('/status', authenticateAdmin, (req, res) => {
  try {
    const status = getFeedStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/admin/feed/switch
 * @desc    Switch the active Indian feed (shoonya vs fyers)
 * @access  Admin
 */
router.post('/switch', authenticateAdmin, (req, res) => {
  try {
    const { provider } = req.body; // 'shoonya' or 'fyers'
    
    if (!provider || (provider !== 'shoonya' && provider !== 'fyers')) {
      return res.status(400).json({ success: false, error: 'Invalid provider. Must be shoonya or fyers.' });
    }

    const success = setActiveIndianFeed(provider);
    
    if (success) {
      res.json({ success: true, activeIndianFeed: provider, message: `Switched active Indian feed to ${provider}` });
    } else {
      res.status(500).json({ success: false, error: 'Failed to switch feed.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/admin/feed/fyers-token
 * @desc    Set manual Fyers token and restart connection
 * @access  Admin
 */
router.post('/fyers-token', authenticateAdmin, async (req, res) => {
  try {
    let { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

    token = token.trim();
    const { fyersFeed } = require('../services/fyersFeed');
    const crypto = require('crypto');
    const axios = require('axios');

    // If user pasted the auth_code (Step 4), automatically exchange it for final access_token
    if (token.includes('auth_code')) {
      const appId = process.env.FYERS_APP_ID || 'CFUGNWN99L-100';
      const secretKey = process.env.FYERS_SECRET_KEY || 'F08YH54MHB';
      const redirectUri = process.env.FYERS_REDIRECT_URL || 'http://127.0.0.1';
      const appIdHash = crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');

      const exchangeRes = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', {
        grant_type: 'authorization_code',
        appIdHash,
        code: token,
        redirect_uri: redirectUri
      }, { timeout: 10000 });

      if (exchangeRes.data?.access_token) {
        token = exchangeRes.data.access_token;
      } else {
        return res.status(400).json({ success: false, error: `Auth code exchange failed: ${JSON.stringify(exchangeRes.data)}` });
      }
    }
    
    // Save token
    fyersFeed.accessToken = token;
    await fyersFeed._saveTokenToRedis(token);
    
    // Reconnect
    fyersFeed._cleanupSocket();
    fyersFeed._connectWebSocket();

    res.json({ success: true, message: 'Fyers token updated & WebSocket connected successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
