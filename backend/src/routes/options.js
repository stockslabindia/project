const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { getUpcomingExpiries } = require('../services/optionSeedService');
const { optionSubscriptionManager } = require('../services/optionSubscriptionManager');
const { authenticateUser } = require('../middleware/auth');
const cache = require('../core/cache');

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
 * Returns ATM ± 7 strikes with live Call & Put market data.
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

    // 1. Fetch current spot/futures price
    let spotPrice = underlying === 'NIFTY' ? 24500 : 52300;
    let spotChange = 0;
    let spotChangePct = 0;

    const { data: indexInst } = await supabaseAdmin
      .from('instruments')
      .select('last_price, base_price, change_amount, change_percent')
      .or(`symbol.eq.${underlying}50,symbol.eq.${underlying},symbol.ilike.${underlying}%FUT,symbol.eq.${underlying}BANK`)
      .limit(1);

    if (indexInst && indexInst.length > 0) {
      const targetInst = indexInst[0];
      spotPrice = Number(targetInst.last_price || targetInst.base_price || spotPrice);
      spotChange = Number(targetInst.change_amount || 0);
      spotChangePct = Number(targetInst.change_percent || 0);
    }


    const strikeGap = underlying === 'NIFTY' ? 50 : 100;
    const atmStrike = Math.round(spotPrice / strikeGap) * strikeGap;

    // Trigger sliding window subscription
    optionSubscriptionManager.setActiveChainView(underlying, expiry, spotPrice).catch(() => {});

    // 2. Fetch option instruments for this underlying & expiry
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

    // Group by strike price
    const strikesMap = new Map();
    const WINDOW_SIZE = 7;

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

    if (optionInsts && optionInsts.length > 0) {
      for (const inst of optionInsts) {
        const strike = Number(inst.strike_price);
        if (strikesMap.has(strike)) {
          const row = strikesMap.get(strike);
          const marketData = {
            id: inst.id,
            symbol: inst.symbol,
            name: inst.name,
            option_type: inst.option_type,
            strike_price: strike,
            expiry_date: inst.expiry_date,
            underlying_symbol: inst.underlying_symbol,
            ltp: Number(inst.last_price || inst.base_price || 100),
            change: Number(inst.change_amount || 0),
            changePercent: Number(inst.change_percent || 0),
            open_interest: Number(inst.open_interest || 1000),
            oi_change: Number(inst.oi_change || 50),
            implied_volatility: Number(inst.implied_volatility || 15.5),
            lot_size: inst.lot_size || (underlying === 'NIFTY' ? 65 : 30)
          };

          if (inst.option_type === 'CE') {
            row.CE = marketData;
          } else if (inst.option_type === 'PE') {
            row.PE = marketData;
          }
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
