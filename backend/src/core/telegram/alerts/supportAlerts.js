const { bot } = require('../bot');
const { AGENT_NAME } = require('../aiEngine');

const GROUP_ID      = process.env.TELEGRAM_GROUP_ID;
const TOPIC_SUPPORT = process.env.TELEGRAM_TOPIC_SUPPORT;

/**
 * Sends a standard support message notification to the Telegram #support topic.
 * Called on every user message for admin visibility.
 *
 * @param {{ id: string }} session
 * @param {{ full_name: string, email: string }} user
 * @param {string} messageText
 * @param {boolean} isHighPriority
 */
const sendSupportMessage = async (session, user, messageText, isHighPriority = false) => {
  if (!bot || !GROUP_ID || !TOPIC_SUPPORT) return;

  try {
    const priorityFlag = isHighPriority ? '🚨 <b>HIGH PRIORITY</b>\n' : '';
    const text = `${priorityFlag}💬 <b>${user.full_name}</b> (<code>${session.id}</code>):\n\n${messageText}`;

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_SUPPORT),
    });
  } catch (err) {
    console.error('[Telegram] Failed to send support message:', err);
  }
};

/**
 * Sends an escalation alert to Telegram when the AI agent (Riya) cannot answer
 * a customer query and needs admin input.
 *
 * The admin should REPLY (using Telegram's Reply feature) to this specific
 * message with their plain-text instructions. The bot will detect the reply,
 * rephrase it via Gemini, and send it to the customer as Riya.
 *
 * @param {string} sessionId
 * @param {{ full_name: string, email: string }} user
 * @param {string} customerQuery  - The latest message that triggered escalation
 * @param {Array<{sender_type: string, message: string}>} history  - Last few messages
 * @returns {Promise<number|null>} The Telegram message_id of the sent alert (for threading)
 */
const sendEscalationAlert = async (sessionId, user, customerQuery, history = []) => {
  if (!bot || !GROUP_ID || !TOPIC_SUPPORT) return null;

  try {
    // Build a readable conversation snippet (last 6 messages)
    const snippet = (history || [])
      .slice(-6)
      .map(m => {
        if (m.sender_type === 'user')  return `👤 <b>${user.full_name}:</b> ${m.message}`;
        if (m.sender_type === 'bot')   return `🤖 <b>${AGENT_NAME}:</b> ${m.message}`;
        if (m.sender_type === 'agent') return `👩‍💼 <b>Agent:</b> ${m.message}`;
        return null;
      })
      .filter(Boolean)
      .join('\n');

    const text =
      `🆘 <b>${AGENT_NAME} needs your help!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Customer:</b> ${user.full_name} (${user.email || 'no email'})\n` +
      `📋 <b>Session:</b> <code>${sessionId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Conversation:</b>\n${snippet}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📩 <b>Reply to THIS message</b> with your instructions in plain words.\n` +
      `${AGENT_NAME} will rephrase it professionally and send it to the customer.`;

    const sent = await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_SUPPORT),
    });

    return sent.message_id || null;
  } catch (err) {
    console.error('[Telegram] Failed to send escalation alert:', err);
    return null;
  }
};

module.exports = {
  sendSupportMessage,
  sendEscalationAlert,
};
