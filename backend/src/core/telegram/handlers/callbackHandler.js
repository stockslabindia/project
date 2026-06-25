const { supabaseAdmin } = require('../../../config/supabase');
const { approveDeposit, rejectDeposit, approveWithdrawal, rejectWithdrawal } = require('../../../services/transactionService');
const { approveKyc, rejectKyc, rejectBank } = require('../../../services/identityService');

// Safe wrapper — Telegram throws 400 if query is >30s old or already answered
const safeAnswer = async (ctx, text) => {
  try { await ctx.answerCbQuery(text); } catch (_) {}
};

// Safe wrapper for editing message (caption vs text) and removing buttons
const safeEditMessage = async (ctx, suffix) => {
  try {
    const options = {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }
    };
    if (ctx.callbackQuery.message.caption) {
      await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n${suffix}`, options);
    } else {
      await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n${suffix}`, options);
    }
  } catch (e) {
    console.error('[Telegram] Edit message failed:', e.message);
  }
};

const setupCallbacks = (bot) => {
  // ── Deposit Approve/Reject ──
  bot.action(/^(approve_deposit|reject_deposit)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const depositId = ctx.match[2];

      await safeAnswer(ctx);

      const { data: deposit, error } = await supabaseAdmin
        .from('deposit_requests')
        .select('*')
        .eq('id', depositId)
        .eq('status', 'pending')
        .single();

      if (error || !deposit) {
        return ctx.reply('⚠️ Deposit request not found or already processed.', { reply_to_message_id: ctx.callbackQuery.message.message_id });
      }

      if (action === 'approve_deposit') {
        await approveDeposit(depositId, null, 'telegram_bot');
        await safeEditMessage(ctx, '✅ <b>APPROVED via Telegram</b>');
      } else {
        await rejectDeposit(depositId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
        await safeEditMessage(ctx, '❌ <b>REJECTED via Telegram</b>');
      }
    } catch (err) {
      console.error('[Telegram] Deposit callback error:', err);
      await safeAnswer(ctx, 'Error processing request.');
    }
  });

  // ── Withdrawal Approve/Reject ──
  bot.action(/^(approve_withdrawal|reject_withdrawal)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const withdrawalId = ctx.match[2];

      await safeAnswer(ctx);

      const { data: withdrawal, error } = await supabaseAdmin
        .from('withdrawal_requests')
        .select('*')
        .eq('id', withdrawalId)
        .in('status', ['pending', 'flagged'])
        .single();

      if (error || !withdrawal) {
        return ctx.reply('⚠️ Withdrawal request not found or already processed.', { reply_to_message_id: ctx.callbackQuery.message.message_id });
      }

      if (action === 'approve_withdrawal') {
        await approveWithdrawal(withdrawalId, null, 'telegram_bot');
        await safeEditMessage(ctx, '✅ <b>APPROVED via Telegram</b>');
      } else {
        await rejectWithdrawal(withdrawalId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
        await safeEditMessage(ctx, '❌ <b>REJECTED via Telegram</b>');
      }
    } catch (err) {
      console.error('[Telegram] Withdrawal callback error:', err);
      await safeAnswer(ctx, 'Error processing request.');
    }
  });

  // ── KYC Approve/Reject ──
  bot.action(/^(approve_kyc|reject_kyc)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const kycId = ctx.match[2];
      await safeAnswer(ctx);

      const { data: kyc, error } = await supabaseAdmin.from('kyc_documents').select('*').eq('id', kycId).in('status', ['pending']).single();
      if (error || !kyc) return ctx.reply('⚠️ KYC document not found or already processed.', { reply_to_message_id: ctx.callbackQuery.message.message_id });

      if (action === 'approve_kyc') {
        await approveKyc(kycId, null, 'telegram_bot');
        await safeEditMessage(ctx, '✅ <b>APPROVED via Telegram</b>');
      } else {
        await rejectKyc(kycId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
        await safeEditMessage(ctx, '❌ <b>REJECTED via Telegram</b>');
      }
    } catch (err) {
      console.error('[Telegram] KYC callback error:', err);
      await safeAnswer(ctx, 'Error processing request.');
    }
  });

  // ── Bank Account Approve/Reject ──
  bot.action(/^(approve_bank|reject_bank)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const bankId = ctx.match[2];
      await safeAnswer(ctx);

      const { data: bank, error } = await supabaseAdmin.from('user_bank_accounts').select('*').eq('id', bankId).single();
      if (error || !bank) return ctx.reply('⚠️ Bank account not found or already deleted.', { reply_to_message_id: ctx.callbackQuery.message.message_id });

      if (action === 'approve_bank') {
        await safeEditMessage(ctx, '✅ <b>APPROVED via Telegram</b>');
      } else {
        await rejectBank(bankId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
        await safeEditMessage(ctx, '❌ <b>REJECTED & DELETED via Telegram</b>');
      }
    } catch (err) {
      console.error('[Telegram] Bank callback error:', err);
      await safeAnswer(ctx, 'Error processing request.');
    }
  });
};

module.exports = { setupCallbacks };
