const { supabaseAdmin } = require('../../../config/supabase');

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
        // Approve logic
        await supabaseAdmin
          .from('deposit_requests')
          .update({ 
            status: 'approved', 
            approved_by: null, 
            approved_at: new Date().toISOString(), 
            credited_to_wallet: true 
          })
          .eq('id', depositId);
          
        // Note: Real system might trigger a wallet credit function here
        // If there's an existing service, it should be called. For now, DB update.

        await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
      } else {
        // Reject logic
        await supabaseAdmin
          .from('deposit_requests')
          .update({ 
            status: 'rejected', 
            reject_reason: 'Rejected by CEO via Telegram', 
            rejected_by: null, 
            rejected_at: new Date().toISOString() 
          })
          .eq('id', depositId);
          
        await ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
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
        await supabaseAdmin
          .from('withdrawal_requests')
          .update({ 
            status: 'approved', 
            approved_by: null, 
            approved_at: new Date().toISOString() 
          })
          .eq('id', withdrawalId);
          
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED via Telegram</b>`, { parse_mode: 'HTML' });
      } else {
        await supabaseAdmin
          .from('withdrawal_requests')
          .update({ 
            status: 'rejected', 
            reject_reason: 'Rejected by CEO via Telegram', 
            rejected_by: null, 
            rejected_at: new Date().toISOString() 
          })
          .eq('id', withdrawalId);
          
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ <b>REJECTED via Telegram</b>`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('Error processing request.');
    }
  });
};

module.exports = { setupCallbacks };
