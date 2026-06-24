/**
 * Margin Calculator Utility
 * Applies dynamic leverage rules based on segment and product type.
 */

const MIN_CAPITAL_INR = 400;
const MIN_CAPITAL_USD = 400;

function getDynamicMarginRequired(instrument, productType) {
  const isIntraday = productType === 'intraday';
  const segment = instrument.segment;
  const exchange = instrument.exchange;

  // Rule 2: Nifty and Bank Nifty (fo_futures)
  if (segment === 'fo_futures' || segment === 'fo_options') {
    return isIntraday ? 5.0 : 10.0; // 20x Intraday, 10x Overnight
  }

  // Rule 1: NSE Equity (nse_equity, bse_equity)
  if (segment === 'nse_equity' || segment === 'bse_equity') {
    return isIntraday ? 0.2 : 2.0; // 500x Intraday, 50x Overnight
  }

  // Rule 3: US Stocks
  if (exchange === 'US') {
    return 1.0; // 100x Intraday & Holding
  }

  // Rule 4: Forex & Global Indices
  if (segment === 'forex' || exchange === 'FOREX' || exchange === 'INDEX' || exchange === 'INTL') {
    return 1.0; // 100x Intraday & Holding
  }

  // Rule 5: MCX
  if (segment === 'mcx' || exchange === 'MCX') {
    return isIntraday ? 0.2 : 5.0; // 500x Intraday, 20x Overnight
  }

  // Rule 6: Crypto
  if (segment === 'crypto' || exchange === 'CRYPTO') {
    return 0.5; // 200x Intraday & Holding
  }

  // Fallback to database value or default 10x
  return parseFloat(instrument.margin_required) || 10.0;
}

/**
 * Calculate minimum quantity to enforce minimum capital per trade.
 * Formula: min_qty = ceil(MIN_CAPITAL / (price × margin_pct / 100))
 * 
 * Examples (Intraday):
 *   HDFCBANK ₹793, 0.2% margin → ceil(400 / 1.586) = 253
 *   RELIANCE ₹1300, 0.2% margin → ceil(400 / 2.6)  = 154
 * 
 * Examples (Holding):
 *   HDFCBANK ₹793, 2.0% margin → ceil(400 / 15.86) = 26
 *   RELIANCE ₹1300, 2.0% margin → ceil(400 / 26)   = 16
 */
function getMinQuantity(instrument, productType) {
  const marginPct = getDynamicMarginRequired(instrument, productType);
  const price = parseFloat(instrument.last_price) || 0;
  if (price <= 0 || marginPct <= 0) return 1;

  const isUSD = ['US', 'FOREX', 'INDEX', 'INTL', 'CRYPTO'].includes(instrument.exchange);
  const minCapital = isUSD ? MIN_CAPITAL_USD : MIN_CAPITAL_INR;
  const marginPerUnit = price * (marginPct / 100);

  return Math.max(1, Math.ceil(minCapital / marginPerUnit));
}

module.exports = {
  getDynamicMarginRequired,
  getMinQuantity,
  MIN_CAPITAL_INR,
  MIN_CAPITAL_USD
};
