const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

/**
 * GET /api/positions
 * Get user's open positions
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('positions')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ positions: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

/**
 * POST /api/positions/:id/close
 * Close a position (square off or partial exit)
 */
router.post('/:id/close', async (req, res) => {
  try {
    const { quantity } = req.body; // optional quantity for partial exit
    // 1. Fetch position AND instrument in parallel
    const { data: position } = await supabaseAdmin
      .from('positions')
      .select('*, instrument:instruments(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .eq('status', 'open')
      .single();

    if (!position) return res.status(404).json({ error: 'Open position not found' });

    const instrument = position.instrument;
    if (!instrument) return res.status(404).json({ error: 'Instrument not found' });

    // Validate exit quantity if provided
    let exitQty = parseFloat(position.quantity);
    if (quantity !== undefined && quantity !== null) {
      exitQty = parseFloat(quantity);
      if (isNaN(exitQty) || exitQty <= 0 || exitQty > parseFloat(position.quantity)) {
        return res.status(400).json({ error: 'Invalid exit quantity' });
      }
    }

    // 2. Fetch spread profile (LRU Cached)
    const profile = req.user.profile;
    const cache = require('../core/cache');
    const spreadKey = `spread:${profile.tier}:${instrument.segment}`;
    let spreadProfile = cache.get(spreadKey);

    if (!spreadProfile) {
      const { data } = await supabaseAdmin
        .from('spread_profiles')
        .select('*')
        .eq('tier', profile.tier)
        .eq('segment', instrument.segment)
        .single();
      
      spreadProfile = data;
      if (data) {
        cache.set(spreadKey, data, 300000); // 5m TTL
      }
    }

    const spreadPct = spreadProfile ? spreadProfile.base_spread_pct : 0.05;

    // 3. Execute atomic square-off via Supabase RPC (partial-compatible)
    // Corrected logic: Fetch real-time live price from Redis cache.
    // Fallback to instrument.last_price (periodically flushed to DB), then position's recorded current_price.
    let closePrice = 0;
    try {
      const { getCachedPrice } = require('../core/pnl/mtmCalculator');
      const cached = await getCachedPrice(instrument.symbol.toUpperCase());
      if (cached && cached.ltp) {
        closePrice = cached.ltp;
      }
    } catch (e) {
      console.warn('Redis cache lookup failed for close price:', e.message);
    }

    if (!closePrice) {
      closePrice = parseFloat(instrument.last_price || position.current_price || 0);
    }
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('close_position_partial_v2', {
      p_user_id: req.user.id,
      p_position_id: position.id,
      p_last_price: closePrice,
      p_spread_pct: parseFloat(spreadPct),
      p_exit_qty: exitQty,
      p_close_reason: 'manual'
    });

    if (rpcErr) {
      console.error('close_position_partial_v2 RPC failed:', rpcErr.message);
      return res.status(500).json({ error: 'Square-off failed: ' + rpcErr.message });
    }

    const closedPos = rpcRes.position;
    const trade = rpcRes.trade;

    // Invalidate wallet cache
    try {
      cache.delete(`wallet:${req.user.id}`);
    } catch (err) {}

    // 4. Emit Socket.IO event for instant UI update
    try {
      const { getIO } = require('../ws/socketServer');
      const io = getIO();
      io.of('/user').to(`user:${req.user.id}`).emit('USER:ORDER_FILLED', {
        position: closedPos,
        execution: { 
          executed_price: trade.exit_price, 
          reason: 'manual_close',
          quantity: trade.quantity,
          side: position.side === 'buy' ? 'sell' : 'buy'
        },
      });
    } catch (e) { /* socket not available */ }

    // Re-sync memory positions in execution engine
    try {
      const { syncPositions } = require('../ws/executionEngine');
      syncPositions();
    } catch (e) {}

    res.json({
      message: 'Position closed',
      position: closedPos,
      trade: {
        symbol: trade.symbol,
        side: position.side,
        quantity: trade.quantity,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        gross_pnl: trade.gross_pnl,
        charges: trade.charges,
        net_pnl: trade.net_pnl,
      },
    });
  } catch (err) {
    console.error('Close position error:', err);
    res.status(500).json({ error: 'Failed to close position' });
  }
});

/**
 * PUT /api/positions/:id/sl-tgt
 * Update stop-loss and take-profit for an open position
 */
router.put('/:id/sl-tgt', async (req, res) => {
  try {
    const { stop_loss, target } = req.body;

    const { data: position } = await supabaseAdmin
      .from('positions')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .eq('status', 'open')
      .single();

    if (!position) return res.status(404).json({ error: 'Open position not found' });

    const { updatePositionTargets } = require('../ws/executionEngine');
    const updated = await updatePositionTargets(position.id, stop_loss, target, req.user.id);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update SL/TGT in engine' });
    }

    res.json({ message: 'SL/TGT updated', stop_loss: updated.stop_loss, target: updated.take_profit });
  } catch (err) {
    console.error('SL/TGT update error:', err);
    res.status(500).json({ error: 'Failed to update SL/TGT' });
  }
});

/**
 * GET /api/positions/history
 * Get closed trade history
 */
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabaseAdmin
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('closed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ trades: data || [], pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
