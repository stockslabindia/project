const { bot } = require('../bot');

const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const TOPIC_REPORTS = process.env.TELEGRAM_TOPIC_DAILY_REPORTS;

const sendDailySummary = async (stats) => {
  if (!bot || !GROUP_ID || !TOPIC_REPORTS) return;

  try {
    const text = `📊 <b>Daily CEO Summary</b> 📊\n\n` +
      `<b>New Signups:</b> ${stats.newUsers}\n` +
      `<b>Total Deposits:</b> ₹${stats.totalDeposits}\n` +
      `<b>Total Withdrawals:</b> ₹${stats.totalWithdrawals}\n` +
      `<b>Active Support Tickets:</b> ${stats.openTickets}\n\n` +
      `<i>Have a great day!</i>`;

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_REPORTS)
    });
  } catch (err) {
    console.error('[Telegram] Failed to send daily summary:', err);
  }
};

module.exports = {
  sendDailySummary
};
