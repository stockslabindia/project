-- Add dynamic intraday and holding margin requirements
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS margin_required_intraday NUMERIC DEFAULT 10;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS margin_required_holding NUMERIC DEFAULT 10;

-- Drop the old column if it's no longer needed (optional, keeping it for now as a fallback is safer)
-- We will keep the old column but stop using it, or populate it to match holding.

-- Seed specific user rules for NSE Equity
UPDATE instruments SET margin_required_intraday = 0.2, margin_required_holding = 2.0 WHERE segment = 'nse_equity';
UPDATE instruments SET margin_required_intraday = 0.2, margin_required_holding = 2.0 WHERE segment = 'bse_equity';

-- Seed specific user rules for F&O Futures (Nifty, BankNifty, Sensex)
UPDATE instruments SET margin_required_intraday = 5.0, margin_required_holding = 10.0 WHERE segment = 'fo_futures';
UPDATE instruments SET margin_required_intraday = 5.0, margin_required_holding = 10.0 WHERE segment = 'fo_options';

-- Seed specific user rules for US Stocks
UPDATE instruments SET margin_required_intraday = 1.0, margin_required_holding = 1.0 WHERE exchange = 'US';

-- Seed specific user rules for Global Indices
UPDATE instruments SET margin_required_intraday = 1.0, margin_required_holding = 1.0 WHERE exchange = 'INDEX';

-- Seed specific user rules for Forex
UPDATE instruments SET margin_required_intraday = 1.0, margin_required_holding = 1.0 WHERE segment = 'forex' OR exchange = 'FOREX' OR exchange = 'INTL';

-- Seed specific user rules for MCX
UPDATE instruments SET margin_required_intraday = 0.2, margin_required_holding = 5.0 WHERE segment = 'mcx' OR exchange = 'MCX';

-- Seed specific user rules for Crypto
UPDATE instruments SET margin_required_intraday = 0.5, margin_required_holding = 0.5 WHERE segment = 'crypto' OR exchange = 'CRYPTO';
