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
      .select('id, status')
      .eq('customer_id', req.user.id)
      .in('status', ['waiting', 'active'])
      .single();

    if (existing) {
      return res.json({ session_id: existing.id, status: existing.status, existing: true });
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
      .select('id, status, topic, started_at, ended_at, agent_joined_at, session_duration_seconds')
      .eq('customer_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json(data);
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
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: req.params.id,
        sender_type: 'agent',
        sender_id: req.admin.id,
        message: message.trim(),
        message_type: 'text',
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

module.exports = router;
