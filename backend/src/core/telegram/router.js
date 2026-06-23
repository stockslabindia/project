const { bot } = require('./bot');

// Import Handlers (we will create these next)
const callbackHandler = require('./handlers/callbackHandler');
const commandHandler = require('./handlers/commandHandler');
const supportReplyHandler = require('./handlers/supportReplyHandler');
const broadcastHandler = require('./handlers/broadcastHandler');

const setupRouter = () => {
  if (!bot) return;

  console.log('[Telegram] Setting up router modules...');

  // 1. Setup Slash Commands
  commandHandler.setupCommands(bot);

  // 2. Setup Button Click Callbacks
  callbackHandler.setupCallbacks(bot);

  // 3. Setup General Text Routing (Support Replies, Broadcasts)
  bot.on('text', async (ctx) => {
    // Only process messages from our authorized Group
    if (ctx.chat.id.toString() !== process.env.TELEGRAM_GROUP_ID) return;

    const threadId = ctx.message.message_thread_id;
    if (!threadId) return;

    // Route based on the Topic ID
    if (threadId.toString() === process.env.TELEGRAM_TOPIC_SUPPORT) {
      await supportReplyHandler.handleReply(ctx);
    } 
    else if (threadId.toString() === process.env.TELEGRAM_TOPIC_BROADCASTS) {
      await broadcastHandler.handleBroadcast(ctx);
    }
  });

};

module.exports = { setupRouter };
