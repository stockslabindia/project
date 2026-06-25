const { supabaseAdmin } = require('../../../config/supabase');
const { approveDeposit, rejectDeposit, approveWithdrawal, rejectWithdrawal } = require('../../../services/transactionService');
const { approveKyc, rejectKyc, rejectBank } = require('../../../services/identityService');

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
          if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
          } else {
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
          }
        } catch (err) {
          console.error('[Telegram] Approve deposit error:', err);
          await ctx.answerCbQuery(err.message || 'Error approving deposit');
        }
      } else {
        try {
          await rejectDeposit(depositId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
          if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
          } else {
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
          }
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
  bot.action(/^(approve_kyc|reject_kyc)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const kycId = ctx.match[2];
      await ctx.answerCbQuery();

      const { data: kyc, error } = await supabaseAdmin.from('kyc_documents').select('*').eq('id', kycId).in('status', ['pending']).single();
      if (error || !kyc) return ctx.reply('⚠️ KYC document not found or already processed.', { reply_to_message_id: ctx.callbackQuery.message.message_id });

      if (action === 'approve_kyc') {
        try {
          await approveKyc(kycId, null, 'telegram_bot');
          if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
          } else {
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
          }
        } catch (err) {
          console.error('[Telegram] Approve KYC error:', err);
          await ctx.answerCbQuery(err.message || 'Error approving KYC');
        }
      } else {
        try {
          await rejectKyc(kycId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
          if (ctx.callbackQuery.message.caption) {
            await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
          } else {
            await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
          }
        } catch (err) {
          console.error('[Telegram] Reject KYC error:', err);
          await ctx.answerCbQuery(err.message || 'Error rejecting KYC');
        }
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('Error processing request.');
    }
  });

  bot.action(/^(approve_bank|reject_bank)_(.+)$/, async (ctx) => {
    try {
      const action = ctx.match[1];
      const bankId = ctx.match[2];
      await ctx.answerCbQuery();

      const { data: bank, error } = await supabaseAdmin.from('user_bank_accounts').select('*').eq('id', bankId).single();
      if (error || !bank) return ctx.reply('⚠️ Bank account not found or already deleted.', { reply_to_message_id: ctx.callbackQuery.message.message_id });

      if (action === 'approve_bank') {
        try {
          // Bank accounts are immediately active, no DB change needed for approval.
          await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error('[Telegram] Approve bank error:', err);
          await ctx.answerCbQuery(err.message || 'Error approving bank');
        }
      } else {
        try {
          await rejectBank(bankId, null, 'Rejected by CEO via Telegram', 'telegram_bot');
          await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ <b>REJECTED & DELETED via Telegram</b>`, { parse_mode: 'HTML' });
        } catch (err) {
          console.error('[Telegram] Reject bank error:', err);
          await ctx.answerCbQuery(err.message || 'Error rejecting bank');
        }
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('Error processing request.');
    }
  });
};

module.exports = { setupCallbacks };
