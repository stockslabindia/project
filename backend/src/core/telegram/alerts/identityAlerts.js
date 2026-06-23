const { bot } = require('../bot');
const { Markup } = require('telegraf');

const GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const TOPIC_KYC = process.env.TELEGRAM_TOPIC_KYC;
const TOPIC_BANK_ACCOUNTS = process.env.TELEGRAM_TOPIC_BANK_ACCOUNTS;

const sendKycAlert = async (kycRecord, user) => {
  if (!bot || !GROUP_ID || !TOPIC_KYC) return;

  try {
    const text = `🆔 <b>New KYC Application</b>\n\n` +
      `<b>User:</b> ${user.full_name} (${user.email})\n` +
      `<b>Document Type:</b> ${kycRecord.document_type}\n` +
      `<b>Document ID:</b> <code>${kycRecord.document_number}</code>\n\n` +
      `<i>Please review the attached documents.</i>`;

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Approve', `approve_kyc_${kycRecord.id}`),
      Markup.button.callback('❌ Reject', `reject_kyc_${kycRecord.id}`)
    ]);

    // Send front image
    await bot.telegram.sendPhoto(GROUP_ID, kycRecord.document_front_url, {
      caption: text,
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_KYC),
      ...keyboard
    });

    // Send back image if available
    if (kycRecord.document_back_url) {
      await bot.telegram.sendPhoto(GROUP_ID, kycRecord.document_back_url, {
        caption: 'Back of document',
        message_thread_id: parseInt(TOPIC_KYC)
      });
    }
  } catch (err) {
    console.error('[Telegram] Failed to send KYC alert:', err);
  }
};

const sendBankAccountVerification = async (bank, user) => {
  if (!bot || !GROUP_ID || !TOPIC_BANK_ACCOUNTS) return;

  try {
    const text = `🏦 <b>New Bank Account Added</b>\n\n` +
      `<b>User Profile Name:</b> ${user.full_name}\n` +
      `<b>Bank Account Name:</b> ${bank.account_holder_name}\n\n` +
      `<b>Bank:</b> ${bank.bank_name}\n` +
      `<b>Account:</b> <code>${bank.account_number}</code>\n` +
      `<b>IFSC:</b> <code>${bank.ifsc_code}</code>\n\n` +
      `<i>Does the bank account name match the KYC name?</i>`;

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Approve Bank', `approve_bank_${bank.id}`),
      Markup.button.callback('❌ Reject Bank', `reject_bank_${bank.id}`)
    ]);

    await bot.telegram.sendMessage(GROUP_ID, text, {
      parse_mode: 'HTML',
      message_thread_id: parseInt(TOPIC_BANK_ACCOUNTS),
      ...keyboard
    });
  } catch (err) {
    console.error('[Telegram] Failed to send bank account alert:', err);
  }
};

module.exports = {
  sendKycAlert,
  sendBankAccountVerification
};
