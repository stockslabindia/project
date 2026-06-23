const { bot } = require('../bot');

const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const TOPIC_RISK = process.env.TELEGRAM_TOPIC_RISK_ALERTS;

const sendWhaleAlert = async (type, amount, user) => {
  if (!bot || !GROUP_ID || !TOPIC_RISK) return;

  try {
    const text = `🐋 <b>WHALE ALERT</b> 🐋\n\n` +
      `<b>Action:</b> ${type}\n` +
      `<b>User:</b> ${user.full_name} (${user.email})\n` +
      `<b>Amount:</b> ₹${amount}\n\n` +
      `<i>Please monitor this account.</i>`;

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_RISK)
    });
  } catch (err) {
    console.error('[Telegram] Failed to send whale alert:', err);
  }
};

const sendMarginCallWarning = async (user, marginLevel, pnl) => {
  if (!bot || !GROUP_ID || !TOPIC_RISK) return;

  try {
    const text = `📉 <b>MARGIN WARNING</b> 📉\n\n` +
      `<b>User:</b> ${user.full_name}\n` +
      `<b>Margin Level:</b> ${marginLevel}%\n` +
      `<b>Current MTM:</b> ₹${pnl}\n\n` +
      `<i>Account is approaching liquidation.</i>`;

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_RISK)
    });
  } catch (err) {
    console.error('[Telegram] Failed to send margin warning:', err);
  }
};

const sendSystemHealthAlert = async (message) => {
  if (!bot || !GROUP_ID || !TOPIC_RISK) return;

  try {
    const text = `🚨 <b>SYSTEM ALERT</b> 🚨\n\n${message}`;

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_RISK)
    });
  } catch (err) {
    console.error('[Telegram] Failed to send system health alert:', err);
  }
};

module.exports = {
  sendWhaleAlert,
  sendMarginCallWarning,
  sendSystemHealthAlert
};
