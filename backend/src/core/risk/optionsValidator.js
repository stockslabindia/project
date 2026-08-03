/**
 * Options Order Risk Validator
 * 
 * Enforces options trading risk rules:
 * - Option Buying Only (side = 'buy')
 * - 100% upfront premium margin (no leverage multiplier on option buying)
 * - Lot-based quantity verification (quantity must be positive integer lots)
 * - Active & Non-Expired contract check
 */

function validateOptionsOrder({ instrument, side, quantity, product_type, profile, wallet }) {
  // 1. Segment verification
  if (instrument.segment !== 'fo_options') {
    return { valid: true }; // Pass-through for non-option instruments
  }

  // 2. Buy side enforcement
  if (side !== 'buy') {
    return { valid: false, error: 'Option writing/selling is disabled. Only Option Buying (CE/PE) is allowed.' };
  }

  // 3. Lot-based quantity validation
  const numLots = Number(quantity);
  if (!Number.isInteger(numLots) || numLots <= 0) {
    return { valid: false, error: 'Option quantity must be a valid positive integer number of lots.' };
  }

  const lotSize = instrument.lot_size || (instrument.underlying_symbol === 'NIFTY' ? 65 : 30);
  const totalUnits = numLots * lotSize;

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

  // 5. Margin requirement (100% upfront premium)
  const currentPremium = Number(instrument.last_price || instrument.base_price || 0);
  if (currentPremium <= 0) {
    return { valid: false, error: 'Invalid option premium price.' };
  }

  const requiredMargin = currentPremium * totalUnits;
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
    breakEven = strike + currentPremium;
  } else if (instrument.option_type === 'PE') {
    breakEven = strike - currentPremium;
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
