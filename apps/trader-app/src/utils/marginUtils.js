/**
 * Margin Calculator Utility for Frontend
 * Applies dynamic leverage rules based on segment and product type.
 */

export function getDynamicMarginRequired(instrument, productType) {
  if (!instrument) return 10.0;
  
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
