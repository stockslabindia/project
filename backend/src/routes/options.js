const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { getUpcomingExpiries, generateFyersOptionSymbol } = require('../services/optionSeedService');
const { optionSubscriptionManager } = require('../services/optionSubscriptionManager');
const { getCachedPrice } = require('../core/pnl/mtmCalculator');

/**
 * Calculate dynamic fallback premium for options if live tick isn't available yet.
 * dbPrice comes from Supabase as a string e.g. "100.0000" — always parse before comparing.
 */
function getOptionPremium(underlying, spotPrice, strike, optionType, expiryDate) {
  let intrinsic = 0;
  if (optionType === 'CE') {
    intrinsic = Math.max(0, spotPrice - strike);
  } else {
    intrinsic = Math.max(0, strike - spotPrice);
  }

  // Calculate Days To Expiry (DTE)
  let dte = 1;
  if (expiryDate) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expDate = new Date(expiryDate);
    expDate.setUTCHours(0, 0, 0, 0);
    const diffMs = expDate - today;
    dte = Math.max(0.5, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Time value scales with sqrt(DTE) per Black-Scholes model
  const dailyAtmTimeVal = underlying === 'NIFTY' ? 45 : 95;
  const baseTimeValue = dailyAtmTimeVal * Math.sqrt(dte);

  const distFromAtm = Math.abs(spotPrice - strike);
  const decayFactor = underlying === 'NIFTY' ? (0.10 * Math.sqrt(dte)) : (0.07 * Math.sqrt(dte));
  const minTimeVal = Math.max(2, 5 * Math.sqrt(dte));
  const timeValue = Math.max(minTimeVal, baseTimeValue - (distFromAtm * decayFactor));

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

    // Collect all symbol targets for concurrent Redis lookup
    const symbolList = [];
    const symbolMap = new Map();

    for (const [strike, row] of strikesMap.entries()) {
      for (const optionType of ['CE', 'PE']) {
        const key = `${strike}_${optionType}`;
        const dbInst = dbOptionMap.get(key);
        const fallbackSym = generateFyersOptionSymbol(underlying, expiry, strike, optionType).replace('NSE:', '');
        const sym = dbInst ? dbInst.symbol : fallbackSym;
        symbolList.push(sym);
        symbolMap.set(`${strike}_${optionType}`, { sym, dbInst });
      }
    }

    // High-performance parallel multi-lookup
    const priceResults = await Promise.all(
      symbolList.map(sym => getCachedPrice(sym).catch(() => null))
    );

    const priceCacheMap = new Map();
    symbolList.forEach((sym, idx) => {
      if (priceResults[idx]) priceCacheMap.set(sym, priceResults[idx]);
    });

    // Populate CE & PE data for each strike in grid instantly
    for (const [strike, row] of strikesMap.entries()) {
      for (const optionType of ['CE', 'PE']) {
        const { sym, dbInst } = symbolMap.get(`${strike}_${optionType}`);
        const name = dbInst ? dbInst.name : `${underlying} ${strike} ${optionType}`;

        const cached = priceCacheMap.get(sym);
        let ltp = cached?.ltp || 0;
        let change = cached?.change || 0;
        let changePercent = cached?.changePercent || 0;

        if (!ltp || ltp <= 0) {
          ltp = getOptionPremium(underlying, spotPrice, strike, optionType, expiry);
        }

        const seed = (strike * 17 + (optionType === 'CE' ? 100 : 200)) % 50000;
        const stableOI = 15000 + (seed % 35000);
        const stableOiChange = ((seed % 1500) - 750);
        const stableIV = (14.0 + ((seed % 50) / 10)).toFixed(1);

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
          open_interest: Number(dbInst?.open_interest || stableOI),
          oi_change: Number(dbInst?.oi_change || stableOiChange),
          implied_volatility: Number(dbInst?.implied_volatility || stableIV),
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
