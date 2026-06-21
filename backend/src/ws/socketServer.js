const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('../redis/client');
const { supabaseAdmin } = require('../config/supabase');
const { initNativeWsServer } = require('./nativeWsServer');
const jwt = require('jsonwebtoken');

let io;

function initSocketServer(httpServer) {
  // Initialize Native WebSocket server alongside Socket.IO
  initNativeWsServer(httpServer);

  // Initialize Socket.IO with strict connection settings
  io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        process.env.ADMIN_URL || 'http://localhost:5174',
        'http://localhost:3000',
        'https://stockslab-app.onrender.com',
        'https://stockslab.onrender.com',
        'https://stockslab-admin.onrender.com',
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
              agent_name: socket.agentName,
              agent_joined_at: new Date().toISOString(),
            });

            // Tell all other agents this chat is taken (remove it from their incoming list)
            supportNamespace.to('agents_online').emit('support:chat_taken', { session_id });

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
        socket.on('support:agent_message', async ({ session_id, message }) => {
          try {
            if (!message?.trim()) return;
            const { data: msg } = await supabaseAdmin
              .from('chat_messages')
              .insert({
                session_id,
                sender_type:  'agent',
                sender_id:    socket.agentId,
                message:      message.trim(),
                message_type: 'text',
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
              .select('agent_joined_at')
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

            supportNamespace.to(`session:${session_id}`).emit('support:session_ended', {
              session_id,
              ended_by: 'agent',
            });

            socket.leave(`session:${session_id}`);
            console.log(`[Support] Session ${session_id} ended by agent`);
          } catch (err) {
            console.error('[Support] agent_end_chat error:', err);
          }
        });

        socket.on('disconnect', () => {
          console.log(`[Support] Agent ${socket.agentName} disconnected`);
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
        // Broadcasts to all online agents.
        socket.on('support:request_agent', async ({ session_id, user_name, topic }) => {
          // Join the session room
          socket.join(`session:${session_id}`);

          // Broadcast incoming chat to all online agents
          supportNamespace.to('agents_online').emit('support:incoming_chat', {
            session_id,
            user_name: user_name || 'Customer',
            user_id:   socket.userId,
            topic:     topic || 'General',
            waiting_since: new Date().toISOString(),
          });

          console.log(`[Support] Incoming chat from user ${socket.userId}, session ${session_id}`);
        });

        // ── User: send a message ──
        socket.on('support:user_message', async ({ session_id, message }) => {
          try {
            if (!message?.trim()) return;
            const { data: msg } = await supabaseAdmin
              .from('chat_messages')
              .insert({
                session_id,
                sender_type:  'user',
                sender_id:    socket.userId,
                message:      message.trim(),
                message_type: 'text',
              })
              .select()
              .single();

            supportNamespace.to(`session:${session_id}`).emit('support:new_message', msg);
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
