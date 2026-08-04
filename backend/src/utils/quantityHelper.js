/**
 * Resolve explicit Lot and Unit quantity model for instruments.
 * 
 * Rules:
 * - For options (segment === 'fo_options' or symbol ending in CE/PE):
 *     requestedQuantity = number of lots (must be > 0)
 *     quantityLots = requestedQuantity
 *     quantityUnits = quantityLots * lotSize
 * - For non-options (equities, crypto, forex, futures, commodities):
 *     requestedQuantity = executable unit quantity
 *     quantityLots = null
 *     quantityUnits = requestedQuantity
 * 
 * @param {Object} params
 * @param {Object} params.instrument - Instrument record
 * @param {number} params.requestedQuantity - Input quantity from client
 * @returns {Object} { quantityLots, quantityUnits, lotSize, displayQuantity }
 */
function resolveOrderQuantity({ instrument, requestedQuantity }) {
  const reqQty = Number(requestedQuantity);
  if (isNaN(reqQty) || reqQty <= 0) {
    throw new Error('Quantity must be a positive number');
  }

  const isOptions = instrument?.segment === 'fo_options' || 
    (instrument?.symbol && (instrument.symbol.endsWith('CE') || instrument.symbol.endsWith('PE')));

  if (isOptions) {
    const lotSize = Number(instrument?.lot_size) || (instrument?.underlying_symbol === 'BANKNIFTY' || (instrument?.symbol && instrument.symbol.startsWith('BANKNIFTY')) ? 30 : 65);
    const quantityUnits = reqQty;
    const quantityLots = Math.round((quantityUnits / lotSize) * 100) / 100;

    return {
      quantityLots,
      quantityUnits,
      lotSize,
      displayQuantity: `${quantityUnits} Qty (${quantityLots} Lot)`
    };
  }

  return {
    quantityLots: null,
    quantityUnits: reqQty,
    lotSize: Number(instrument?.lot_size) || 1,
    displayQuantity: `${reqQty}`
  };
}

module.exports = { resolveOrderQuantity };
