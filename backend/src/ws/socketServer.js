const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('../redis/client');
const { supabaseAdmin } = require('../config/supabase');
const { initNativeWsServer } = require('./nativeWsServer');
const jwt = require('jsonwebtoken');
const { sendSupportMessage } = require('../core/telegram/alerts/supportAlerts');
const { analyzeSentiment, generateAgentResponse, AGENT_NAME } = require('../core/telegram/aiEngine');
const { sendEscalationAlert } = require('../core/telegram/alerts/supportAlerts');

let io;

function initSocketServer(httpServer) {
  // Initialize Native WebSocket server alongside Socket.IO
  initNativeWsServer(httpServer);

  // Initialize Socket.IO with strict connection settings
  io = new Server(httpServer, {
    destroyUpgrade: false,
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        process.env.ADMIN_URL || 'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'https://stockslab-app.onrender.com',
        'https://stockslab.onrender.com',
        'https://stockslab-admin.onrender.com',
        'https://web.stockslab.live',
        'https://backoffice.stockslab.live',
        'https://stockslab.live',
        'https://earnwith.stockslab.live',
      ].filter(Boolean),
      credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 5000 // Drop inactive connections quickly to prevent memory leaks
  });

  // Attach Redis adapter for horizontal scaling across multiple instances
  try {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Server initialized with Redis Adapter');
  } catch (err) {
    console.warn('⚠️ Redis adapter failed — Socket.IO running in single-instance mode:', err.message);
  }

  // ── MARKET NAMESPACE ──
  // Dedicated to public, stateless price ticks (no authentication needed here)
  const marketNamespace = io.of('/market');
  marketNamespace.on('connection', (socket) => {
    
    // Client requests to join specific instrument rooms
    socket.on('MARKET:SUBSCRIBE_TICKERS', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          socket.join(`feed:${symbol}`);
        });
      }
    });

    // Client requests to leave rooms (e.g. removed from watchlist)
    socket.on('MARKET:UNSUBSCRIBE_TICKERS', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          socket.leave(`feed:${symbol}`);
        });
      }
    });

    socket.on('disconnect', () => {
      // Socket.IO automatically removes the socket from all rooms on disconnect
    });
  });

  // ── USER NAMESPACE ──
  // Dedicated to private user data (PNL, orders, margin). Requires Auth.
  const userNamespace = io.of('/user');
  
  userNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error: Missing token'));

      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return next(new Error('Authentication error: Invalid token'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Server error'));
    }
  });

  userNamespace.on('connection', (socket) => {
    // Automatically join the authenticated user to their private room
    if (socket.user && socket.user.id) {
      socket.join(`user:${socket.user.id}`);
    }

    // Legacy handler: Validate room ownership by ignoring the requested userId
    // and enforcing the authenticated user's id
    socket.on('USER:JOIN_PRIVATE', (userId) => {
      if (socket.user && socket.user.id) {
        socket.join(`user:${socket.user.id}`);
      }
    });
  });

  // ── ADMIN NAMESPACE ──
  // Dedicated to admin panels (real-time ticks and order flow)
  const adminNamespace = io.of('/admin');
  const jwt = require('jsonwebtoken');

  adminNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error: Missing token'));

      // Admins are authenticated via custom JWT, not Supabase auth tokens
      const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret);
      if (!decoded || !decoded.id) return next(new Error('Authentication error: Invalid token'));

      socket.admin = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Server error'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    // Admin client requests to join specific instrument rooms for LiveMarket/DealingDesk
    socket.on('ADMIN:SUBSCRIBE_TICKERS', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          socket.join(`admin:feed:${symbol}`);
        });
      }
    });

    socket.on('ADMIN:UNSUBSCRIBE_TICKERS', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          socket.leave(`admin:feed:${symbol}`);
        });
      }
    });
  });

  // ── SUPPORT NAMESPACE ──────────────────────────────────────────────────────
  // Handles real-time customer support chat between users and agents.
  // Users authenticate with Supabase token; agents with custom admin JWT.
  const supportNamespace = io.of('/support');

  // ── Sequential Chat Router ─────────────────────────────────────────────────
  // Tracks which agent is currently being offered each incoming session.
  // { session_id => { agentQueue: [], currentIndex: int, timer: Timeout } }
  const routingState = new Map();

  async function getOnlineAgents() {
    // Return list of agent socket objects in agents_online room
    const sockets = await supportNamespace.in('agents_online').fetchSockets();
    return sockets.filter(s => s.isAgent);
  }

  /**
   * Start sequential routing for a session.
   * Sends incoming_chat offer to one agent at a time (10-15 sec window).
   */
  async function startSequentialRouting(sessionId, chatPayload) {
    // If already routing this session, clear old state
    if (routingState.has(sessionId)) {
      clearTimeout(routingState.get(sessionId).timer);
      routingState.delete(sessionId);
    }

    const agents = await getOnlineAgents();
    if (agents.length === 0) {
      // No agents online — broadcast to all (fallback)
      supportNamespace.to('agents_online').emit('support:incoming_chat', chatPayload);
      return;
    }

    // Filter agents below 5-chat limit
    const availableAgents = agents.filter(a => {
      const count = a._chatCount || 0;
      return count < 5;
    });

    if (availableAgents.length === 0) {
      // All agents are at max capacity — still broadcast so they can see it's queued
      supportNamespace.to('agents_online').emit('support:incoming_chat', { ...chatPayload, queued: true });
      return;
    }

    const state = { agentQueue: availableAgents, currentIndex: 0, timer: null, payload: chatPayload };
    routingState.set(sessionId, state);

    offerToNextAgent(sessionId);
  }

  function offerToNextAgent(sessionId) {
    const state = routingState.get(sessionId);
    if (!state) return;

    if (state.currentIndex >= state.agentQueue.length) {
      // Exhausted all agents — start over (re-fetch online agents) or broadcast
      console.log(`[Support] All agents offered session ${sessionId} — broadcasting to all`);
      supportNamespace.to('agents_online').emit('support:incoming_chat', state.payload);
      routingState.delete(sessionId);
      return;
    }

    const targetSocket = state.agentQueue[state.currentIndex];
    state.currentIndex++;

    // Offer to this agent only
    targetSocket.emit('support:incoming_chat', { ...state.payload, routed: true });
    console.log(`[Support] Offering session ${sessionId} to agent ${targetSocket.agentName}`);

    // Set 12-second window before moving to next agent
    state.timer = setTimeout(async () => {
      try {
        // Check if session was already accepted (no longer 'waiting')
        const { data } = await supabaseAdmin
          .from('chat_sessions')
          .select('status')
          .eq('id', sessionId)
          .single();

        if (!data || data.status !== 'waiting') {
          routingState.delete(sessionId);
          return;
        }
        // Tell this agent the offer expired
        targetSocket.emit('support:chat_offer_expired', { session_id: sessionId });
        // Move to next agent
        offerToNextAgent(sessionId);
      } catch (err) {
        routingState.delete(sessionId);
      }
    }, 12000); // 12 seconds

    routingState.set(sessionId, state);
  }

  /**
   * Auto-join Riya (Gemini AI) as the support agent for a session.
   * Called ~4 seconds after support:request_agent if no real human has accepted.
   * Sets session status to 'active' with agent_id = null (AI marker).
   * Sends an opening greeting based on the session topic.
   */
  async function scheduleRiyaAutoJoin(sessionId, userId, topic, namespace) {
    const RIYA_JOIN_DELAY_MS = 4000; // 4 seconds — gives real agents a chance first

    setTimeout(async () => {
      try {
        // Check if a real agent already accepted
        const { data: sess } = await supabaseAdmin
          .from('chat_sessions')
          .select('status')
          .eq('id', sessionId)
          .single();

        if (!sess || sess.status !== 'waiting') {
          console.log(`[Support] Riya auto-join skipped — session ${sessionId} already handled`);
          return;
        }

        const joinedAt = new Date().toISOString();

        // Atomically claim the session as AI (agent_id stays null)
        const { data: updated } = await supabaseAdmin
          .from('chat_sessions')
          .update({
            status: 'active',
            agent_joined_at: joinedAt,
            // agent_id intentionally left null — signals AI is the agent
          })
          .eq('id', sessionId)
          .eq('status', 'waiting') // guard against race with real agent
          .select()
          .single();

        if (!updated) {
          console.log(`[Support] Riya auto-join lost race for session ${sessionId}`);
          return;
        }

        // Stop sequential routing for this session
        if (routingState.has(sessionId)) {
          clearTimeout(routingState.get(sessionId).timer);
          routingState.delete(sessionId);
        }

        // Insert system message
        await supabaseAdmin.from('chat_messages').insert({
          session_id:   sessionId,
          sender_type:  'system',
          message:      `${AGENT_NAME} has joined the chat.`,
          message_type: 'system',
        });

        // Notify the user — triggers session_started in SupportChat.jsx
        namespace.to(`session:${sessionId}`).emit('support:session_started', {
          session_id:      sessionId,
          agent_id:        null,           // null signals AI agent to frontend
          agent_name:      AGENT_NAME,
          agent_joined_at: joinedAt,
          is_ai_agent:     true,
        });

        // Tell all real agents this chat is now taken
        namespace.to('agents_online').emit('support:chat_taken', { session_id: sessionId });

        console.log(`[Support] ${AGENT_NAME} (AI) auto-joined session ${sessionId}`);

        // Send Riya's opening greeting after a short natural delay
        setTimeout(async () => {
          try {
            const topicStr = topic || 'General Inquiry';
            const greeting = `Hi! 👋 I'm ${AGENT_NAME} from StocksLab Support. I can see you have a query about "${topicStr}". Could you please describe your issue in detail so I can assist you right away?`;

            const { data: greetMsg } = await supabaseAdmin
              .from('chat_messages')
              .insert({
                session_id:   sessionId,
                sender_type:  'bot',
                message:      greeting,
                message_type: 'text',
              })
              .select()
              .single();

            if (greetMsg) {
              namespace.to(`session:${sessionId}`).emit('support:new_message', greetMsg);
            }
          } catch (greetErr) {
            console.error('[Support] Riya greeting error:', greetErr);
          }
        }, 1200);

      } catch (err) {
        console.error('[Support] scheduleRiyaAutoJoin error:', err);
      }
    }, RIYA_JOIN_DELAY_MS);
  }

  supportNamespace.on('connection', async (socket) => {
    const token = socket.handshake.auth?.token;
    const role  = socket.handshake.auth?.role; // 'user' or 'agent'

    if (!token) { socket.disconnect(true); return; }

    try {
      if (role === 'agent') {
        // ── Agent connection ──
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
        if (!decoded?.id) { socket.disconnect(true); return; }
        socket.agentId   = decoded.id;
        socket.agentName = decoded.name || 'Agent';
        socket.agentRole = decoded.role;
        socket.isAgent   = true;

        // Check if agent is marked online in DB
        const { data: avail } = await supabaseAdmin
          .from('agent_availability')
          .select('is_online')
          .eq('agent_id', decoded.id)
          .single();

        if (avail?.is_online) {
          socket.join('agents_online');
          console.log(`[Support] Agent ${decoded.name} (${decoded.id}) connected & online`);
        } else {
          console.log(`[Support] Agent ${decoded.name} connected but is OFFLINE`);
        }

        // ── Agent: accept an incoming chat ──
        socket.on('support:accept_chat', async ({ session_id }) => {
          try {
            // Check agent's current active chat count (max 5)
            const { count } = await supabaseAdmin
              .from('chat_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('agent_id', socket.agentId)
              .eq('status', 'active');

            if (count >= 5) {
              socket.emit('support:error', { message: 'Maximum 5 simultaneous chats reached.' });
              return;
            }

            // Atomically claim the session — only one agent wins
            const { data: updated, error } = await supabaseAdmin
              .from('chat_sessions')
              .update({
                agent_id:       socket.agentId,
                status:         'active',
                agent_joined_at: new Date().toISOString(),
              })
              .eq('id', session_id)
              .eq('status', 'waiting') // guard: only claim if still waiting
              .select('id, customer_id')
              .single();

            if (error || !updated) {
              socket.emit('support:error', { message: 'Chat already taken by another agent.' });
              return;
            }

            // Join the session room
            socket.join(`session:${session_id}`);

            // Save system message
            await supabaseAdmin.from('chat_messages').insert({
              session_id,
              sender_type:  'system',
              message:      `${socket.agentName} has joined the chat.`,
              message_type: 'system',
            });

            // Notify the user in this session
            supportNamespace.to(`session:${session_id}`).emit('support:session_started', {
              session_id,
              agent_id: socket.agentId,
              agent_name: socket.agentName,
              agent_joined_at: new Date().toISOString(),
            });

            // Tell all other agents this chat is taken (remove it from their incoming list)
            supportNamespace.to('agents_online').emit('support:chat_taken', { session_id });

            // Stop sequential routing for this session
            if (routingState.has(session_id)) {
              clearTimeout(routingState.get(session_id).timer);
              routingState.delete(session_id);
            }

            // Update agent's in-memory chat count for routing
            socket._chatCount = (socket._chatCount || 0) + 1;

            // Confirm to accepting agent
            socket.emit('support:chat_accepted', {
              session_id,
              customer_id: updated.customer_id,
            });

            console.log(`[Support] Agent ${socket.agentName} accepted session ${session_id}`);
          } catch (err) {
            console.error('[Support] accept_chat error:', err);
            socket.emit('support:error', { message: 'Failed to accept chat.' });
          }
        });

        // ── Agent: join an existing active session room (reconnect) ──
        socket.on('support:join_session', ({ session_id }) => {
          socket.join(`session:${session_id}`);
        });

        // ── Agent: send a message ──
        socket.on('support:agent_message', async ({ session_id, message, message_type }) => {
          try {
            const type = ['text', 'image', 'document'].includes(message_type) ? message_type : 'text';
            const content = type === 'text' ? message?.trim() : message;
            if (!content) return;
            const { data: msg } = await supabaseAdmin
              .from('chat_messages')
              .insert({
                session_id,
                sender_type:  'agent',
                sender_id:    socket.agentId,
                message:      content,
                message_type: type,
              })
              .select()
              .single();

            supportNamespace.to(`session:${session_id}`).emit('support:new_message', {
              ...msg,
              agent_name: socket.agentName,
            });
          } catch (err) {
            console.error('[Support] agent_message error:', err);
          }
        });

        // ── Agent: end the chat ──
        socket.on('support:agent_end_chat', async ({ session_id }) => {
          try {
            const { data: session } = await supabaseAdmin
              .from('chat_sessions')
              .select('agent_joined_at, customer_id')
              .eq('id', session_id)
              .single();

            const endedAt = new Date();
            const durationSecs = session?.agent_joined_at
              ? Math.round((endedAt - new Date(session.agent_joined_at)) / 1000)
              : null;

            await supabaseAdmin.from('chat_sessions').update({
              status:                  'ended',
              ended_at:               endedAt.toISOString(),
              ended_by:               'agent',
              session_duration_seconds: durationSecs,
            }).eq('id', session_id);

            await supabaseAdmin.from('chat_messages').insert({
              session_id,
              sender_type:  'system',
              message:      'Agent has ended the chat.',
              message_type: 'system',
            });

            // Get customer email to pass back for email prompt
            let customerEmail = null;
            if (session?.customer_id) {
              const { data: profile } = await supabaseAdmin
                .from('profiles').select('email').eq('id', session.customer_id).single();
              customerEmail = profile?.email || null;
            }

            supportNamespace.to(`session:${session_id}`).emit('support:session_ended', {
              session_id,
              ended_by: 'agent',
              customer_email: customerEmail,
            });

            socket.leave(`session:${session_id}`);
            // Decrement in-memory chat count
            socket._chatCount = Math.max(0, (socket._chatCount || 1) - 1);
            console.log(`[Support] Session ${session_id} ended by agent`);
          } catch (err) {
            console.error('[Support] agent_end_chat error:', err);
          }
        });

        // ── Agent: accept transferred chat ──
        socket.on('support:accept_transfer', async ({ session_id }) => {
          try {
            // Join the room
            socket.join(`session:${session_id}`);
            socket._chatCount = (socket._chatCount || 0) + 1;

            // Update agent_joined_at to now (reset timer)
            await supabaseAdmin.from('chat_sessions').update({
              agent_joined_at: new Date().toISOString(),
            }).eq('id', session_id);

            socket.emit('support:transfer_accepted', { session_id });
            console.log(`[Support] Agent ${socket.agentName} accepted transfer for session ${session_id}`);
          } catch (err) {
            console.error('[Support] accept_transfer error:', err);
          }
        });

        socket.on('disconnect', () => {
          console.log(`[Support] Agent ${socket.agentName} disconnected`);
          // Clean up in-memory state
          socket._chatCount = 0;
        });

      } else {
        // ── User connection ──
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) { socket.disconnect(true); return; }
        socket.userId = user.id;
        socket.isAgent = false;

        // ── User: join their session room ──
        socket.on('support:join_session', ({ session_id }) => {
          socket.join(`session:${session_id}`);
          console.log(`[Support] User ${user.id} joined session:${session_id}`);
        });

        // ── User: request a live agent ──
        // This is called after the REST endpoint creates the session.
        // Uses sequential routing to offer to agents one at a time.
        socket.on('support:request_agent', async ({ session_id, user_name, topic }) => {
          // Join the session room
          socket.join(`session:${session_id}`);

          const chatPayload = {
            session_id,
            user_name: user_name || 'Customer',
            user_id:   socket.userId,
            topic:     topic || 'General',
            waiting_since: new Date().toISOString(),
          };

          // Offer to real human agents first (sequential routing)
          await startSequentialRouting(session_id, chatPayload);

          // Schedule Riya to auto-join if no real agent accepts within 4 seconds
          scheduleRiyaAutoJoin(session_id, socket.userId, topic, supportNamespace);

          console.log(`[Support] Agent routing + Riya fallback scheduled for session ${session_id}`);
        });

        // ── User: send a message ──
        socket.on('support:user_message', async ({ session_id, message, message_type }) => {
          try {
            const type = ['text', 'image', 'document'].includes(message_type) ? message_type : 'text';
            const content = type === 'text' ? message?.trim() : message;
            if (!content) return;
            const { data: msg } = await supabaseAdmin
              .from('chat_messages')
              .insert({
                session_id,
                sender_type:  'user',
                sender_id:    socket.userId,
                message:      content,
                message_type: type,
              })
              .select()
              .single();

            supportNamespace.to(`session:${session_id}`).emit('support:new_message', msg);

            // Fetch session status — include agent_id and ai_escalated for AI hooks
            const { data: session } = await supabaseAdmin
              .from('chat_sessions')
              .select('status, topic, agent_id, ai_escalated')
              .eq('id', session_id)
              .single();

            // ── Telegram Hook ──
            // Fetch user profile for Telegram alert
            const { data: userProfile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('id', socket.userId)
              .single();

            if (userProfile && type === 'text') {
              // Fire & forget sentiment analysis
              analyzeSentiment(content).then(isHighPriority => {
                sendSupportMessage({ id: session_id }, userProfile, content, isHighPriority);
                // Proactively route session to agents if user is angry and session is still waiting
                if (isHighPriority && session && session.status === 'waiting') {
                  console.log(`[Support] Proactively routing angry user session ${session_id} to agents.`);
                  startSequentialRouting(session_id, {
                    session_id,
                    user_name: userProfile.full_name || 'Customer',
                    user_id: socket.userId,
                    topic: session.topic || 'General Inquiry',
                    waiting_since: new Date().toISOString(),
                  });
                }
              }).catch(err => console.error('Sentiment analysis failed:', err));
            }

            // ── Riya Active-Session Hook ──────────────────────────────────────
            // Fires when session is 'active' AND agent_id IS NULL — meaning Riya
            // (not a human) is the active agent. She responds to every user message.
            if (session && session.status === 'active' && session.agent_id === null && type === 'text') {
              (async () => {
                try {
                  const { data: history } = await supabaseAdmin
                    .from('chat_messages')
                    .select('sender_type, message')
                    .eq('session_id', session_id)
                    .order('created_at', { ascending: true })
                    .limit(15);

                  const { reply, shouldEscalate } = await generateAgentResponse(history, content);

                  const { data: botMsg } = await supabaseAdmin
                    .from('chat_messages')
                    .insert({
                      session_id,
                      sender_type:  'bot',
                      message:      reply,
                      message_type: 'text',
                    })
                    .select()
                    .single();

                  if (botMsg) {
                    supportNamespace.to(`session:${session_id}`).emit('support:new_message', botMsg);
                  }

                  // Escalate to admin once per session if Riya is stuck
                  if (shouldEscalate && !session.ai_escalated) {
                    const { data: userProfileForEsc } = await supabaseAdmin
                      .from('profiles')
                      .select('full_name, email')
                      .eq('id', socket.userId)
                      .single();

                    const telegramMsgId = await sendEscalationAlert(
                      session_id,
                      userProfileForEsc || { full_name: 'Customer', email: '' },
                      content,
                      history || []
                    );

                    await supabaseAdmin
                      .from('chat_sessions')
                      .update({ ai_escalated: true, escalation_telegram_msg_id: telegramMsgId })
                      .eq('id', session_id);

                    console.log(`[Support] Session ${session_id} escalated to Telegram (msg_id: ${telegramMsgId})`);
                  }
                } catch (aiErr) {
                  console.error('[Support] Riya active-session response error:', aiErr);
                }
              })();
            }

            // ── Riya Waiting-State Hook (fallback for direct-type sessions) ────────
            // Fires when session is still 'waiting' and user typed directly
            // (e.g. bot view without going through menu).
            if (session && session.status === 'waiting') {
              (async () => {
                try {
                  // Fetch last 10 messages for context
                  const { data: history } = await supabaseAdmin
                    .from('chat_messages')
                    .select('sender_type, message')
                    .eq('session_id', session_id)
                    .order('created_at', { ascending: true })
                    .limit(10);

                  const userMsgText = type === 'text' ? content : `[Customer sent a ${type}]`;
                  const { reply, shouldEscalate } = await generateAgentResponse(history, userMsgText);

                  // Double-check session is still waiting before responding
                  const { data: currentSession } = await supabaseAdmin
                    .from('chat_sessions')
                    .select('status, ai_escalated')
                    .eq('id', session_id)
                    .single();

                  if (!currentSession || currentSession.status !== 'waiting') return;

                  // ── Insert Riya's reply ──────────────────────────────────────
                  const { data: botMsg } = await supabaseAdmin
                    .from('chat_messages')
                    .insert({
                      session_id,
                      sender_type:  'bot',
                      message:      reply,
                      message_type: 'text',
                    })
                    .select()
                    .single();

                  supportNamespace.to(`session:${session_id}`).emit('support:new_message', botMsg);

                  // ── Escalation flow ──────────────────────────────────────────
                  // Only escalate once per session (don't spam admin with every message)
                  if (shouldEscalate && !currentSession.ai_escalated) {
                    // Fetch user profile for escalation alert
                    const { data: userProfile } = await supabaseAdmin
                      .from('profiles')
                      .select('full_name, email')
                      .eq('id', socket.userId)
                      .single();

                    const telegramMsgId = await sendEscalationAlert(
                      session_id,
                      userProfile || { full_name: 'Customer', email: '' },
                      userMsgText,
                      history || []
                    );

                    // Flag session as escalated so we don't re-escalate every message
                    await supabaseAdmin
                      .from('chat_sessions')
                      .update({
                        ai_escalated:               true,
                        escalation_telegram_msg_id: telegramMsgId,
                      })
                      .eq('id', session_id);

                    console.log(`[Support] Session ${session_id} escalated to admin via Telegram (msg_id: ${telegramMsgId})`);
                  }
                } catch (aiErr) {
                  console.error('[Support] AI agent (Riya) response failed:', aiErr);
                }
              })();
            }

          } catch (err) {
            console.error('[Support] user_message error:', err);
          }
        });

        // ── User: end the chat ──
        socket.on('support:user_end_chat', async ({ session_id }) => {
          try {
            const { data: session } = await supabaseAdmin
              .from('chat_sessions')
              .select('agent_joined_at')
              .eq('id', session_id)
              .single();

            const endedAt = new Date();
            const durationSecs = session?.agent_joined_at
              ? Math.round((endedAt - new Date(session.agent_joined_at)) / 1000)
              : null;

            await supabaseAdmin.from('chat_sessions').update({
              status:                   'ended',
              ended_at:                endedAt.toISOString(),
              ended_by:                'user',
              session_duration_seconds: durationSecs,
            }).eq('id', session_id);

            await supabaseAdmin.from('chat_messages').insert({
              session_id,
              sender_type:  'system',
              message:      'Customer has ended the chat.',
              message_type: 'system',
            });

            supportNamespace.to(`session:${session_id}`).emit('support:session_ended', {
              session_id,
              ended_by: 'user',
            });

            socket.leave(`session:${session_id}`);
          } catch (err) {
            console.error('[Support] user_end_chat error:', err);
          }
        });

        socket.on('disconnect', () => {
          // User disconnected — session stays active until End Chat clicked
        });
      }
    } catch (err) {
      console.error('[Support] Socket auth error:', err.message);
      socket.disconnect(true);
    }
  });

  // ── Admin: toggle agent availability (also via socket) ──────────────────────
  // When admin toggles an agent offline via REST, emit this to all support sockets
  // so the agent's socket is ejected from agents_online room.
  // Called from the REST route after DB update.

  return io;
}

/**
 * Get the initialized IO instance to emit events from anywhere in the app
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
}

module.exports = {
  initSocketServer,
  getIO
};
