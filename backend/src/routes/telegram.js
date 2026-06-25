const express = require('express');
const router = express.Router();
const { bot } = require('../core/telegram/bot');
const { setupRouter } = require('../core/telegram/router');

if (bot) {

  
  // Handle incoming webhook POST requests directly
  router.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res)
      .then(() => {
        if (!res.headersSent) res.sendStatus(200);
      })
      .catch(err => {
        console.error('[Telegram] Webhook error:', err);
        if (!res.headersSent) res.sendStatus(500);
      });
  });
}

module.exports = router;
