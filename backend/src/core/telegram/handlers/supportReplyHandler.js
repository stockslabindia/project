const { supabaseAdmin } = require('../../../config/supabase');

const handleReply = async (ctx) => {
  // If we are here, we are guaranteed to be in the #support topic
  const text = ctx.message.text;

  // We need to figure out WHICH user to reply to. 
  // In a real scenario, the CEO will "Reply" to the specific message sent by the bot representing the user.
  // Telegram gives us ctx.message.reply_to_message
  
  if (!ctx.message.reply_to_message) {
    return ctx.reply('⚠️ Please use the Telegram "Reply" feature on a specific user\'s message so I know who you are answering.', {
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT)
    });
  }

  const repliedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
  
  // Extract Session ID from the bot's original message. 
  // We formatted it like: 💬 User Name (sessionId):
  const sessionMatch = repliedText ? repliedText.match(/\(([a-f0-9\-]{36})\):/) : null;
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  if (!sessionId) {
    return ctx.reply('⚠️ Could not extract Session ID from the message you replied to.', {
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT)
    });
  }

  try {
    // Inject the CEO's reply into the DB
    await supabaseAdmin.from('chat_messages').insert({
      session_id: sessionId,
      sender_type: 'agent',
      sender_id: null, // null represents CEO/System
      message: text,
      message_type: 'text'
    });

    // In a full integration, you would emit a Socket.io event here.
    // However, since the socket server listens to DB changes (or we can just emit it directly if we have the io instance).
    // For now, the DB insert is sufficient if the frontend polls or the socket server broadcasts on DB trigger.
    // Actually, let's just trigger a webhook to the local server or use Supabase real-time.
    // The TradeX app uses Supabase real-time for chat_messages, so the frontend will instantly see it!
    
    await ctx.reply('✅ Reply sent to user.', {
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT),
      reply_to_message_id: ctx.message.message_id
    });
  } catch (err) {
    console.error(err);
    ctx.reply('Error sending reply.');
  }
};

module.exports = { handleReply };
