const { supabaseAdmin } = require('../../../config/supabase');
const { rephraseAsAgent, AGENT_NAME } = require('../aiEngine');

/**
 * Handles admin replies in the Telegram #support topic.
 *
 * Flow:
 *  1. Admin uses Telegram's "Reply" feature on a specific escalation alert message.
 *  2. We extract the session_id from the original message text.
 *  3. We fetch the last few messages from that session for context.
 *  4. We pass the admin's plain-text reply + context to Gemini's rephraseAsAgent().
 *  5. The polished response is inserted into chat_messages as sender_type: 'bot'
 *     so it appears in the UI as Riya's message.
 *  6. We emit a Socket.IO event so the customer sees it instantly.
 *  7. We confirm to admin on Telegram with ✅.
 */
const handleReply = async (ctx) => {
  const adminText = ctx.message.text;

  if (!ctx.message.reply_to_message) {
    return ctx.reply(
      `⚠️ Please use Telegram's "Reply" feature on the specific escalation message so I know which customer you're answering.`,
      { message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT) }
    );
  }

  const repliedText =
    ctx.message.reply_to_message.text ||
    ctx.message.reply_to_message.caption ||
    '';

  // Extract the session UUID from the message. Format: (session-uuid)
  const sessionMatch = repliedText.match(/\(([a-f0-9\-]{36})\)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  if (!sessionId) {
    return ctx.reply(
      '⚠️ Could not find a Session ID in the message you replied to. Make sure you reply to an escalation alert from Riya.',
      { message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT) }
    );
  }

  try {
    // ── 1. Verify the session is still open ────────────────────────────────
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, status, customer_id')
      .eq('id', sessionId)
      .single();

    if (!session || session.status === 'ended') {
      return ctx.reply(
        `⚠️ Session <code>${sessionId}</code> is already ended or not found. Reply not sent.`,
        {
          parse_mode: 'HTML',
          message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT),
          reply_to_message_id: ctx.message.message_id,
        }
      );
    }

    // ── 2. Fetch last 8 messages for rephrasing context ────────────────────
    const { data: history } = await supabaseAdmin
      .from('chat_messages')
      .select('sender_type, message')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(8);

    // Build a readable context string for the rephraser
    const customerContext = (history || [])
      .map(m => {
        if (m.sender_type === 'user')  return `Customer: ${m.message}`;
        if (m.sender_type === 'bot')   return `${AGENT_NAME}: ${m.message}`;
        if (m.sender_type === 'agent') return `Agent: ${m.message}`;
        return null;
      })
      .filter(Boolean)
      .join('\n');

    // ── 3. Rephrase via Gemini ─────────────────────────────────────────────
    const polishedReply = await rephraseAsAgent(adminText, customerContext);

    // ── 4. Insert into DB ──────────────────────────────────────────────────
    const { data: newMsg } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id:   sessionId,
        sender_type:  'bot',
        sender_id:    null,
        message:      polishedReply,
        message_type: 'text',
      })
      .select()
      .single();

    // ── 5. Emit via Socket.IO so user sees it instantly ────────────────────
    try {
      const { getIO } = require('../../../ws/socketServer');
      const io = getIO();
      io.of('/support').to(`session:${sessionId}`).emit('support:new_message', newMsg);
    } catch (ioErr) {
      // Socket.IO may not be available in some edge cases — DB insert is the fallback
      console.warn('[SupportReply] Socket.IO emit failed (non-fatal):', ioErr.message);
    }

    // ── 6. Mark session as no longer waiting for admin input ───────────────
    await supabaseAdmin
      .from('chat_sessions')
      .update({ ai_escalated: false })
      .eq('id', sessionId);

    // ── 7. Confirm to admin on Telegram ────────────────────────────────────
    await ctx.reply(
      `✅ <b>Sent to customer as ${AGENT_NAME}:</b>\n\n<i>${polishedReply}</i>`,
      {
        parse_mode: 'HTML',
        message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT),
        reply_to_message_id: ctx.message.message_id,
      }
    );
  } catch (err) {
    console.error('[SupportReply] Error handling admin reply:', err);
    ctx.reply('❌ Something went wrong sending the reply. Please try again.', {
      message_thread_id: parseInt(process.env.TELEGRAM_TOPIC_SUPPORT),
    });
  }
};

module.exports = { handleReply };
