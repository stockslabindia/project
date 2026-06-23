const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize bot if token exists, otherwise set to null to gracefully disable features
let bot = null;

if (BOT_TOKEN) {
  bot = new Telegraf(BOT_TOKEN);
  console.log('[Telegram] Bot initialized successfully.');
} else {
  console.warn('[Telegram] Warning: TELEGRAM_BOT_TOKEN is not set. Bot features are disabled.');
}

module.exports = { bot };
