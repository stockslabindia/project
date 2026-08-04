const { supabaseAdmin } = require('../../config/supabase');

/**
 * Helper to check if a specific segment is currently open for trading.
 * Returns { open: boolean, reason: string|null }
 */
async function checkMarketHours(segment) {
  const now = new Date();
  
  // Get current date string in IST: YYYY-MM-DD
  const istDateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  // Format: MM/DD/YYYY to YYYY-MM-DD
  const [mm, dd, yyyy] = istDateStr.split('/');
  const todayIST = `${yyyy}-${mm}-${dd}`;

  // Get current weekday and time in IST
  const dayOfWeekStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now); // "Mon", "Tue", etc.
  const isWeekend = ['Sat', 'Sun'].includes(dayOfWeekStr);
  
  const timeParts = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
  const istHour = parseInt(timeParts[0]);
  const istMinute = parseInt(timeParts[1]);
  const timeInMinutes = istHour * 60 + istMinute;

  // 1. Query market_control table for segment status/timings
  try {
    const { data: session } = await supabaseAdmin
      .from('market_control')
      .select('*')
      .eq('segment', segment)
      .maybeSingle();

    if (session) {
      if (session.trading_status === 'halted' || session.manual_halt) {
        return { open: false, reason: `Trading for segment '${segment.replace('_', ' ').toUpperCase()}' is currently halted by administration.` };
      }
      if (session.trading_status === 'closed') {
        return { open: false, reason: `Trading for segment '${segment.replace('_', ' ').toUpperCase()}' is closed by administration.` };
      }
      
      if (session.start_time && session.end_time) {
        const startParts = session.start_time.split(':');
        const endParts = session.end_time.split(':');
        const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        
        if (segment !== 'crypto') {
          if (timeInMinutes < startMin || timeInMinutes > endMin) {
            const prettySegment = segment.replace('_', ' ').toUpperCase();
            return { 
              open: false, 
              reason: `${prettySegment} trading is allowed only between ${session.start_time.slice(0, 5)} and ${session.end_time.slice(0, 5)} IST.` 
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[MarketHours] market_control check failed:', err.message);
  }

  // 1b. Crypto: 24/7
  if (segment === 'crypto') {
    return { open: true };
  }

  // 2. Holiday Calendar check (NSE, MCX)
  if (['nse_equity', 'fo_futures', 'fo_options', 'mcx'].includes(segment)) {
    try {
      const exchange = segment === 'mcx' ? 'MCX' : 'NSE';
      const { data: holiday } = await supabaseAdmin
        .from('market_holidays')
        .select('*')
        .eq('holiday_date', todayIST)
        .eq('exchange', exchange)
        .maybeSingle();

      if (holiday) {
        return { open: false, reason: `Trading is closed today due to holiday: ${holiday.description || 'Market Holiday'}.` };
      }
    } catch (err) {
      console.warn('[MarketHours] Holiday check failed:', err.message);
    }
  }

  // 3. Indian Equities & Futures/Options (NSE): Mon-Fri 09:15 to 15:30
  if (['nse_equity', 'fo_futures', 'fo_options'].includes(segment)) {
    if (isWeekend) {
      return { open: false, reason: 'NSE trading is closed on weekends.' };
    }
    if (timeInMinutes < 555 || timeInMinutes > 930) {
      return { open: false, reason: 'NSE trading hours are Monday to Friday, 09:15 AM to 03:30 PM IST.' };
    }
    return { open: true };
  }

  // 4. MCX Commodities: Mon-Fri 09:00 to 23:30
  if (segment === 'mcx') {
    if (isWeekend) {
      return { open: false, reason: 'MCX trading is closed on weekends.' };
    }
    if (timeInMinutes < 540 || timeInMinutes > 1410) {
      return { open: false, reason: 'MCX trading hours are Monday to Friday, 09:00 AM to 11:30 PM IST.' };
    }
    return { open: true };
  }

  // 5. Forex & Global Indices: Mon-Fri 24h
  if (['forex', 'global_indices'].includes(segment)) {
    if (isWeekend) {
      if (dayOfWeekStr === 'Sat' && timeInMinutes > 150) { // Saturday after 2:30 AM IST
        return { open: false, reason: 'Forex markets are closed on weekends.' };
      }
      if (dayOfWeekStr === 'Sun') {
        return { open: false, reason: 'Forex markets are closed on weekends.' };
      }
      if (dayOfWeekStr === 'Mon' && timeInMinutes < 150) { // Monday before 2:30 AM IST
        return { open: false, reason: 'Forex markets are closed on weekends.' };
      }
    }
    return { open: true };
  }

  // 6. US Equity (NYSE/NASDAQ): Mon-Fri 9:30 AM to 4:00 PM Eastern Time
  if (segment === 'us_equity') {
    const usDayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
    if (['Sat', 'Sun'].includes(usDayOfWeek)) {
      return { open: false, reason: 'US Equity markets are closed on weekends.' };
    }
    
    const usTimeParts = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
    const usHour = parseInt(usTimeParts[0]);
    const usMinute = parseInt(usTimeParts[1]);
    const usTimeInMinutes = usHour * 60 + usMinute;
    
    if (usTimeInMinutes < 570 || usTimeInMinutes > 960) {
      return { open: false, reason: 'US Equity trading hours are Monday to Friday, 09:30 AM to 04:00 PM Eastern Time.' };
    }
    return { open: true };
  }

  return { open: true };
}

module.exports = {
  checkMarketHours
};
