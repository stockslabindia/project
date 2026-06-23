const { supabaseAdmin } = require('../../../config/supabase');
const { approveDeposit, rejectDeposit, approveWithdrawal, rejectWithdrawal } = require('../../../services/transactionService');

const setupCallbacks = (bot) => {
  bot.action(/^(approve_deposit|reject_deposit)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1]; // approve_deposit or reject_deposit
      const depositId = ctx.match[2];

      // Prevent spam clicks
      await ctx.answerCbQuery();

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
        try {
          await approveDeposit(depositId, null, 'telegram_bot');
          await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error('[Telegram] Approve deposit error:', err);
          await ctx.answerCbQuery(err.message || 'Error approving deposit');
        }
      } else {
        try {
          await rejectDeposit(depositId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
          await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error('[Telegram] Reject deposit error:', err);
          await ctx.answerCbQuery(err.message || 'Error rejecting deposit');
        }
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('Error processing request.');
    }
  });

  bot.action(/^(approve_withdrawal|reject_withdrawal)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const withdrawalId = ctx.match[2];

      await ctx.answerCbQuery();

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
        try {
          await approveWithdrawal(withdrawalId, null, 'telegram_bot');
          await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error('[Telegram] Approve withdrawal error:', err);
          await ctx.answerCbQuery(err.message || 'Error approving withdrawal');
        }
      } else {
        try {
          await rejectWithdrawal(withdrawalId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
          await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error('[Telegram] Reject withdrawal error:', err);
          await ctx.answerCbQuery(err.message || 'Error rejecting withdrawal');
        }
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('Error processing request.');
    }
  });
};

module.exports = { setupCallbacks };
