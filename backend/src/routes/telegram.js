const express = require('express');
const router = express.Router();
const { bot } = require('../core/telegram/bot');
const { setupRouter } = require('../core/telegram/router');

// ── Telegram Webhook Secret-Token Verification ──────────────────────────────
// Telegram sends the X-Telegram-Bot-Api-Secret-Token header on every webhook
// request when the webhook was registered with a secret_token. We reject any
// request that is missing or has a wrong token, preventing spoofed updates.
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

function verifyTelegramSecret(req, res, next) {
  if (!TELEGRAM_WEBHOOK_SECRET) return next(); // secret not configured — skip (dev)
  const incoming = req.headers['x-telegram-bot-api-secret-token'];
  if (!incoming || incoming !== TELEGRAM_WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

if (bot) {
  // Handle incoming webhook POST requests directly
  router.post('/webhook', verifyTelegramSecret, (req, res) => {
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

