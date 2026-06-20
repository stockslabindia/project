require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

const CRYPTOS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'ETHUSDT', name: 'Ethereum / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'BNBUSDT', name: 'Binance Coin / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.1, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'SOLUSDT', name: 'Solana / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'XRPUSDT', name: 'Ripple / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.0001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'ADAUSDT', name: 'Cardano / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.0001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'DOTUSDT', name: 'Polkadot / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.00001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'AVAXUSDT', name: 'Avalanche / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'MATICUSDT', name: 'Polygon / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.0001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'LINKUSDT', name: 'Chainlink / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'UNIUSDT', name: 'Uniswap / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'LTCUSDT', name: 'Litecoin / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'ATOMUSDT', name: 'Cosmos / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'ETCUSDT', name: 'Ethereum Classic / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'NEARUSDT', name: 'Near Protocol / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'APTUSDT', name: 'Aptos / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'ARBUSDT', name: 'Arbitrum / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.0001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'OPUSDT', name: 'Optimism / Tether', segment: 'crypto', lot_size: 1, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu / Tether', segment: 'crypto', lot_size: 1000, tick_size: 0.000001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' },
  { symbol: 'PEPEUSDT', name: 'Pepe / Tether', segment: 'crypto', lot_size: 10000, tick_size: 0.0000001, margin_required: 5.0, max_leverage: 20.0, exchange: 'BINANCE', currency: 'USDT' }
];

const MCX_COMMODITIES = [
  { symbol: 'GOLD', name: 'Gold Futures', segment: 'mcx', lot_size: 1, tick_size: 1.0, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'GOLDM', name: 'Gold Mini Futures', segment: 'mcx', lot_size: 1, tick_size: 1.0, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'SILVER', name: 'Silver Futures', segment: 'mcx', lot_size: 1, tick_size: 1.0, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'SILVERM', name: 'Silver Mini Futures', segment: 'mcx', lot_size: 1, tick_size: 1.0, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'SILVERMIC', name: 'Silver Micro Futures', segment: 'mcx', lot_size: 1, tick_size: 1.0, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'CRUDEOIL', name: 'Crude Oil Futures', segment: 'mcx', lot_size: 100, tick_size: 1.0, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'NATURALGAS', name: 'Natural Gas Futures', segment: 'mcx', lot_size: 1250, tick_size: 0.1, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'COPPER', name: 'Copper Futures', segment: 'mcx', lot_size: 2500, tick_size: 0.05, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'ALUMINIUM', name: 'Aluminium Futures', segment: 'mcx', lot_size: 5000, tick_size: 0.05, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'LEAD', name: 'Lead Futures', segment: 'mcx', lot_size: 5000, tick_size: 0.05, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'NICKEL', name: 'Nickel Futures', segment: 'mcx', lot_size: 250, tick_size: 0.1, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  { symbol: 'ZINC', name: 'Zinc Futures', segment: 'mcx', lot_size: 5000, tick_size: 0.05, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'INR' },
  // Derived / Spot ones
  { symbol: 'XAUUSD', name: 'Gold Spot USD', segment: 'mcx', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'USD' },
  { symbol: 'XAGUSD', name: 'Silver Spot USD', segment: 'mcx', lot_size: 1, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'USD' },
  { symbol: 'CRUDEOIL_USD', name: 'Crude Oil Spot USD', segment: 'mcx', lot_size: 100, tick_size: 0.01, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'USD' },
  { symbol: 'NATURALGAS_USD', name: 'Natural Gas Spot USD', segment: 'mcx', lot_size: 1250, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'USD' },
  { symbol: 'COPPER_USD', name: 'Copper Spot USD', segment: 'mcx', lot_size: 1000, tick_size: 0.001, margin_required: 5.0, max_leverage: 20.0, exchange: 'MCX', currency: 'USD' }
];

const FOREX = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', segment: 'forex', lot_size: 1000, tick_size: 0.0001, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', segment: 'forex', lot_size: 1000, tick_size: 0.0001, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', segment: 'forex', lot_size: 1000, tick_size: 0.01, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', segment: 'forex', lot_size: 1000, tick_size: 0.0001, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', segment: 'forex', lot_size: 1000, tick_size: 0.0001, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'USDINR', name: 'US Dollar / Indian Rupee', segment: 'forex', lot_size: 1000, tick_size: 0.0025, margin_required: 3.0, max_leverage: 30.0, exchange: 'NSE', currency: 'INR' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', segment: 'forex', lot_size: 1000, tick_size: 0.0001, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', segment: 'forex', lot_size: 1000, tick_size: 0.0001, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'EURJPY', name: 'Euro / Japanese Yen', segment: 'forex', lot_size: 1000, tick_size: 0.01, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', segment: 'forex', lot_size: 1000, tick_size: 0.01, margin_required: 2.0, max_leverage: 50.0, exchange: 'INTL', currency: 'USD' }
];

const US_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'META', name: 'Meta Platforms Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'NFLX', name: 'Netflix Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'INTC', name: 'Intel Corporation', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'V', name: 'Visa Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'WMT', name: 'Walmart Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'DIS', name: 'The Walt Disney Company', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'BA', name: 'The Boeing Company', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'PFE', name: 'Pfizer Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'KO', name: 'The Coca-Cola Company', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'NKE', name: 'Nike Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'PYPL', name: 'PayPal Holdings', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'UBER', name: 'Uber Technologies Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'CRM', name: 'Salesforce Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'ORCL', name: 'Oracle Corporation', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'ADBE', name: 'Adobe Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'COST', name: 'Costco Wholesale Corp.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'ABNB', name: 'Airbnb Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'SQ', name: 'Block Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'SNAP', name: 'Snap Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'SHOP', name: 'Shopify Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'PLTR', name: 'Palantir Technologies', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'RIVN', name: 'Rivian Automotive', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'SOFI', name: 'SoFi Technologies Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'MRNA', name: 'Moderna Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'CVX', name: 'Chevron Corp.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'HD', name: 'Home Depot Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'MA', name: 'Mastercard Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'UNH', name: 'UnitedHealth Group', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'BAC', name: 'Bank of America Corp.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'MCD', name: 'McDonald\'s Corp.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'LLY', name: 'Eli Lilly & Co.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'SBUX', name: 'Starbucks Corp.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'GS', name: 'Goldman Sachs Group', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' },
  { symbol: 'MS', name: 'Morgan Stanley', segment: 'us_equity', lot_size: 1, tick_size: 0.01, margin_required: 10.0, max_leverage: 10.0, exchange: 'US', currency: 'USD' }
];

async function run() {
  try {
    console.log('1. Querying existing symbols from Supabase...');
    const existingSymbols = new Set();
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('instruments')
        .select('symbol')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }
      
      if (data && data.length > 0) {
        data.forEach(d => existingSymbols.add(d.symbol.toUpperCase()));
        console.log(`Fetched page ${page + 1} (${data.length} symbols)`);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }
    console.log(`Found ${existingSymbols.size} existing symbols in database.`);

    const allExtra = [...CRYPTOS, ...MCX_COMMODITIES, ...FOREX];
    const newExtraToInsert = allExtra.filter(item => !existingSymbols.has(item.symbol.toUpperCase()));

    console.log(`Identified ${newExtraToInsert.length} new unique extra instruments to insert.`);

    if (newExtraToInsert.length === 0) {
      console.log('No new extra instruments to insert. Database is already up to date!');
      process.exit(0);
    }

    const rows = newExtraToInsert.map(s => ({
      symbol: s.symbol.toUpperCase(),
      name: s.name,
      segment: s.segment,
      instrument_type: 'spot',
      base_price: 100.0,
      last_price: 100.0,
      bid_price: 100.0,
      ask_price: 100.0,
      day_open: 100.0,
      day_high: 100.0,
      day_low: 100.0,
      prev_close: 100.0,
      change_amount: 0.0,
      change_percent: 0.0,
      volume: 0,
      lot_size: s.lot_size,
      tick_size: s.tick_size,
      margin_required: s.margin_required,
      max_leverage: s.max_leverage,
      base_spread: 0.0,
      spread_multiplier: 1.0,
      circuit_upper_pct: 10.0,
      circuit_lower_pct: 10.0,
      is_active: true,
      trading_enabled: true,
      buy_enabled: true,
      sell_enabled: true,
      long_swap_rate: 0.0,
      short_swap_rate: 0.0,
      exchange: s.exchange,
      currency: s.currency
    }));

    const BATCH_SIZE = 50;
    console.log(`Inserting ${rows.length} rows in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin
        .from('instruments')
        .insert(batch);
        
      if (error) {
        console.error(`Error inserting batch starting at index ${i}:`, error.message);
      } else {
        console.log(`Successfully inserted batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} instruments)`);
      }
    }
    
    console.log('Extra instruments import completed successfully!');
  } catch (err) {
    console.error('Import failed with exception:', err);
  }
  process.exit(0);
}

run();
