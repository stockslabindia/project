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
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

    const { fyersFeed } = require('../services/fyersFeed');
    
    // Save token
    fyersFeed.accessToken = token;
    await fyersFeed._saveTokenToRedis(token);
    
    // Reconnect
    fyersFeed._cleanupSocket();
    fyersFeed._connectWebSocket();

    res.json({ success: true, message: 'Fyers token updated successfully. Connecting...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
