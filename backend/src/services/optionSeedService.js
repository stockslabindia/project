/**
 * Option Seed Service
 * 
 * Manages daily automated seeding and expiry maintenance for NIFTY & BANKNIFTY options.
 * - Runs daily at 07:00 IST (and on server startup).
 * - Computes upcoming Tuesdays for NIFTY (weekly+monthly) and BANKNIFTY (monthly) for 3 months.
 * - Seeds ATM ± 40 strikes per expiry into the `instruments` table.
 * - Auto-hides (`is_active = false`) expired contracts (`expiry_date < CURRENT_DATE`).
 */

const { supabaseAdmin } = require('../config/supabase');
const { feedLogger } = require('../core/monitoring/logger');

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Check if a date is the last Tuesday of its month using UTC date methods.
 */
function isLastTuesdayOfMonth(date) {
  const d = new Date(date);
  if (d.getUTCDay() !== 2) return false; // Must be Tuesday
  const nextWeek = new Date(d);
  nextWeek.setUTCDate(d.getUTCDate() + 7);
  return nextWeek.getUTCMonth() !== d.getUTCMonth();
}

/**
 * Get all Tuesdays in a given year and month (UTC-safe).
 */
function getTuesdaysInMonth(year, month) {
  const tuesdays = [];
  const date = new Date(Date.UTC(year, month, 1));
  
  // Find first Tuesday
  while (date.getUTCDay() !== 2) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  
  // Collect all Tuesdays in month
  while (date.getUTCMonth() === month) {
    tuesdays.push(new Date(date));
    date.setUTCDate(date.getUTCDate() + 7);
  }
  
  return tuesdays;
}

/**
 * Get valid upcoming expiries for NIFTY and BANKNIFTY.
 * Generates current month + next 2 full months (3 months total window).
 */
function getUpcomingExpiries(underlying, now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const expiries = [];
  const todayStr = now.toISOString().split('T')[0];

  // Generate 3 months of expiries (current month + next 2 months)
  const targetMonths = [
    { year: currentYear, month: currentMonth },
    { year: new Date(Date.UTC(currentYear, currentMonth + 1, 1)).getUTCFullYear(), month: new Date(Date.UTC(currentYear, currentMonth + 1, 1)).getUTCMonth() },
    { year: new Date(Date.UTC(currentYear, currentMonth + 2, 1)).getUTCFullYear(), month: new Date(Date.UTC(currentYear, currentMonth + 2, 1)).getUTCMonth() }
  ];

  if (underlying === 'NIFTY') {
    for (const tm of targetMonths) {
      const tuesdays = getTuesdaysInMonth(tm.year, tm.month);
      for (const d of tuesdays) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr >= todayStr) {
          expiries.push({
            date: dateStr,
            dateObj: d,
            isMonthly: isLastTuesdayOfMonth(d),
            label: formatDateLabel(d)
          });
        }
      }
    }
  } else if (underlying === 'BANKNIFTY') {
    for (const tm of targetMonths) {
      const tuesdays = getTuesdaysInMonth(tm.year, tm.month);
      const monthlyTuesday = tuesdays[tuesdays.length - 1];
      if (monthlyTuesday) {
        const dateStr = monthlyTuesday.toISOString().split('T')[0];
        if (dateStr >= todayStr) {
          expiries.push({
            date: dateStr,
            dateObj: monthlyTuesday,
            isMonthly: true,
            label: formatDateLabel(monthlyTuesday)
          });
        }
      }
    }
  }

  return expiries;
}

/**
 * Format date for UI pills e.g. "04 AUG" or "25 AUG"
 */
function formatDateLabel(d) {
  const dateObj = new Date(d);
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES[dateObj.getUTCMonth()];
  return `${day} ${month}`;
}

/**
 * Generate Fyers symbol string for an option contract (UTC-safe).
 */
function generateFyersOptionSymbol(underlying, expiryDateObj, strike, type) {
  const d = new Date(expiryDateObj);
  const yy = String(d.getUTCFullYear()).slice(2);
  const m = d.getUTCMonth() + 1;
  const isMonthly = isLastTuesdayOfMonth(d);

  if (isMonthly) {
    const monStr = MONTH_NAMES[d.getUTCMonth()];
    return `NSE:${underlying}${yy}${monStr}${strike}${type}`;
  } else {
    let monthChar = String(m);
    if (m === 10) monthChar = 'O';
    if (m === 11) monthChar = 'N';
    if (m === 12) monthChar = 'D';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `NSE:${underlying}${yy}${monthChar}${dd}${strike}${type}`;
  }
}

/**
 * Calculate realistic initial option premium based on intrinsic + time value.
 */
function calculateInitialOptionPremium(underlying, spotPrice, strike, type) {
  let intrinsic = 0;
  if (type === 'CE') {
    intrinsic = Math.max(0, spotPrice - strike);
  } else {
    intrinsic = Math.max(0, strike - spotPrice);
  }

  const baseTimeValue = underlying === 'NIFTY' ? 140 : 280;
  const distFromAtm = Math.abs(spotPrice - strike);
  const decayFactor = underlying === 'NIFTY' ? 0.12 : 0.08;
  const timeValue = Math.max(10, baseTimeValue - (distFromAtm * decayFactor));

  const premium = Math.round((intrinsic + timeValue) * 20) / 20; // 0.05 tick size
  return Math.max(0.05, premium);
}

/**
 * Seed strikes for NIFTY and BANKNIFTY.
 */
async function seedOptionContracts() {
  try {
    feedLogger.info('[OPTION_SEED] Starting daily option contract seeding and expiry maintenance...');

    let niftyPrice = 24774.30;
    let bankNiftyPrice = 58247.95;

    try {
      // Query exact live spot instruments from DB
      const { data: spotData } = await supabaseAdmin
        .from('instruments')
        .select('symbol, last_price, base_price')
        .in('symbol', ['NIFTY', 'NIFTY50', 'BANKNIFTY']);

      if (spotData && spotData.length > 0) {
        const nInst = spotData.find(i => i.symbol === 'NIFTY' && Number(i.last_price || i.base_price) > 20000)
                   || spotData.find(i => i.symbol === 'NIFTY50' && Number(i.last_price || i.base_price) > 20000);
        const bnInst = spotData.find(i => i.symbol === 'BANKNIFTY' && Number(i.last_price || i.base_price) > 30000);

        if (nInst?.last_price || nInst?.base_price) niftyPrice = Number(nInst.last_price || nInst.base_price);
        if (bnInst?.last_price || bnInst?.base_price) bankNiftyPrice = Number(bnInst.last_price || bnInst.base_price);
      }
    } catch (e) {
      feedLogger.warn(`[OPTION_SEED] Could not fetch live spot price, using default ATM: ${e.message}`);
    }

    // Also update stale NIFTY50 spot price to match live NIFTY price
    await supabaseAdmin
      .from('instruments')
      .update({ last_price: niftyPrice, base_price: niftyPrice })
      .eq('symbol', 'NIFTY50');

    const configs = [
      { underlying: 'NIFTY', spotPrice: niftyPrice, strikeGap: 50, lotSize: 65 },
      { underlying: 'BANKNIFTY', spotPrice: bankNiftyPrice, strikeGap: 100, lotSize: 30 }
    ];

    const recordsToUpsert = [];

    for (const cfg of configs) {
      const expiries = getUpcomingExpiries(cfg.underlying);
      const atmStrike = Math.round(cfg.spotPrice / cfg.strikeGap) * cfg.strikeGap;
      const BUFFER_COUNT = 40; // Pre-seed ATM ± 40 strikes to cover all market ranges

      for (const exp of expiries) {
        for (let i = -BUFFER_COUNT; i <= BUFFER_COUNT; i++) {
          const strike = atmStrike + (i * cfg.strikeGap);
          if (strike <= 0) continue;

          for (const optionType of ['CE', 'PE']) {
            const fyersSymbol = generateFyersOptionSymbol(cfg.underlying, exp.dateObj, strike, optionType);
            const internalSymbol = fyersSymbol.replace('NSE:', '');
            const contractName = `${cfg.underlying} ${exp.label} ${strike} ${optionType}`;
            const initialPrice = calculateInitialOptionPremium(cfg.underlying, cfg.spotPrice, strike, optionType);

            recordsToUpsert.push({
              symbol: internalSymbol,
              name: contractName,
              segment: 'fo_options',
              instrument_type: 'options',
              option_type: optionType,
              strike_price: strike,
              expiry_date: exp.date,
              underlying_symbol: cfg.underlying,
              base_price: initialPrice,
              last_price: initialPrice,
              lot_size: cfg.lotSize,
              tick_size: 0.05,
              margin_required: initialPrice * cfg.lotSize,
              max_leverage: 1,
              exchange: 'NSE',
              currency: 'INR',
              is_active: true,
              trading_enabled: true
            });
          }
        }
      }
    }

    if (recordsToUpsert.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
        const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin
          .from('instruments')
          .upsert(batch, { onConflict: 'symbol' });
          
        if (error) {
          feedLogger.error(`[OPTION_SEED] Error upserting batch: ${error.message}`);
        }
      }
      feedLogger.info(`[OPTION_SEED] Successfully seeded ${recordsToUpsert.length} option contracts.`);
    }

    // Auto-hide (deactivate) expired options
    const todayStr = new Date().toISOString().split('T')[0];
    const { error: expireErr } = await supabaseAdmin
      .from('instruments')
      .update({ is_active: false, trading_enabled: false })
      .eq('segment', 'fo_options')
      .lt('expiry_date', todayStr);

    if (expireErr) {
      feedLogger.error(`[OPTION_SEED] Error deactivating expired options: ${expireErr.message}`);
    } else {
      feedLogger.info('[OPTION_SEED] Auto-hide completed for expired options.');
    }

    return true;
  } catch (err) {
    feedLogger.error(`[OPTION_SEED] Exception in seedOptionContracts: ${err.message}`);
    return false;
  }
}

module.exports = {
  seedOptionContracts,
  getUpcomingExpiries,
  generateFyersOptionSymbol,
  isLastTuesdayOfMonth
};
