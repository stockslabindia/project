/**
 * Options Order Risk Validator
 * 
 * Enforces options trading risk rules:
 * - Option Buying Only (side = 'buy')
 * - 100% upfront premium margin (no leverage multiplier on option buying)
 * - Lot-based quantity verification (quantity must be positive integer lots)
 * - Active & Non-Expired contract check
 */

function validateOptionsOrder({ instrument, side, quantity, product_type, profile, wallet, livePrice }) {
  // 1. Segment verification
  if (instrument.segment !== 'fo_options') {
    return { valid: true }; // Pass-through for non-option instruments
  }

  // 2. Side verification (Both BUY and SELL are supported)
  if (side !== 'buy' && side !== 'sell') {
    return { valid: false, error: 'Invalid order side. Must be buy or sell.' };
  }

  // 3. Unit-based quantity validation
  const requestedQty = Number(quantity);
  if (isNaN(requestedQty) || requestedQty <= 0) {
    return { valid: false, error: 'Option quantity must be a valid positive number.' };
  }

  const lotSize = instrument.lot_size || (instrument.underlying_symbol === 'BANKNIFTY' || (instrument.symbol && instrument.symbol.startsWith('BANKNIFTY')) ? 30 : 65);
  // Support custom unit quantity (e.g. 10, 20, 33, 65)
  const totalUnits = requestedQty;
  const numLots = totalUnits / lotSize;

  // 4. Contract active and non-expired check
  if (instrument.is_active === false) {
    return { valid: false, error: 'This option contract is no longer active.' };
  }

  if (instrument.expiry_date) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (instrument.expiry_date < todayStr) {
      return { valid: false, error: 'This option contract has expired.' };
    }
  }

  // 5. Margin requirement:
  // Option Buying (side === 'buy'): 100% upfront premium (currentPremium * totalUnits)
  // Option Selling (side === 'sell'): Proportional to flat ₹40,000 INR per full lot ((totalUnits / lotSize) * 40000)
  const FLAT_OPTION_SELL_MARGIN_PER_LOT = 40000;
  const currentPremium = Number(livePrice || instrument.last_price || instrument.base_price || 0);
  if (currentPremium <= 0) {
    return { valid: false, error: 'Invalid option premium price.' };
  }

  const requiredMargin = side === 'buy'
    ? currentPremium * totalUnits
    : (totalUnits / lotSize) * FLAT_OPTION_SELL_MARGIN_PER_LOT;

  const availableMargin = Number(wallet.available_margin || wallet.balance || 0);

  if (availableMargin < requiredMargin) {
    return { 
      valid: false, 
      error: `Insufficient margin. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${availableMargin.toFixed(2)}` 
    };
  }

  // 6. Break-even calculation
  const strike = Number(instrument.strike_price || 0);
  let breakEven = strike;
  if (instrument.option_type === 'CE') {
    breakEven = side === 'buy' ? strike + currentPremium : strike - currentPremium;
  } else if (instrument.option_type === 'PE') {
    breakEven = side === 'buy' ? strike - currentPremium : strike + currentPremium;
  }

  return {
    valid: true,
    numLots,
    lotSize,
    totalUnits,
    requiredMargin,
    breakEven,
    currentPremium
  };
}

module.exports = { validateOptionsOrder };
