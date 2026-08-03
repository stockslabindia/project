/**
 * Option Seed Service
 * 
 * Manages daily automated seeding and expiry maintenance for NIFTY & BANKNIFTY options.
 * - Runs daily at 07:00 IST (and on server startup).
 * - Computes upcoming Tuesdays for NIFTY (weekly+monthly) and BANKNIFTY (monthly).
 * - Seeds ATM ± 20 strikes per expiry into the `instruments` table.
 * - Sets `is_active = false` for expired contracts (expiry_date < CURRENT_DATE).
 */

const axios = require('axios');
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
 * Current month remaining + next full month.
 */
function getUpcomingExpiries(underlying, now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  
  const nextMonthDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth();

  const expiries = [];
  const todayStr = now.toISOString().split('T')[0];

  if (underlying === 'NIFTY') {
    // NIFTY has weekly + monthly (all Tuesdays)
    const currentMonthTuesdays = getTuesdaysInMonth(currentYear, currentMonth);
    const nextMonthTuesdays = getTuesdaysInMonth(nextYear, nextMonth);

    const allTuesdays = [...currentMonthTuesdays, ...nextMonthTuesdays];
    for (const d of allTuesdays) {
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
  } else if (underlying === 'BANKNIFTY') {
    // BANKNIFTY has monthly only (last Tuesday of month)
    const currentMonthTuesdays = getTuesdaysInMonth(currentYear, currentMonth);
    const nextMonthTuesdays = getTuesdaysInMonth(nextYear, nextMonth);

    const currentMonthly = currentMonthTuesdays[currentMonthTuesdays.length - 1];
    const nextMonthly = nextMonthTuesdays[nextMonthTuesdays.length - 1];

    [currentMonthly, nextMonthly].forEach(d => {
      if (d) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr >= todayStr) {
          expiries.push({
            date: dateStr,
            dateObj: d,
            isMonthly: true,
            label: formatDateLabel(d)
          });
        }
      }
    });
  }

  return expiries;
}

/**
 * Format date for UI pills e.g. "05 Aug" or "26 Aug"
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
 * Seed strikes for a specific underlying and expiries.
 */
async function seedOptionContracts() {
  try {
    feedLogger.info('[OPTION_SEED] Starting daily option contract seeding and expiry maintenance...');

    // 1. Get current underlying prices
    let niftyPrice = 24500;
    let bankNiftyPrice = 52300;

    try {
      const { data: spotData } = await supabaseAdmin
        .from('instruments')
        .select('symbol, last_price, base_price')
        .or('symbol.eq.NIFTY50,symbol.eq.BANKNIFTY,symbol.ilike.NIFTY%FUT,symbol.ilike.BANKNIFTY%FUT');

      if (spotData && spotData.length > 0) {
        const nInst = spotData.find(i => i.symbol.includes('NIFTY') && !i.symbol.includes('BANK'));
        const bnInst = spotData.find(i => i.symbol.includes('BANKNIFTY'));
        if (nInst?.last_price || nInst?.base_price) niftyPrice = Number(nInst.last_price || nInst.base_price);
        if (bnInst?.last_price || bnInst?.base_price) bankNiftyPrice = Number(bnInst.last_price || bnInst.base_price);
      }
    } catch (e) {
      feedLogger.warn(`[OPTION_SEED] Could not fetch live spot price, using fallback ATM: ${e.message}`);
    }

    const configs = [
      { underlying: 'NIFTY', spotPrice: niftyPrice, strikeGap: 50, lotSize: 65 },
      { underlying: 'BANKNIFTY', spotPrice: bankNiftyPrice, strikeGap: 100, lotSize: 30 }
    ];

    const recordsToUpsert = [];

    for (const cfg of configs) {
      const expiries = getUpcomingExpiries(cfg.underlying);
      const atmStrike = Math.round(cfg.spotPrice / cfg.strikeGap) * cfg.strikeGap;
      const BUFFER_COUNT = 20; // Pre-seed ATM ± 20 strikes

      for (const exp of expiries) {
        for (let i = -BUFFER_COUNT; i <= BUFFER_COUNT; i++) {
          const strike = atmStrike + (i * cfg.strikeGap);
          if (strike <= 0) continue;

          for (const optionType of ['CE', 'PE']) {
            const fyersSymbol = generateFyersOptionSymbol(cfg.underlying, exp.dateObj, strike, optionType);
            const internalSymbol = fyersSymbol.replace('NSE:', '');
            const contractName = `${cfg.underlying} ${exp.label} ${strike} ${optionType}`;

            recordsToUpsert.push({
              symbol: internalSymbol,
              name: contractName,
              segment: 'fo_options',
              instrument_type: 'options',
              option_type: optionType,
              strike_price: strike,
              expiry_date: exp.date,
              underlying_symbol: cfg.underlying,
              base_price: 100,
              last_price: 100,
              lot_size: cfg.lotSize,
              tick_size: 0.05,
              margin_required: 100, // 100% premium
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
      // Upsert in batches of 500
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

    // 2. Auto-hide (deactivate) expired options
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
