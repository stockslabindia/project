const { supabaseAdmin } = require('../../../config/supabase');

const setupCommands = (bot) => {
  // Only process commands in the #commands topic to keep things clean
  const TOPIC_COMMANDS = process.env.TELEGRAM_TOPIC_COMMANDS;
  const GROUP_ID = process.env.TELEGRAM_GROUP_ID;

  // Middleware to restrict commands to the commands topic
  const isCommandTopic = (ctx) => {
    return ctx.chat.id.toString() === GROUP_ID && 
           ctx.message?.message_thread_id?.toString() === TOPIC_COMMANDS;
  };

  bot.command('balance', async (ctx) => {
    if (!isCommandTopic(ctx)) return;

    const email = ctx.message.text.split(' ')[1];
    if (!email) {
      return ctx.reply('Usage: /balance [user_email]', { message_thread_id: parseInt(TOPIC_COMMANDS) });
    }

    try {
      // Find user
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, client_id')
        .eq('email', email)
        .single();

      if (!user) {
        return ctx.reply(`❌ User not found with email: ${email}`, { message_thread_id: parseInt(TOPIC_COMMANDS) });
      }

      // Find wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance, credit_limit')
        .eq('user_id', user.id)
        .single();

      const balance = wallet ? wallet.balance : 0;
      
      const text = `💰 <b>Balance for ${user.full_name}</b>\n\n` +
        `<b>ID:</b> <code>${user.client_id}</code>\n` +
        `<b>Wallet Balance:</b> ₹${balance}\n`;

      await ctx.reply(text, { parse_mode: 'HTML', message_thread_id: parseInt(TOPIC_COMMANDS) });
    } catch (err) {
      console.error(err);
      ctx.reply('Error fetching balance.');
    }
  });

  bot.command('ban', async (ctx) => {
    if (!isCommandTopic(ctx)) return;

    const parts = ctx.message.text.split(' ');
    const email = parts[1];
    const reason = parts.slice(2).join(' ') || 'Banned by CEO';

    if (!email) {
      return ctx.reply('Usage: /ban [user_email] [reason]', { message_thread_id: parseInt(TOPIC_COMMANDS) });
    }

    try {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (!user) {
        return ctx.reply(`❌ User not found with email: ${email}`, { message_thread_id: parseInt(TOPIC_COMMANDS) });
      }

      await supabaseAdmin
        .from('profiles')
        .update({ status: 'banned', admin_notes: reason })
        .eq('id', user.id);

      await ctx.reply(`🚫 <b>Banned</b> user ${email}.\nReason: ${reason}`, { parse_mode: 'HTML', message_thread_id: parseInt(TOPIC_COMMANDS) });
    } catch (err) {
      console.error(err);
      ctx.reply('Error banning user.');
    }
  });
};

module.exports = { setupCommands };
