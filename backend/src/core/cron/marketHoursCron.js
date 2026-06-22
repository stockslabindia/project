const { supabaseAdmin } = require('../../config/supabase');
const cron = require('node-cron');
const { getIO } = require('../../ws/socketServer');
const { sendPushNotification } = require('../../services/pushNotifier');
const { checkMarketHours } = require('../risk/marketHours');

// Scheduled auto-cut evaluation. Checks every minute.
async function executeEodAutoCut() {
  console.log('🔄 [CRON] Starting EOD Auto-Cut position check...');
  try {
    const { data: positions, error } = await supabaseAdmin
      .from('positions')
      .select('*, instrument:instruments(*)')
      .eq('status', 'open')
      .eq('product_type', 'intraday'); // Only auto-cut intraday (MIS) positions; overnight (NRML) are carried forward

    if (error) {
      console.error('[CRON] Failed to fetch open positions for auto-cut:', error.message);
      return;
    }

    if (!positions || positions.length === 0) {
      return;
    }

    let positionsClosed = 0;

    for (const pos of positions) {
      if (!pos.instrument) continue;
      
      const marketHours = await checkMarketHours(pos.instrument.segment);
      if (!marketHours.open) {
        console.log(`⏹️ [CRON] Auto-Cutting closed segment position: ${pos.symbol} (ID: ${pos.id}) for user ${pos.user_id}. Reason: ${marketHours.reason}`);
        
        const exitPrice = pos.instrument.last_price || pos.current_price || 0;
        
        try {
          const { data: result, error: rpcErr } = await supabaseAdmin.rpc('close_position_v2', {
            p_user_id: pos.user_id,
            p_position_id: pos.id,
            p_last_price: parseFloat(exitPrice),
            p_spread_pct: 0,
            p_close_reason: 'eod_settlement'
          });

          if (rpcErr) {
            console.error(`[CRON] Failed to close position ${pos.id} via RPC:`, rpcErr.message);
            continue;
          }

          if (result && result.success) {
            positionsClosed++;
            
            // 1. Invalidate wallet cache
            try {
              const cache = require('../cache');
              cache.delete(`wallet:${pos.user_id}`);
            } catch (err) {}

            // 2. Emit Socket.IO event to update UI in real-time
            try {
              const io = getIO();
              io.of('/user').to(`user:${pos.user_id}`).emit('USER:ORDER_FILLED', {
                position: result.position,
                execution: {
                  executed_price: result.position.current_price,
                  reason: 'EOD_SETTLEMENT'
                }
              });
            } catch (ioErr) {
              console.warn('[CRON] Socket emit failed for auto-cut:', ioErr.message);
            }

            // 3. Send Web Push Notification
            sendPushNotification(pos.user_id, {
              title: '⏹️ Intraday Position Auto-Cut',
              body: `Your position in ${pos.symbol} was squared off at ${exitPrice} due to market close. PnL: ₹${parseFloat(result.position.realized_pnl || 0).toFixed(2)}.`,
              url: '/history'
            }).catch(e => console.warn('[CRON] Push send failed for auto-cut:', e.message));
          }
        } catch (closeErr) {
          console.error(`[CRON] Unexpected error closing position ${pos.id}:`, closeErr.message);
        }
      }
    }

    if (positionsClosed > 0) {
      console.log(`✅ [CRON] EOD Auto-Cut complete. Closed ${positionsClosed} positions.`);
      // Sync execution engine memory
      try {
        const { syncPositions } = require('../../ws/executionEngine');
        await syncPositions();
      } catch (syncErr) {
        console.error('[CRON] Execution engine sync failed after auto-cut:', syncErr.message);
      }
    }
  } catch (err) {
    console.error('❌ [CRON] EOD Auto-Cut process failed:', err);
  }
}

// Run every minute to check and square off positions of closed segments
cron.schedule('*/1 * * * *', () => {
  executeEodAutoCut();
});

module.exports = {
  executeEodAutoCut
};
