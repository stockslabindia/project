const { bot } = require('../bot');
const { Markup } = require('telegraf');

const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const TOPIC_DEPOSITS = process.env.TELEGRAM_TOPIC_DEPOSITS;
const TOPIC_WITHDRAWALS = process.env.TELEGRAM_TOPIC_WITHDRAWALS;

/**
 * Send an interactive deposit alert to Telegram
 */
const sendDepositAlert = async (deposit, user) => {
  if (!bot || !GROUP_ID || !TOPIC_DEPOSITS) return;

  try {
    const text = `💰 <b>New Deposit Request</b>\n\n` +
      `<b>User:</b> ${user.full_name} (${user.email})\n` +
      `<b>Amount:</b> ₹${deposit.amount}\n` +
      `<b>Method:</b> ${deposit.method}\n` +
      `<b>UTR:</b> <code>${deposit.utr_number}</code>\n\n` +
      `<b>Time:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Approve', `approve_deposit_${deposit.id}`),
      Markup.button.callback('❌ Reject', `reject_deposit_${deposit.id}`)
    ]);

    if (deposit.proof_url) {
      await bot.telegram.sendPhoto(GROUP_ID, deposit.proof_url, {
        caption: text,
        parse_mode: 'HTML',
        message_thread_id: parseInt(TOPIC_DEPOSITS),
        ...keyboard
      });
    } else {
      await bot.telegram.sendMessage(GROUP_ID, text, {
        parse_mode: 'HTML',
        message_thread_id: parseInt(TOPIC_DEPOSITS),
        ...keyboard
      });
    }
  } catch (err) {
    console.error('[Telegram] Failed to send deposit alert:', err);
  }
};

/**
 * Send an interactive withdrawal alert to Telegram
 */
const sendWithdrawalAlert = async (withdrawal, user, bank) => {
  if (!bot || !GROUP_ID || !TOPIC_WITHDRAWALS) return;

  try {
    const text = `🏦 <b>New Withdrawal Request</b>\n\n` +
      `<b>User:</b> ${user.full_name} (${user.email})\n` +
      `<b>Amount:</b> ₹${withdrawal.amount}\n` +
      `<b>Bank Info:</b>\n` +
      `Name: ${bank.account_holder_name}\n` +
      `Acc: <code>${bank.account_number}</code>\n` +
      `IFSC: <code>${bank.ifsc_code}</code>\n\n` +
      `<b>Time:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Approve', `approve_withdrawal_${withdrawal.id}`),
      Markup.button.callback('❌ Reject', `reject_withdrawal_${withdrawal.id}`)
    ]);

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_WITHDRAWALS),
      ...keyboard
    });
  } catch (err) {
    console.error('[Telegram] Failed to send withdrawal alert:', err);
  }
};

module.exports = {
  sendDepositAlert,
  sendWithdrawalAlert
};
