/**
 * Simulated Execution Engine
 * Evaluates live ticks against open positions to trigger Stop Loss / Target hits
 */
const { supabaseAdmin } = require('../config/supabase');

// In-memory active positions indexed by symbol for O(1) tick lookup
const positionsBySymbol = new Map(); // symbol → Position[]
let allPositions = []; // flat list (for re-sync)

// In-memory pending limit orders indexed by symbol for O(1) tick lookup
const ordersBySymbol = new Map(); // symbol → Order[]
let allLimitOrders = []; // flat list (for re-sync)

/** Rebuild symbol indexes from flat lists */
function _rebuildIndexes() {
  positionsBySymbol.clear();
  for (const pos of allPositions) {
    const sym = pos.symbol;
    if (!positionsBySymbol.has(sym)) positionsBySymbol.set(sym, []);
    positionsBySymbol.get(sym).push(pos);
  }

  ordersBySymbol.clear();
  for (const ord of allLimitOrders) {
    const sym = ord.symbol;
    if (!ordersBySymbol.has(sym)) ordersBySymbol.set(sym, []);
    ordersBySymbol.get(sym).push(ord);
  }
}

/**
 * Sync active positions from database into memory
 */
async function syncPositions() {
  try {
    const { data, error } = await supabaseAdmin
      .from('positions')
      .select('*')
      .in('status', ['OPEN', 'open']); // Checking both cases safely
      
    if (!error && data) {
      allPositions = data;
      _rebuildIndexes();
    }
  } catch (err) {
    console.error('Error syncing positions:', err);
  }
}

/**
 * Sync pending limit and stop-loss orders from database into memory
 */
async function syncLimitOrders() {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .in('order_type', ['limit', 'stop_loss']); // Bug #20: include stop_loss trigger orders
      
    if (!error && data) {
      allLimitOrders = data;
      _rebuildIndexes();
    }
  } catch (err) {
    console.error('Error syncing limit orders:', err);
  }
}

/**
 * Handle updates to SL/TGT from frontend (drag events)
 */
async function updatePositionTargets(positionId, stopLoss, target, userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('positions')
      .update({ stop_loss: stopLoss, take_profit: target })
      .eq('id', positionId)
      .eq('user_id', userId)
      .select()
      .single();
      
    if (!error && data) {
      // Update in-memory
      const idx = allPositions.findIndex(p => p.id === positionId);
      if (idx !== -1) {
        allPositions[idx] = data;
        _rebuildIndexes();
      }
      return data;
    }
  } catch (err) {
    console.error('Error updating SL/TGT:', err);
  }
  return null;
}

/**
 * Evaluate a tick against open positions
 */
async function evaluateTick(tick) {
  const { symbol, ltp, bid, ask } = tick;
  
  // 1. Evaluate Positions for SL/TP (O(1) symbol lookup)
  const positionsToEval = positionsBySymbol.get(symbol) || [];
  
  for (const pos of positionsToEval) {
    let triggered = false;
    let triggerType = null;
    let exitPrice = null;

    // Use bid/ask if available, fallback to ltp
    const evalPrice = (pos.side === 'BUY' || pos.side === 'long') ? (bid || ltp) : (ask || ltp);

    if (pos.side === 'BUY' || pos.side === 'long') {
      // Check Stop Loss
      if (pos.stop_loss && evalPrice <= pos.stop_loss) {
        triggered = true;
        triggerType = 'STOP_LOSS';
        exitPrice = evalPrice;
      }
      // Check Target
      else if ((pos.take_profit || pos.target) && evalPrice >= (pos.take_profit || pos.target)) {
        triggered = true;
        triggerType = 'TARGET';
        exitPrice = evalPrice;
      }
    } else if (pos.side === 'SELL' || pos.side === 'short') {
      // Check Stop Loss
      if (pos.stop_loss && evalPrice >= pos.stop_loss) {
        triggered = true;
        triggerType = 'STOP_LOSS';
        exitPrice = evalPrice;
      }
      // Check Target
      else if ((pos.take_profit || pos.target) && evalPrice <= (pos.take_profit || pos.target)) {
        triggered = true;
        triggerType = 'TARGET';
        exitPrice = evalPrice;
      }
    }

    if (triggered) {
      await executeSquareOff(pos, exitPrice, triggerType);
    }
  }

  // 2. Evaluate Limit and Stop-Loss Orders for execution (O(1) symbol lookup)
  const limitsToEval = ordersBySymbol.get(symbol) || [];
  for (const order of limitsToEval) {
    let matched = false;
    let execPrice = null;

    const evalPrice = (order.side === 'buy') ? (ask || ltp) : (bid || ltp);

    if (order.order_type === 'limit') {
      // Limit order: fill when market price is at or better than limit price
      if (order.side === 'buy' && evalPrice <= order.price) {
        matched = true;
        execPrice = order.price; // execute at requested limit price or better
      } else if (order.side === 'sell' && evalPrice >= order.price) {
        matched = true;
        execPrice = order.price;
      }
    } else if (order.order_type === 'stop_loss') {
      // Stop-loss trigger order: fill when market price crosses trigger_price
      const triggerPrice = order.trigger_price || order.price;
      if (order.side === 'buy' && evalPrice >= triggerPrice) {
        // BUY stop: triggers when price rises to or above trigger (buy-stop / stop-entry)
        matched = true;
        execPrice = evalPrice; // market fill at current price after trigger
      } else if (order.side === 'sell' && evalPrice <= triggerPrice) {
        // SELL stop: triggers when price falls to or below trigger (stop-market)
        matched = true;
        execPrice = evalPrice;
      }
    }

    if (matched) {
      // Optimistically remove from indexes to prevent double-execution
      allLimitOrders = allLimitOrders.filter(o => o.id !== order.id);
      const symOrders = ordersBySymbol.get(symbol);
      if (symOrders) {
        const idx = symOrders.findIndex(o => o.id === order.id);
        if (idx !== -1) symOrders.splice(idx, 1);
      }
      
      const { orderQueue } = require('../core/queues/orderQueue');
      try {
        await orderQueue.add('fill_limit_order', {
          orderId: order.id,
          executionPrice: execPrice
        });
        console.log(`⏱️ Limit order ${order.id} matched at ${execPrice}, queued for execution`);
      } catch (err) {
        console.error('Failed to queue limit order execution:', err);
        // Put back in flat list and rebuild indexes if queueing fails
        allLimitOrders.push(order);
        _rebuildIndexes();
      }
    }
  }
}

/**
 * Square off a position (Queue to BullMQ worker)
 * 
 * For bracket orders: when one leg (SL or TGT) fires, the opposite leg
 * is neutralised by clearing it on the position record. This prevents the
 * position (which is already being closed) from triggering the other leg
 * on the next tick — a critical safety guard against double-fills.
 */
async function executeSquareOff(position, exitPrice, triggerType) {
  console.log(`⚡ Auto-Squareoff Triggered: ${position.symbol} ${triggerType} at ${exitPrice}`);
    
  // Optimistically remove from indexes to prevent duplicate triggers
  allPositions = allPositions.filter(p => p.id !== position.id);
  const symPositions = positionsBySymbol.get(position.symbol);
  if (symPositions) {
    const idx = symPositions.findIndex(p => p.id === position.id);
    if (idx !== -1) symPositions.splice(idx, 1);
  }

  // Bracket order: clear the opposite leg in DB to prevent ghost triggers.
  // If SL fired → clear TGT. If TGT fired → clear SL.
  if (position.is_bracket_order) {
    const clearField = triggerType === 'STOP_LOSS' ? { take_profit: null } : { stop_loss: null };
    supabaseAdmin
      .from('positions')
      .update(clearField)
      .eq('id', position.id)
      .then(() => {
        console.log(`🔗 Bracket leg cleared on position ${position.id} after ${triggerType}`);
      })
      .catch(err => {
        console.warn(`[ExecutionEngine] Failed to clear bracket opposite leg:`, err.message);
      });
  }
  
  try {
    const { orderQueue } = require('../core/queues/orderQueue');
    await orderQueue.add('execute_sl_tp', {
      positionId: position.id,
      exitPrice: exitPrice,
      triggerType: triggerType,
      isBracketOrder: position.is_bracket_order === true,
    });
    console.log(`⏱️ Position ${position.id} queued for ${position.is_bracket_order ? 'bracket ' : ''}SL/TP squareoff`);
  } catch (err) {
    console.error('Squareoff queueing failed:', err);
    // Add back to memory and rebuild indexes if queueing fails
    allPositions.push(position);
    _rebuildIndexes();
  }
}

// Initial sync
syncPositions();
syncLimitOrders();
// Re-sync every 30 seconds to catch any external changes
setInterval(() => {
  syncPositions();
  syncLimitOrders();
}, 30000);

module.exports = {
  evaluateTick,
  updatePositionTargets,
  syncPositions,
  syncLimitOrders
};
