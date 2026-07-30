const { supabaseAdmin } = require('../../config/supabase');

/**
 * Weekly Affiliate Net Loss Share Calculation Job
 * 
 * Runs weekly (e.g. Sunday at 23:59:00 UTC) to compute net realized loss across 
 * all referred traders for each active affiliate over the past 7 days.
 * 
 * Formula:
 *   Traders Total Net Realized PnL = SUM(closed trades net_pnl)
 *   If Traders Total Net Realized PnL < 0 (i.e. Net Loss):
 *     Affiliate Commission = ABS(Net PnL) * (affiliate.net_loss_share_pct / 100)
 */
async function processWeeklyAffiliateNetLossShare() {
  console.log('[Affiliate Weekly Job] 🔄 Starting Weekly Net Loss Share calculation...');
  try {
    const { data: config } = await supabaseAdmin
      .from('referral_reward_config')
      .select('affiliate_program_active, affiliate_net_loss_share_pct')
      .eq('id', 1)
      .single();

    if (!config || !config.affiliate_program_active) {
      console.log('[Affiliate Weekly Job] Affiliate program is inactive. Skipping.');
      return;
    }

    // Determine past 7 days time range
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDateIso = weekAgo.toISOString();
    const endDateIso = now.toISOString();

    // Fetch all active affiliates
    const { data: affiliates, error: affErr } = await supabaseAdmin
      .from('affiliate_accounts')
      .select('id, name, affiliate_code, net_loss_share_pct, pending_balance, total_earnings')
      .eq('status', 'active');

    if (affErr || !affiliates || affiliates.length === 0) {
      console.log('[Affiliate Weekly Job] No active affiliates found.');
      return;
    }

    let processedCount = 0;
    let totalCommissionsCredited = 0;

    for (const aff of affiliates) {
      // 1. Get referred traders under this affiliate
      const { data: traders } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('affiliate_id', aff.id);

      if (!traders || traders.length === 0) continue;

      const traderIds = traders.map(t => t.id);

      // 2. Fetch all trades closed in the past week for these traders
      const { data: closedTrades } = await supabaseAdmin
        .from('trades')
        .select('id, user_id, net_pnl, closed_at')
        .in('user_id', traderIds)
        .gte('closed_at', startDateIso)
        .lte('closed_at', endDateIso);

      if (!closedTrades || closedTrades.length === 0) continue;

      // 3. Compute net realized PnL across all referred traders
      const netTradersPnl = closedTrades.reduce((sum, tr) => sum + parseFloat(tr.net_pnl || 0), 0);

      // We only pay commission if traders suffered a NET LOSS (netTradersPnl < 0)
      if (netTradersPnl < 0) {
        const totalNetLoss = Math.abs(netTradersPnl);
        const lossSharePct = parseFloat(aff.net_loss_share_pct ?? config.affiliate_net_loss_share_pct ?? 10);
        const commissionAmount = Math.round(((totalNetLoss * lossSharePct) / 100) * 100) / 100;

        if (commissionAmount > 0) {
          // Record commission entry
          await supabaseAdmin.from('affiliate_commissions').insert({
            affiliate_id: aff.id,
            referred_user_id: traderIds[0], // Representative referred user ID
            commission_type: 'net_loss_share',
            source_id: aff.id, // Using affiliate ID as source_id for weekly summary batch
            source_amount: totalNetLoss,
            commission_pct: lossSharePct,
            commission_amount: commissionAmount,
            status: 'pending',
            notes: `Weekly Net Loss Share (${startDateIso.split('T')[0]} to ${endDateIso.split('T')[0]}): Total trader net loss ₹${totalNetLoss.toLocaleString('en-IN')}`
          });

          // Update affiliate balances
          const newPending = parseFloat(aff.pending_balance || 0) + commissionAmount;
          const newTotal = parseFloat(aff.total_earnings || 0) + commissionAmount;

          await supabaseAdmin.from('affiliate_accounts').update({
            pending_balance: newPending,
            total_earnings: newTotal,
          }).eq('id', aff.id);

          processedCount++;
          totalCommissionsCredited += commissionAmount;

          console.log(`[Affiliate Weekly Job] ✅ Affiliate ${aff.name} (${aff.affiliate_code}): Net Trader Loss = ₹${totalNetLoss.toFixed(2)}, Earned ${lossSharePct}% = ₹${commissionAmount}`);
        }
      } else {
        console.log(`[Affiliate Weekly Job] ℹ️ Affiliate ${aff.name} (${aff.affiliate_code}): Net Traders PnL was +₹${netTradersPnl.toFixed(2)} (Profit). No loss share payout this week.`);
      }
    }

    console.log(`[Affiliate Weekly Job] 🎉 Completed. Processed ${processedCount} affiliates with ₹${totalCommissionsCredited} credited.`);
  } catch (err) {
    console.error('[Affiliate Weekly Job Error]', err.message);
  }
}

// Schedule to run every Sunday at 23:59:00 (Weekly cycle close)
const cron = require('node-cron');
cron.schedule('59 23 * * 0', () => {
  processWeeklyAffiliateNetLossShare();
});

module.exports = { processWeeklyAffiliateNetLossShare };
