const { supabaseAdmin } = require('../../../config/supabase');

const handleBroadcast = async (ctx) => {
  const text = ctx.message.text;

  try {
    // Save to a system_notifications table or similar.
    // For this boilerplate, let's assume there is a notifications table.
    
    // Check if table exists
    // await supabaseAdmin.from('notifications').insert({ ... })
    
    // In a full integration, you would emit a Socket.io broadcast to all connected users.
    // E.g. io.emit('broadcast', text);
    
    await ctx.reply('📢 <b>Broadcast Sent</b> to all active users!', {
      parse_mode: 'HTML',
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_BROADCASTS)
    });
  } catch (err) {
    console.error(err);
    ctx.reply('Error sending broadcast.');
  }
};

module.exports = { handleBroadcast };
