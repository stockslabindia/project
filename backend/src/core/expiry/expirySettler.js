/**
 * Expiry Settler Service
 * 
 * Runs every Tuesday at 15:31 IST to automatically settle open NRML option positions
 * whose expiry date is today.
 * (Note: MIS positions are auto-squared-off at 15:20 IST by the EOD settlement worker).
 */

const { supabaseAdmin } = require('../../config/supabase');
const { feedLogger } = require('../monitoring/logger');
const { sendFinancialAlert } = require('../telegram/alerts/financialAlerts');

async function processOptionsExpirySettlement() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    feedLogger.info(`[EXPIRY_SETTLER] Starting options expiry settlement for ${todayStr}...`);

    // Fetch all open option positions expiring today or earlier
    const { data: openPositions, error } = await supabaseAdmin
      .from('positions')
      .select('*, instruments!inner(*)')
      .eq('status', 'open')
      .eq('product_type', 'overnight') // NRML positions
      .lte('expiry_date', todayStr);

    if (error) {
      feedLogger.error(`[EXPIRY_SETTLER] Failed to fetch open option positions: ${error.message}`);
      return false;
    }

    if (!openPositions || openPositions.length === 0) {
      feedLogger.info('[EXPIRY_SETTLER] No open overnight option positions to settle.');
      return true;
    }

    feedLogger.info(`[EXPIRY_SETTLER] Found ${openPositions.length} open option positions to settle.`);

    for (const pos of openPositions) {
      try {
        const inst = pos.instruments;
        const exitPrice = Number(inst.last_price || 0); // Closing premium
        const entryPrice = Number(pos.entry_price);
        const quantity = Number(pos.quantity);

        // P&L calculation for long options (buy side)
        const grossPnl = (exitPrice - entryPrice) * quantity;
        const netPnl = grossPnl; // Zero fee/dabba model

        // 1. Close position
        await supabaseAdmin
          .from('positions')
          .update({
            status: 'closed',
            close_reason: 'expiry_settlement',
            current_price: exitPrice,
            realized_pnl: netPnl,
            unrealized_pnl: 0,
            closed_at: new Date().toISOString()
          })
          .eq('id', pos.id);

        // 2. Insert trade record
        await supabaseAdmin
          .from('trades')
          .insert({
            user_id: pos.user_id,
            instrument_id: pos.instrument_id,
            position_id: pos.id,
            symbol: pos.symbol,
            side: pos.side,
            quantity: pos.quantity,
            entry_price: entryPrice,
            exit_price: exitPrice,
            gross_pnl: grossPnl,
            net_pnl: netPnl,
            settlement_status: 'settled',
            settled_at: new Date().toISOString(),
            opened_at: pos.opened_at,
            closed_at: new Date().toISOString()
          });

        // 3. Refund margin + net PnL to user wallet
        const marginToRelease = Number(pos.margin_used || 0);
        const totalCredit = marginToRelease + netPnl;

        if (totalCredit !== 0) {
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance, used_margin')
            .eq('user_id', pos.user_id)
            .single();

          if (wallet) {
            const newBalance = Math.max(0, Number(wallet.balance) + netPnl);
            const newUsedMargin = Math.max(0, Number(wallet.used_margin) - marginToRelease);

            await supabaseAdmin
              .from('wallets')
              .update({
                balance: newBalance,
                used_margin: newUsedMargin,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', pos.user_id);

            // Record transaction
            await supabaseAdmin
              .from('wallet_transactions')
              .insert({
                user_id: pos.user_id,
                type: 'trade_pnl',
                amount: netPnl,
                balance_after: newBalance,
                reference_id: pos.id,
                reference_type: 'expiry_settlement',
                description: `Expiry Settlement: ${pos.symbol} @ ₹${exitPrice.toFixed(2)} (PnL: ₹${netPnl.toFixed(2)})`
              });
          }
        }

        feedLogger.info(`[EXPIRY_SETTLER] Settled position ${pos.id} (${pos.symbol}): PnL ₹${netPnl.toFixed(2)}`);
      } catch (posErr) {
        feedLogger.error(`[EXPIRY_SETTLER] Error settling position ${pos.id}: ${posErr.message}`);
      }
    }

    try {
      await sendFinancialAlert({
        title: '📈 Options Expiry Settlement Completed',
        message: `Settled ${openPositions.length} NRML options positions for expiry ${todayStr}.`
      });
    } catch (e) {}

    return true;
  } catch (err) {
    feedLogger.error(`[EXPIRY_SETTLER] Global error in processOptionsExpirySettlement: ${err.message}`);
    return false;
  }
}

module.exports = { processOptionsExpirySettlement };
