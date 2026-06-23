const { bot } = require('../bot');

const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const TOPIC_SUPPORT = process.env.TELEGRAM_TOPIC_SUPPORT;

const sendSupportMessage = async (session, user, messageText, isHighPriority = false) => {
  if (!bot || !GROUP_ID || !TOPIC_SUPPORT) return;

  try {
    const priorityFlag = isHighPriority ? '🚨 <b>HIGH PRIORITY</b>\n' : '';
    const text = `${priorityFlag}💬 <b>${user.full_name}</b> (<code>${session.id}</code>):\n\n${messageText}`;

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_SUPPORT)
    });
  } catch (err) {
    console.error('[Telegram] Failed to send support message:', err);
  }
};

module.exports = {
  sendSupportMessage
};
