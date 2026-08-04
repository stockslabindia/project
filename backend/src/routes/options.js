const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { getUpcomingExpiries } = require('../services/optionSeedService');
const { optionSubscriptionManager } = require('../services/optionSubscriptionManager');
const { getCachedPrice } = require('../core/pnl/mtmCalculator');

/**
 * Calculate dynamic fallback premium for options if live tick isn't available yet.
 * dbPrice comes from Supabase as a string e.g. "100.0000" — always parse before comparing.
 */
function getOptionPremium(underlying, spotPrice, strike, optionType, dbPrice) {
  const parsed = parseFloat(dbPrice);
  // Use DB price if it is a valid, non-stale value (> 0 and not the default seed placeholder 100)
  if (!isNaN(parsed) && parsed > 0 && Math.round(parsed) !== 100) {
    return parsed;
  }

  let intrinsic = 0;
  if (optionType === 'CE') {
    intrinsic = Math.max(0, spotPrice - strike);
  } else {
    intrinsic = Math.max(0, strike - spotPrice);
  }

  const baseTimeValue = underlying === 'NIFTY' ? 140 : 280;
  const distFromAtm = Math.abs(spotPrice - strike);
  const decayFactor = underlying === 'NIFTY' ? 0.12 : 0.08;
  const timeValue = Math.max(10, baseTimeValue - (distFromAtm * decayFactor));

  const premium = Math.round((intrinsic + timeValue) * 20) / 20;
  return Math.max(0.05, premium);
}

/**
 * GET /api/options/expiries
 * Query params: underlying=NIFTY|BANKNIFTY
 * Returns available upcoming expiries with UI labels and monthly flags.
 */
router.get('/expiries', async (req, res) => {
  try {
    const underlying = (req.query.underlying || 'NIFTY').toUpperCase();
    if (!['NIFTY', 'BANKNIFTY'].includes(underlying)) {
      return res.status(400).json({ error: 'Invalid underlying. Must be NIFTY or BANKNIFTY.' });
    }

    const expiries = getUpcomingExpiries(underlying);
    res.json({ underlying, expiries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch option expiries: ' + err.message });
  }
});

/**
 * GET /api/options/chain
 * Query params: underlying=NIFTY|BANKNIFTY, expiry=YYYY-MM-DD
 * Returns ATM ± 7 strikes with Call & Put market data.
 */
router.get('/chain', async (req, res) => {
  try {
    const underlying = (req.query.underlying || 'NIFTY').toUpperCase();
    let expiry = req.query.expiry;

    const validExpiries = getUpcomingExpiries(underlying);
    if (!validExpiries || validExpiries.length === 0) {
      return res.status(500).json({ error: 'No active expiries available.' });
    }

    if (!expiry || !validExpiries.some(e => e.date === expiry)) {
      expiry = validExpiries[0].date;
    }

    // 1. Fetch current spot price
    let spotPrice = underlying === 'NIFTY' ? 24774.30 : 58247.95;
    let spotChange = 0;
    let spotChangePct = 0;

    const { data: indexInst } = await supabaseAdmin
      .from('instruments')
      .select('last_price, base_price, change_amount, change_percent')
      .or(`symbol.eq.${underlying},symbol.eq.${underlying}50,symbol.eq.${underlying}BANK`)
      .order('last_price', { ascending: false })
      .limit(1);

    if (indexInst && indexInst.length > 0) {
      const targetInst = indexInst[0];
      const p = Number(targetInst.last_price || targetInst.base_price || 0);
      if (p > 1000) {
        spotPrice = p;
        spotChange = Number(targetInst.change_amount || 0);
        spotChangePct = Number(targetInst.change_percent || 0);
      }
    }

    const strikeGap = underlying === 'NIFTY' ? 50 : 100;
    const atmStrike = Math.round(spotPrice / strikeGap) * strikeGap;

    // Trigger sliding window subscription for live Fyers feed
    optionSubscriptionManager.setActiveChainView(underlying, expiry, spotPrice).catch(() => {});

    // 2. Fetch option instruments from database for this underlying and expiry
    const { data: optionInsts, error } = await supabaseAdmin
      .from('instruments')
      .select('*')
      .eq('segment', 'fo_options')
      .eq('underlying_symbol', underlying)
      .eq('expiry_date', expiry)
      .eq('is_active', true);

    if (error) {
      return res.status(500).json({ error: 'Database query failed: ' + error.message });
    }

    // Map existing DB instruments by strike + type
    const dbOptionMap = new Map();
    if (optionInsts && optionInsts.length > 0) {
      for (const inst of optionInsts) {
        const key = `${inst.strike_price}_${inst.option_type}`;
        dbOptionMap.set(key, inst);
      }
    }

    // 3. Construct ATM ± 7 strikes grid (15 strikes total)
    const strikesMap = new Map();
    const WINDOW_SIZE = 7;
    const lotSize = underlying === 'NIFTY' ? 65 : 30;

    for (let i = -WINDOW_SIZE; i <= WINDOW_SIZE; i++) {
      const strike = atmStrike + (i * strikeGap);
      if (strike > 0) {
        strikesMap.set(strike, {
          strike,
          isAtm: strike === atmStrike,
          CE: null,
          PE: null
        });
      }
    }

    // Populate CE & PE data for each strike in grid
    for (const [strike, row] of strikesMap.entries()) {
      for (const optionType of ['CE', 'PE']) {
        const key = `${strike}_${optionType}`;
        const dbInst = dbOptionMap.get(key);

        const sym = dbInst ? dbInst.symbol : `${underlying}${expiry.replace(/-/g, '')}${strike}${optionType}`;
        const name = dbInst ? dbInst.name : `${underlying} ${strike} ${optionType}`;

        // Check if Redis has live price tick
        let ltp = 0;
        let change = 0;
        let changePercent = 0;

        try {
          const cached = await getCachedPrice(sym);
          if (cached && cached.ltp) {
            ltp = cached.ltp;
            change = cached.change || 0;
            changePercent = cached.changePercent || 0;
          }
        } catch (e) {}

        if (!ltp || ltp <= 0) {
          ltp = getOptionPremium(underlying, spotPrice, strike, optionType, dbInst?.last_price);
        }

        const marketData = {
          id: dbInst?.id || sym,
          symbol: sym,
          name: name,
          option_type: optionType,
          strike_price: strike,
          expiry_date: expiry,
          underlying_symbol: underlying,
          ltp: Number(ltp.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          open_interest: Number(dbInst?.open_interest || (Math.floor(Math.random() * 50000) + 10000)),
          oi_change: Number(dbInst?.oi_change || (Math.floor(Math.random() * 2000) - 1000)),
          implied_volatility: Number(dbInst?.implied_volatility || (14.5 + Math.random() * 4).toFixed(1)),
          lot_size: lotSize
        };

        if (optionType === 'CE') {
          row.CE = marketData;
        } else {
          row.PE = marketData;
        }
      }
    }

    const strikes = Array.from(strikesMap.values()).sort((a, b) => a.strike - b.strike);

    res.json({
      underlying,
      expiry,
      spotPrice,
      spotChange,
      spotChangePct,
      atmStrike,
      strikeGap,
      expiries: validExpiries,
      strikes
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch option chain: ' + err.message });
  }
});

module.exports = router;
