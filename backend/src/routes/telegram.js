const express = require('express');
const router = express.Router();
const { bot } = require('../core/telegram/bot');
const { setupRouter } = require('../core/telegram/router');

if (bot) {
  // Initialize all bot handlers
  setupRouter();
  
  // Telegraf has a built-in webhook callback mechanism
  // We can pass the express req/res directly to it.
  const webhookCallback = bot.webhookCallback('/api/telegram/webhook');

  // Handle incoming webhook POST requests from Telegram
  router.post('/webhook', (req, res) => {
    webhookCallback(req, res);
  });
}

module.exports = router;
