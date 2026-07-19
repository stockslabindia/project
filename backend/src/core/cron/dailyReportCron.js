const cron = require('node-cron');
const { supabaseAdmin } = require('../../config/supabase');
const { sendDailySummary } = require('../telegram/alerts/reportAlerts');

// Run every day at 11:59 PM IST
cron.schedule('59 23 * * *', async () => {
  try {
    console.log('[Cron] Generating Daily Telegram Report...');
    
    // Get stats for the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: newUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);

    const { data: deposits } = await supabaseAdmin
      .from('deposit_requests')
      .select('amount')
      .eq('status', 'approved')
      .gte('created_at', yesterday);

    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('amount')
      .eq('status', 'approved')
      .gte('created_at', yesterday);

    const { count: openTickets } = await supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['waiting', 'active']);

    const totalDeposits = deposits ? deposits.reduce((acc, curr) => acc + curr.amount, 0) : 0;
    const totalWithdrawals = withdrawals ? withdrawals.reduce((acc, curr) => acc + curr.amount, 0) : 0;

    await sendDailySummary({
      newUsers: newUsers || 0,
      totalDeposits,
      totalWithdrawals,
      openTickets: openTickets || 0
    });

  } catch (err) {
    console.error('[Cron] Daily Report generation failed:', err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});
