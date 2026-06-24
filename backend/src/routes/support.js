/**
 * routes/support.js
 * Customer Support Chat System — REST endpoints
 *
 * User endpoints (Supabase JWT):
 *   POST   /api/support/sessions/request       - request a live agent
 *   GET    /api/support/sessions/mine          - get own session history
 *   GET    /api/support/sessions/:id/messages  - load message history
 *   GET    /api/support/tickets/mine           - get own trouble tickets
 *
 * Agent/Admin endpoints (Admin JWT):
 *   GET    /api/support/admin/sessions         - all waiting + active sessions
 *   GET    /api/support/admin/sessions/:id/customer - full customer profile
 *   POST   /api/support/admin/sessions/:id/messages - save agent message
 *   POST   /api/support/admin/sessions/:id/tt  - raise trouble ticket
 *   GET    /api/support/admin/tickets          - all trouble tickets
 *   PATCH  /api/support/admin/tickets/:id      - update TT (admin only)
 *
 * Admin-only endpoints:
 *   GET    /api/support/admin/agents/availability   - get all agents + status
 *   PATCH  /api/support/admin/agents/:id/availability - toggle agent online/offline
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../services/emailService');


// ── Auth Middleware: User (Supabase token) ────────────────────────────────────
async function requireUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Auth error' });
  }
}

// ── Auth Middleware: Agent/Admin (custom JWT) ─────────────────────────────────
function requireAgent(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (!decoded?.id) return res.status(401).json({ error: 'Invalid token' });
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Auth Middleware: Super Admin only ─────────────────────────────────────────
function requireSuperAdmin(req, res, next) {
  requireAgent(req, res, () => {
    if (req.admin.role !== 'super_admin' && req.admin.department !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// ── Auth Middleware: User or Agent ───────────────────────────────────────────
async function requireUserOrAgent(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    // Try agent JWT first
    try {
      const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
      const decoded = jwt.verify(token, secret);
      if (decoded?.id) {
        req.admin = decoded;
        req.isAgent = true;
        return next();
      }
    } catch (_) {}

    // Try user Supabase token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      req.user = user;
      req.isAgent = false;
      return next();
    }

    return res.status(401).json({ error: 'Invalid token' });
  } catch (err) {
    res.status(401).json({ error: 'Auth error' });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/support/sessions/request
 * User requests a live agent. Creates a 'waiting' chat session.
 * Returns session_id so client can join Socket.IO room.
 */
router.post('/sessions/request', requireUser, async (req, res) => {
  try {
    const { topic, bot_transcript } = req.body;

    // Check if user already has an active session
    const { data: existing } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, status, agent_id, agent_joined_at')
      .eq('customer_id', req.user.id)
      .in('status', ['waiting', 'active'])
      .single();

    if (existing) {
      let agentName = null;
      if (existing.agent_id) {
        const { data: agent } = await supabaseAdmin
          .from('admin_users')
          .select('name')
          .eq('id', existing.agent_id)
          .single();
        if (agent) agentName = agent.name;
      } else if (existing.agent_joined_at) {
        agentName = process.env.AI_AGENT_NAME || 'Riya';
      }

      return res.json({
        session_id: existing.id,
        status: existing.status,
        existing: true,
        agent_name: agentName,
        agent_joined_at: existing.agent_joined_at,
      });
    }

    const { data: session, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        customer_id: req.user.id,
        status: 'waiting',
        topic: topic || 'General Inquiry',
        bot_transcript: bot_transcript || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Save the initial "connecting" system message
    await supabaseAdmin.from('chat_messages').insert({
      session_id: session.id,
      sender_type: 'system',
      message: 'Connecting you to an agent. Please wait...',
      message_type: 'system',
    });

    res.status(201).json({ session_id: session.id, status: 'waiting' });
  } catch (err) {
    console.error('[Support] request session error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/sessions/mine
 * Returns the user's own session history (latest 20).
 */
router.get('/sessions/mine', requireUser, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, status, topic, started_at, ended_at, agent_joined_at, session_duration_seconds, rating, rating_comment, agent_id')
      .eq('customer_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Enrich with agent names
    const agentIds = [...new Set(data.map(s => s.agent_id).filter(Boolean))];
    let agentMap = {};
    if (agentIds.length > 0) {
      const { data: agents, error: agentErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, name')
        .in('id', agentIds);
      if (!agentErr && agents) {
        agents.forEach(a => {
          agentMap[a.id] = a.name;
        });
      }
    }

    const enriched = data.map(s => ({
      ...s,
      agent_name: s.agent_id ? (agentMap[s.agent_id] || 'Agent') : null,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/sessions/:id/messages
 * Returns all messages for a session (user must own the session).
 */
router.get('/sessions/:id/messages', requireUser, async (req, res) => {
  try {
    // Verify ownership
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, customer_id, status, agent_id')
      .eq('id', req.params.id)
      .single();

    if (sessionErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.customer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, sender_type, sender_id, message, message_type, options, created_at')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/tickets/mine
 * Returns trouble tickets for the logged-in user (read-only).
 */
router.get('/tickets/mine', requireUser, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('trouble_tickets')
      .select('id, ticket_number, category, priority, status, description, created_at')
      .eq('customer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/support/sessions/:id/end
 * User ends their own chat session.
 */
router.patch('/sessions/:id/end', requireUser, async (req, res) => {
  try {
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, customer_id, agent_joined_at')
      .eq('id', req.params.id)
      .single();

    if (!session || session.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const endedAt = new Date();
    const durationSecs = session.agent_joined_at
      ? Math.round((endedAt - new Date(session.agent_joined_at)) / 1000)
      : null;

    await supabaseAdmin.from('chat_sessions').update({
      status: 'ended',
      ended_at: endedAt.toISOString(),
      ended_by: 'user',
      session_duration_seconds: durationSecs,
    }).eq('id', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/sessions/:id/rate
 * Submit customer rating for an ended chat session.
 */
router.post('/sessions/:id/rate', requireUser, async (req, res) => {
  try {
    const { rating, rating_comment } = req.body;
    
    // Validate rating
    const ratingInt = parseInt(rating);
    if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    // Verify ownership, status and live agent presence
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, customer_id, status, agent_id')
      .eq('id', req.params.id)
      .single();

    if (sessionErr || !session) return res.status(404).json({ error: 'Session not found' });
    if (session.customer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (session.status !== 'ended') return res.status(400).json({ error: 'Only ended sessions can be rated' });
    if (!session.agent_id) return res.status(400).json({ error: 'Only live agent chats can be rated' });

    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        rating: ratingInt,
        rating_comment: rating_comment ? rating_comment.trim() : null
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, rating: data.rating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// AGENT / ADMIN ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/support/admin/sessions
 * Returns all waiting + active sessions for the agent workspace.
 */
router.get('/admin/sessions', requireAgent, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        id, status, topic, started_at, agent_joined_at,
        customer_id,
        agent_id
      `)
      .in('status', ['waiting', 'active'])
      .order('started_at', { ascending: true });

    if (error) throw error;

    // Enrich with customer names
    const customerIds = [...new Set(data.map(s => s.customer_id).filter(Boolean))];
    let customerMap = {};
    if (customerIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, client_id')
        .in('id', customerIds);
      (users || []).forEach(u => { customerMap[u.id] = u; });
    }

    const enriched = data.map(s => ({
      ...s,
      customer: customerMap[s.customer_id] || { full_name: 'Unknown', email: '' },
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/sessions/:id/customer
 * Returns full customer profile for the agent's sidebar.
 */
router.get('/admin/sessions/:id/customer', requireAgent, async (req, res) => {
  try {
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('customer_id, topic, bot_transcript, started_at')
      .eq('id', req.params.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Get user profile from profiles table (not 'users')
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, client_id, kyc_status, created_at')
      .eq('id', session.customer_id)
      .single();

    // Get wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance, credit_limit')
      .eq('user_id', session.customer_id)
      .single();

    // Get open positions count
    const { count: openPositions } = await supabaseAdmin
      .from('positions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.customer_id)
      .eq('status', 'open');

    // Get recent wallet transactions (last 5)
    const { data: recentTxns } = await supabaseAdmin
      .from('wallet_transactions')
      .select('type, amount, created_at')
      .eq('user_id', session.customer_id)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      session,
      user,
      wallet,
      open_positions: openPositions || 0,
      recent_transactions: recentTxns || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/sessions/:id/messages
 * Returns all messages for a session — agents can read any session.
 */
router.get('/admin/sessions/:id/messages', requireAgent, async (req, res) => {
  try {
    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, sender_type, sender_id, message, message_type, options, created_at')
      .eq('session_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/admin/sessions/:id/messages
 * Save an agent message (also done via socket, this is a REST backup).
 */
router.post('/admin/sessions/:id/messages', requireAgent, async (req, res) => {
  try {
    const { message, message_type } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const type = ['text', 'image', 'document'].includes(message_type) ? message_type : 'text';

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: req.params.id,
        sender_type: 'agent',
        sender_id: req.admin.id,
        message: message.trim(),
        message_type: type,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/admin/sessions/:id/tt
 * Agent raises a Trouble Ticket from within a chat session.
 */
router.post('/admin/sessions/:id/tt', requireAgent, async (req, res) => {
  try {
    const { category, priority, description } = req.body;
    if (!category || !description?.trim()) {
      return res.status(400).json({ error: 'category and description required' });
    }

    // Get session to find customer_id
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('customer_id')
      .eq('id', req.params.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: ticket, error } = await supabaseAdmin
      .from('trouble_tickets')
      .insert({
        session_id: req.params.id,
        customer_id: session.customer_id,
        raised_by_agent_id: req.admin.id,
        category,
        priority: priority || 'medium',
        description: description.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Add a system message in the chat about the TT
    await supabaseAdmin.from('chat_messages').insert({
      session_id: req.params.id,
      sender_type: 'system',
      message: `Trouble Ticket ${ticket.ticket_number} has been raised. Our team will follow up.`,
      message_type: 'system',
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/tickets
 * Returns all trouble tickets (agents + admin can see all).
 */
router.get('/admin/tickets', requireAgent, async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('trouble_tickets')
      .select(`
        id, ticket_number, category, priority, status, description,
        admin_notes, created_at, updated_at, closed_at,
        customer_id, raised_by_agent_id, session_id
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (priority) query = query.eq('priority', priority);

    const { data: tickets, count, error } = await query;
    if (error) throw error;

    // Enrich with customer + agent names
    const customerIds = [...new Set(tickets.map(t => t.customer_id).filter(Boolean))];
    const agentIds    = [...new Set(tickets.map(t => t.raised_by_agent_id).filter(Boolean))];

    let customerMap = {}, agentMap = {};
    if (customerIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('profiles').select('id, full_name, client_id').in('id', customerIds);
      (users || []).forEach(u => { customerMap[u.id] = u; });
    }
    if (agentIds.length > 0) {
      const { data: agents } = await supabaseAdmin
        .from('admin_users').select('id, name').in('id', agentIds);
      (agents || []).forEach(a => { agentMap[a.id] = a; });
    }

    const enriched = tickets.map(t => ({
      ...t,
      customer: customerMap[t.customer_id] || null,
      raised_by_agent: agentMap[t.raised_by_agent_id] || null,
    }));

    res.json({ tickets: enriched, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/tickets/:id
 * Full ticket details including session transcript link.
 */
router.get('/admin/tickets/:id', requireAgent, async (req, res) => {
  try {
    const { data: ticket, error } = await supabaseAdmin
      .from('trouble_tickets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Enrich
    const { data: customer } = await supabaseAdmin
      .from('profiles').select('full_name, email, client_id').eq('id', ticket.customer_id).single();
    const { data: agent } = await supabaseAdmin
      .from('admin_users').select('name, email').eq('id', ticket.raised_by_agent_id).single();

    res.json({ ...ticket, customer, raised_by_agent: agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/support/admin/tickets/:id
 * Update a trouble ticket — status, admin notes, close.
 * Any agent can update status/notes. Only admin can close.
 */
router.patch('/admin/tickets/:id', requireAgent, async (req, res) => {
  try {
    const { status, admin_notes, priority } = req.body;
    const updateData = {};

    if (status) updateData.status = status;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (priority) updateData.priority = priority;

    // Closing requires super_admin or admin department
    if (status === 'closed') {
      if (req.admin.role !== 'super_admin' && req.admin.department !== 'admin') {
        return res.status(403).json({ error: 'Only admin can close tickets' });
      }
      updateData.closed_at = new Date().toISOString();
      updateData.closed_by = req.admin.id;
    }

    const { data, error } = await supabaseAdmin
      .from('trouble_tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENT AVAILABILITY (ADMIN ONLY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/support/admin/agents/availability
 * Returns all agents with their online status and active chat count.
 * Admin use only.
 */
router.get('/admin/agents/availability', requireAgent, async (req, res) => {
  try {
    const { data: agents, error } = await supabaseAdmin
      .from('admin_users')
      .select(`
        id, name, email, role, department,
        agent_availability (is_online, active_chat_count, toggled_at, toggled_by)
      `)
      .order('name');

    if (error) throw error;
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/support/admin/agents/:id/availability
 * Toggle agent online/offline. ADMIN ONLY.
 */
router.patch('/admin/agents/:id/availability', requireSuperAdmin, async (req, res) => {
  try {
    const { is_online } = req.body;
    if (typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online (boolean) required' });
    }

    const { data, error } = await supabaseAdmin
      .from('agent_availability')
      .upsert({
        agent_id:   req.params.id,
        is_online,
        toggled_by: req.admin.id,
        toggled_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Dynamically notify the support socket namespace to join/leave the online agents room
    try {
      const { getIO } = require('../ws/socketServer');
      const io = getIO();
      const supportNamespace = io.of('/support');
      const agentSockets = Array.from(supportNamespace.sockets.values());
      const agentSocket = agentSockets.find(s => s.agentId === req.params.id);
      if (agentSocket) {
        if (is_online) {
          agentSocket.join('agents_online');
          console.log(`[Support] Agent ${agentSocket.agentName} toggled ONLINE: joined agents_online room`);
        } else {
          agentSocket.leave('agents_online');
          console.log(`[Support] Agent ${agentSocket.agentName} toggled OFFLINE: left agents_online room`);
        }
        // Notify the agent socket of their status change
        agentSocket.emit('support:availability_changed', { is_online });
      }
    } catch (wsErr) {
      console.warn('[Support] Failed to update agent socket availability room:', wsErr.message);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT HISTORY (ENDED SESSIONS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/support/admin/history
 * Returns ended chat sessions.
 * - Super admin / admin department: all sessions.
 * - Regular agent: only sessions assigned to themselves.
 * Query params: page, limit, agent_id (admin-only filter)
 */
router.get('/admin/history', requireAgent, async (req, res) => {
  try {
    const { page = 1, limit = 50, agent_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isAdmin = req.admin.role === 'super_admin' || req.admin.department === 'admin';

    let query = supabaseAdmin
      .from('chat_sessions')
      .select(`
        id, status, topic, started_at, agent_joined_at, ended_at, ended_by,
        session_duration_seconds, customer_id, agent_id
      `, { count: 'exact' })
      .eq('status', 'ended')
      .order('ended_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (isAdmin && agent_id) {
      query = query.eq('agent_id', agent_id);
    } else if (!isAdmin) {
      // Regular agent sees only own chats
      query = query.eq('agent_id', req.admin.id);
    }

    const { data: sessions, count, error } = await query;
    if (error) throw error;

    // Enrich with customer + agent names
    const customerIds = [...new Set(sessions.map(s => s.customer_id).filter(Boolean))];
    const agentIds    = [...new Set(sessions.map(s => s.agent_id).filter(Boolean))];
    let customerMap = {}, agentMap = {};

    if (customerIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('profiles').select('id, full_name, email, client_id').in('id', customerIds);
      (users || []).forEach(u => { customerMap[u.id] = u; });
    }
    if (agentIds.length > 0) {
      const { data: agents } = await supabaseAdmin
        .from('admin_users').select('id, name, email').in('id', agentIds);
      (agents || []).forEach(a => { agentMap[a.id] = a; });
    }

    const enriched = sessions.map(s => ({
      ...s,
      customer: customerMap[s.customer_id] || null,
      agent: agentMap[s.agent_id] || null,
    }));

    res.json({ sessions: enriched, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/performance
 * Returns agent rating performance.
 * - Admin/Super Admin: see all agents summary, or filter by agent_id for detailed stats.
 * - Regular Agent: restricted to own agent_id only.
 */
router.get('/admin/performance', requireAgent, async (req, res) => {
  try {
    const isAdmin = req.admin.role === 'super_admin' || req.admin.department === 'admin';
    let targetAgentId = req.query.agent_id;

    if (!isAdmin) {
      // Force regular agents to only view their own score
      targetAgentId = req.admin.id;
    }

    if (targetAgentId) {
      // Fetch detailed performance stats for a single agent
      // 1. Get all ended sessions for this agent where rating is not null
      const { data: sessions, error } = await supabaseAdmin
        .from('chat_sessions')
        .select('id, topic, ended_at, rating, rating_comment, customer_id')
        .eq('agent_id', targetAgentId)
        .eq('status', 'ended')
        .not('rating', 'is', null)
        .order('ended_at', { ascending: false });

      if (error) throw error;

      // 2. Fetch customer names for enrichment
      const customerIds = [...new Set(sessions.map(s => s.customer_id).filter(Boolean))];
      let customerMap = {};
      if (customerIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, client_id')
          .in('id', customerIds);
        (users || []).forEach(u => {
          customerMap[u.id] = u;
        });
      }

      // 3. Compute stats
      const totalRatings = sessions.length;
      let totalSum = 0;
      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      
      const ratingsList = sessions.map(s => {
        const ratingVal = s.rating;
        totalSum += ratingVal;
        if (distribution[ratingVal] !== undefined) {
          distribution[ratingVal]++;
        }
        return {
          id: s.id,
          topic: s.topic,
          ended_at: s.ended_at,
          rating: ratingVal,
          rating_comment: s.rating_comment,
          customer: customerMap[s.customer_id] || { full_name: 'Unknown', client_id: '—' }
        };
      });

      const averageRating = totalRatings > 0 ? parseFloat((totalSum / totalRatings).toFixed(2)) : 0;

      // 4. Return results
      return res.json({
        agent_id: targetAgentId,
        average_rating: averageRating,
        total_ratings: totalRatings,
        rating_distribution: distribution,
        ratings_list: ratingsList
      });

    } else {
      // Admin requesting summary for all agents
      // 1. Get all admin users (agents)
      const { data: agents, error: agentErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, name, email, role, department');

      if (agentErr) throw agentErr;

      // 2. Get ratings count and average per agent
      const { data: sessions, error: sessionErr } = await supabaseAdmin
        .from('chat_sessions')
        .select('agent_id, rating')
        .eq('status', 'ended')
        .not('rating', 'is', null);

      if (sessionErr) throw sessionErr;

      // Compute aggregates per agent
      const agentStats = {};
      agents.forEach(a => {
        agentStats[a.id] = {
          agent_id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          department: a.department,
          total_ratings: 0,
          ratings_sum: 0,
          average_rating: 0
        };
      });

      sessions.forEach(s => {
        if (agentStats[s.agent_id]) {
          agentStats[s.agent_id].total_ratings++;
          agentStats[s.agent_id].ratings_sum += s.rating;
        }
      });

      const summary = Object.values(agentStats).map(stat => {
        return {
          ...stat,
          average_rating: stat.total_ratings > 0 ? parseFloat((stat.ratings_sum / stat.total_ratings).toFixed(2)) : 0,
          ratings_sum: undefined // clean up
        };
      });

      // Sort by average rating descending, then total ratings descending
      summary.sort((a, b) => b.average_rating - a.average_rating || b.total_ratings - a.total_ratings);

      return res.json(summary);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/agents/list
 * Returns all agents (for transfer dropdown).
 */
router.get('/admin/agents/list', requireAgent, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select(`
        id, name, email, role, department,
        agent_availability (is_online, active_chat_count)
      `)
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/admin/sessions/:id/transfer
 * Transfer a chat session to another agent.
 * Body: { target_agent_id, note }
 */
router.post('/admin/sessions/:id/transfer', requireAgent, async (req, res) => {
  try {
    const { target_agent_id, note } = req.body;
    if (!target_agent_id) return res.status(400).json({ error: 'target_agent_id required' });

    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, agent_id, status, customer_id')
      .eq('id', req.params.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Only active sessions can be transferred' });

    // Get target agent info
    const { data: targetAgent } = await supabaseAdmin
      .from('admin_users').select('id, name').eq('id', target_agent_id).single();
    if (!targetAgent) return res.status(404).json({ error: 'Target agent not found' });

    // Update session agent
    const { data: updated, error } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        agent_id: target_agent_id,
        agent_joined_at: new Date().toISOString(), // reset timer
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Add system message about transfer
    const noteMsg = note ? ` Note: ${note}` : '';
    await supabaseAdmin.from('chat_messages').insert({
      session_id: req.params.id,
      sender_type: 'system',
      message: `Chat has been transferred to ${targetAgent.name}.${noteMsg}`,
      message_type: 'system',
    });

    // Notify socket namespace about transfer
    try {
      const { getIO } = require('../ws/socketServer');
      const io = getIO();
      const supportNS = io.of('/support');

      // Tell old agent: this chat is transferred away
      supportNS.to(`session:${req.params.id}`).emit('support:chat_transferred', {
        session_id: req.params.id,
        to_agent_id: target_agent_id,
        to_agent_name: targetAgent.name,
        note: note || '',
      });

      // Find target agent socket and notify them
      const agentSockets = Array.from(supportNS.sockets.values());
      const targetSocket = agentSockets.find(s => s.agentId === target_agent_id);
      if (targetSocket) {
        targetSocket.emit('support:incoming_transfer', {
          session_id: req.params.id,
          from_agent_name: req.admin.name || 'Agent',
          customer_id: session.customer_id,
          note: note || '',
        });
      }
    } catch (wsErr) {
      console.warn('[Support] Failed to emit transfer socket event:', wsErr.message);
    }

    res.json({ success: true, session: updated, target_agent: targetAgent });
  } catch (err) {
    console.error('[Support] transfer error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/admin/sessions/:id/send-email
 * Send a follow-up email to the customer after chat ends.
 * Uses the project's Resend-based emailService (same as all other emails).
 * Body: { email (optional override), subject, body }
 */
router.post('/admin/sessions/:id/send-email', requireAgent, async (req, res) => {
  try {
    const { email: overrideEmail, subject, body: emailBody } = req.body;
    if (!subject || !emailBody) return res.status(400).json({ error: 'subject and body required' });

    // Get session + customer info
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('customer_id')
      .eq('id', req.params.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    let toEmail = overrideEmail;
    let customerId = session.customer_id;
    if (!toEmail) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', customerId)
        .single();
      toEmail = profile?.email;
    }

    if (!toEmail) return res.status(400).json({ error: 'No customer email found. Please provide an email address.' });

    // Build HTML using same style as other emails in the project
    const html = `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff;">
        <div style="margin-bottom:24px;">
          <img src="https://stockslab.live/logo.png" alt="StocksLab" style="height:36px;" onerror="this.style.display='none'" />
        </div>
        <h2 style="color:#1e3a8a;font-size:20px;font-weight:700;margin:0 0 16px;">${subject}</h2>
        <div style="color:#374151;font-size:15px;line-height:1.7;white-space:pre-wrap;">${emailBody.replace(/\n/g, '<br/>')}</div>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          StocksLab India — Customer Support<br/>
          <a href="mailto:support@stockslab.live" style="color:#3b82f6;">support@stockslab.live</a>
        </p>
      </div>
    `;

    // Send via existing Resend emailService (same as deposit/withdrawal/kyc emails)
    const result = await sendEmail({
      to: toEmail,
      subject,
      html,
      text: emailBody,
      userId: customerId,
      type: 'support_followup',
    });

    // Log as system message in the chat transcript
    try {
      await supabaseAdmin.from('chat_messages').insert({
        session_id: req.params.id,
        sender_type: 'system',
        message: result.success
          ? `Follow-up email sent to ${toEmail}.`
          : `Follow-up email to ${toEmail} failed: ${result.error || 'Unknown error'}.`,
        message_type: 'system',
      });
    } catch (dbErr) {
      console.error('[Support] Failed to insert email system log:', dbErr?.message || dbErr);
    }

    res.json({ success: result.success, emailSent: result.success, to: toEmail, resendId: result.id });
  } catch (err) {
    console.error('[Support] send-email error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/upload
 * Accept Base64 file and save it in backend/uploads directory.
 * Used for sending media/documents in support chat.
 */
router.post('/upload', requireUserOrAgent, async (req, res) => {
  try {
    const { file_base64, filename } = req.body;
    if (!file_base64 || !filename) {
      return res.status(400).json({ error: 'file_base64 and filename are required' });
    }

    // Process Base64
    const matches = file_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(file_base64, 'base64');
    }

    // Check size limit (10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    const fs = require('fs');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');

    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(filename) || '.png';
    const uniqueFilename = `support_${uuidv4()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    await fs.promises.writeFile(filePath, buffer);

    const fileUrl = `/uploads/${uniqueFilename}`;
    res.status(201).json({ url: fileUrl, filename: uniqueFilename });
  } catch (err) {
    console.error('[Support] Upload error:', err);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT TICKETS (TT BY CLIENTS) ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/support/client-tickets
 * Create a new ticket raised directly by a client.
 */
router.post('/client-tickets', requireUser, async (req, res) => {
  try {
    const { category, description } = req.body;
    if (!category || !description?.trim()) {
      return res.status(400).json({ error: 'category and description required' });
    }

    const categories = ['deposit', 'withdrawal', 'trading', 'kyc', 'account', 'other'];
    if (!categories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('client_tickets')
      .insert({
        customer_id: req.user.id,
        category,
        description: description.trim(),
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(ticket);
  } catch (err) {
    console.error('[Support] Create client ticket error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/client-tickets
 * Retrieve own tickets for the client.
 */
router.get('/client-tickets', requireUser, async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from('client_tickets')
      .select('*')
      .eq('customer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/support/admin/client-tickets
 * Retrieve all client tickets for the admin panel.
 */
router.get('/admin/client-tickets', requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from('client_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tickets, error } = await query;
    if (error) throw error;

    // Enrich with customer details
    const customerIds = [...new Set(tickets.map(t => t.customer_id).filter(Boolean))];
    let customerMap = {};
    if (customerIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, client_id')
        .in('id', customerIds);
      (users || []).forEach(u => {
        customerMap[u.id] = u;
      });
    }

    const enriched = tickets.map(t => ({
      ...t,
      customer: customerMap[t.customer_id] || { full_name: 'Unknown', email: '', client_id: '—' }
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/support/admin/client-tickets/:id
 * Update a client ticket (write response or close).
 */
router.patch('/admin/client-tickets/:id', requireAgent, async (req, res) => {
  try {
    const { admin_response, status } = req.body;
    const updateData = {};

    if (admin_response !== undefined) {
      updateData.admin_response = admin_response;
    }
    if (status) {
      updateData.status = status;
      if (status === 'closed') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by = req.admin.id;
      } else if (status === 'open') {
        updateData.closed_at = null;
        updateData.closed_by = null;
      }
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('client_tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/support/admin/client-tickets/:id/send-email
 * Send an email update to the user about their client ticket.
 */
router.post('/admin/client-tickets/:id/send-email', requireAgent, async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'subject and body are required' });
    }

    // Get ticket + customer details
    const { data: ticket } = await supabaseAdmin
      .from('client_tickets')
      .select('customer_id, ticket_number')
      .eq('id', req.params.id)
      .single();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', ticket.customer_id)
      .single();

    if (!profile?.email) {
      return res.status(400).json({ error: 'No customer email found for this ticket.' });
    }

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#ffffff;">
        <div style="margin-bottom:24px;">
          <img src="https://stockslab.live/logo.png" alt="StocksLab" style="height:36px;" onerror="this.style.display='none'" />
        </div>
        <h2 style="color:#1e3a8a;font-size:20px;font-weight:700;margin:0 0 16px;">${subject}</h2>
        <div style="color:#374151;font-size:15px;line-height:1.7;white-space:pre-wrap;">${body.replace(/\n/g, '<br/>')}</div>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;"/>
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          StocksLab India — Customer Support<br/>
          Ticket Number: ${ticket.ticket_number}<br/>
          <a href="mailto:support@stockslab.live" style="color:#3b82f6;">support@stockslab.live</a>
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: profile.email,
      subject,
      html,
      text: body,
      userId: ticket.customer_id,
      type: 'support_followup',
    });

    res.json({ success: result.success, emailSent: result.success, to: profile.email });
  } catch (err) {
    console.error('[Support] send client ticket email error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
