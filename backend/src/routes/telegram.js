const express = require('express');
const router = express.Router();
const { bot } = require('../core/telegram/bot');
const { setupRouter } = require('../core/telegram/router');

if (bot) {
  // Initialize all bot handlers
  setupRouter();
  
  // Telegraf has a built-in webhook callback mechanism
  // Pass no path so it doesn't try to match the Express-stripped req.url
  const webhookCallback = bot.webhookCallback();

  // Handle incoming webhook POST requests from Telegram
  router.post('/webhook', (req, res) => {
    webhookCallback(req, res);
  });
}

module.exports = router;
