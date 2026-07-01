require('dotenv').config();
const { fyersFeed } = require('../src/services/fyersFeed');

function test(symbol, expectedFyers, expectedReverse) {
  const fyers = fyersFeed._dynamicFyersSymbol(symbol);
  const rev = fyersFeed._reverseResolveDynamic(fyers);
  
  console.log(`Symbol: ${symbol}`);
  console.log(`  Dynamic Fyers: ${fyers} (Expected: ${expectedFyers}) - Match: ${fyers === expectedFyers}`);
  console.log(`  Reverse Resolve: ${rev} (Expected: ${expectedReverse}) - Match: ${rev === expectedReverse}`);
}

console.log('--- Testing Fyers Symbol Resolution ---');
test('NIFTY26JULFUT', 'NSE:NIFTY26JULFUT', 'NIFTY26JULFUT');
test('BANKNIFTY26JULFUT', 'NSE:BANKNIFTY26JULFUT', 'BANKNIFTY26JULFUT');
test('RELIANCE', 'NSE:RELIANCE-EQ', 'RELIANCE');
test('INFY', 'NSE:INFY-EQ', 'INFY');

console.log('\n--- Checking Static Map ---');
console.log('NIFTY26JULFUT in map:', fyersFeed._dynamicFyersSymbol('NIFTY26JULFUT'));
console.log('BANKNIFTY26JULFUT in map:', fyersFeed._dynamicFyersSymbol('BANKNIFTY26JULFUT'));
process.exit(0);
