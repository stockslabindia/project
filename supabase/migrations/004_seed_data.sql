-- ============================================================
-- TradeX — Part 4: Seed Data (Default instruments, settings, admin)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. DEFAULT ADMIN USER
-- ══════════════════════════════════════════════════════════════
-- SECURITY: Admin accounts must NOT be provisioned via migrations.
-- Hardcoded password hashes in source control are a critical security risk.
-- Provision admins securely via the Supabase dashboard or the admin setup script:
--   node backend/scripts/create-admin.js --email admin@stockslab.live --role super_admin
-- ══════════════════════════════════════════════════════════════



-- ══════════════════════════════════════════════════════════════
-- 2. NSE EQUITY INSTRUMENTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO instruments (symbol, name, segment, instrument_type, base_price, last_price, prev_close, lot_size, tick_size, margin_required, max_leverage, exchange, currency) VALUES
  ('RELIANCE', 'Reliance Industries', 'nse_equity', 'spot', 2456.30, 2456.30, 2423.80, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('TCS', 'Tata Consultancy Services', 'nse_equity', 'spot', 3892.15, 3892.15, 3910.55, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('HDFCBANK', 'HDFC Bank', 'nse_equity', 'spot', 1678.90, 1678.90, 1663.70, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('INFY', 'Infosys', 'nse_equity', 'spot', 1542.60, 1542.60, 1550.90, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('ICICIBANK', 'ICICI Bank', 'nse_equity', 'spot', 1123.45, 1123.45, 1100.65, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('WIPRO', 'Wipro Ltd', 'nse_equity', 'spot', 487.20, 487.20, 481.60, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('BAJFINANCE', 'Bajaj Finance', 'nse_equity', 'spot', 7234.50, 7234.50, 7279.70, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('SBIN', 'State Bank of India', 'nse_equity', 'spot', 634.80, 634.80, 622.40, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('TATAMOTORS', 'Tata Motors', 'nse_equity', 'spot', 945.30, 945.30, 948.40, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('KOTAKBANK', 'Kotak Mahindra Bank', 'nse_equity', 'spot', 1845.60, 1845.60, 1832.40, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('HINDUNILVR', 'Hindustan Unilever', 'nse_equity', 'spot', 2567.80, 2567.80, 2549.30, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('LT', 'Larsen & Toubro', 'nse_equity', 'spot', 3456.90, 3456.90, 3478.20, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('MARUTI', 'Maruti Suzuki', 'nse_equity', 'spot', 12345.00, 12345.00, 12290.50, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('ADANIENT', 'Adani Enterprises', 'nse_equity', 'spot', 2890.40, 2890.40, 2845.20, 1, 0.05, 20, 5, 'NSE', 'INR'),
  ('SUNPHARMA', 'Sun Pharma', 'nse_equity', 'spot', 1234.50, 1234.50, 1221.80, 1, 0.05, 20, 5, 'NSE', 'INR')
ON CONFLICT (symbol) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 3. INDEX INSTRUMENTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO instruments (symbol, name, segment, instrument_type, base_price, last_price, prev_close, lot_size, tick_size, margin_required, max_leverage, exchange, currency) VALUES
  ('NIFTY50', 'NIFTY 50 Index', 'fo_futures', 'index', 22456.80, 22456.80, 22314.50, 50, 0.05, 10, 10, 'NSE', 'INR'),
  ('BANKNIFTY', 'Bank NIFTY Index', 'fo_futures', 'index', 48234.50, 48234.50, 48100.00, 25, 0.05, 10, 10, 'NSE', 'INR'),
  ('SENSEX', 'BSE SENSEX', 'fo_futures', 'index', 73890.20, 73890.20, 73650.80, 10, 0.05, 10, 10, 'BSE', 'INR')
ON CONFLICT (symbol) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 4. FOREX INSTRUMENTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO instruments (symbol, name, segment, instrument_type, base_price, last_price, prev_close, lot_size, tick_size, margin_required, max_leverage, exchange, currency, long_swap_rate, short_swap_rate) VALUES
  ('EURUSD', 'Euro / US Dollar', 'forex', 'spot', 1.0876, 1.0876, 1.0853, 1000, 0.0001, 2, 50, 'INTL', 'USD', -0.03, -0.02),
  ('GBPUSD', 'British Pound / USD', 'forex', 'spot', 1.2654, 1.2654, 1.2672, 1000, 0.0001, 2, 50, 'INTL', 'USD', -0.04, -0.01),
  ('USDJPY', 'US Dollar / Yen', 'forex', 'spot', 154.32, 154.32, 153.87, 1000, 0.01, 2, 50, 'INTL', 'USD', -0.02, -0.05),
  ('USDINR', 'US Dollar / Indian Rupee', 'forex', 'spot', 83.42, 83.42, 83.57, 1000, 0.0025, 3, 30, 'NSE', 'INR', -0.03, -0.03),
  ('AUDUSD', 'Australian Dollar / USD', 'forex', 'spot', 0.6543, 0.6543, 0.6508, 1000, 0.0001, 2, 50, 'INTL', 'USD', -0.04, -0.02),
  ('USDCHF', 'US Dollar / Swiss Franc', 'forex', 'spot', 0.8934, 0.8934, 0.8946, 1000, 0.0001, 2, 50, 'INTL', 'USD', -0.01, -0.04)
ON CONFLICT (symbol) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 5. METALS & COMMODITIES
-- ══════════════════════════════════════════════════════════════
INSERT INTO instruments (symbol, name, segment, instrument_type, base_price, last_price, prev_close, lot_size, tick_size, margin_required, max_leverage, exchange, currency) VALUES
  ('XAUUSD', 'Gold / US Dollar', 'mcx', 'spot', 2342.50, 2342.50, 2324.20, 1, 0.01, 5, 20, 'MCX', 'USD'),
  ('XAGUSD', 'Silver / US Dollar', 'mcx', 'spot', 27.84, 27.84, 28.16, 1, 0.01, 5, 20, 'MCX', 'USD'),
  ('CRUDEOIL', 'Crude Oil WTI', 'mcx', 'spot', 78.45, 78.45, 77.90, 100, 0.01, 5, 20, 'MCX', 'USD'),
  ('NATURALGAS', 'Natural Gas', 'mcx', 'spot', 2.34, 2.34, 2.28, 1250, 0.001, 5, 20, 'MCX', 'USD'),
  ('COPPER', 'Copper', 'mcx', 'spot', 4.32, 4.32, 4.24, 1000, 0.001, 5, 20, 'MCX', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 6. DEFAULT MARGIN SETTINGS
-- ══════════════════════════════════════════════════════════════
INSERT INTO margin_settings (segment, name, leverage, margin_required_pct, warning_threshold, margin_call_threshold, auto_liquidation_threshold) VALUES
  ('nse_equity', 'NSE Equity', 5, 20, 80, 85, 95),
  ('fo_futures', 'F&O Futures', 10, 10, 80, 85, 95),
  ('fo_options', 'F&O Options', 10, 10, 80, 85, 95),
  ('mcx', 'MCX Commodities', 20, 5, 80, 85, 95),
  ('forex', 'Forex', 50, 2, 80, 85, 95);

-- ══════════════════════════════════════════════════════════════
-- 7. DEFAULT SPREAD PROFILES
-- ══════════════════════════════════════════════════════════════
INSERT INTO spread_profiles (tier, segment, base_spread_pct, slippage_min_pct, slippage_max_pct, execution_delay_min_ms, execution_delay_max_ms, house_favor_pct) VALUES
  -- Whale — tightest
  ('whale', 'nse_equity', 0.02, 0, 0.01, 0, 50, 55),
  ('whale', 'forex', 0.01, 0, 0.005, 0, 30, 55),
  ('whale', 'mcx', 0.015, 0, 0.01, 0, 40, 55),
  -- Regular — standard
  ('regular', 'nse_equity', 0.05, 0.01, 0.03, 50, 200, 70),
  ('regular', 'forex', 0.03, 0.005, 0.02, 30, 150, 70),
  ('regular', 'mcx', 0.04, 0.01, 0.025, 40, 180, 70),
  -- Retail — wider
  ('retail', 'nse_equity', 0.10, 0.02, 0.08, 100, 500, 80),
  ('retail', 'forex', 0.06, 0.01, 0.05, 80, 400, 80),
  ('retail', 'mcx', 0.08, 0.015, 0.06, 90, 450, 80),
  -- Profitable — widest (house protection)
  ('profitable', 'nse_equity', 0.15, 0.05, 0.15, 200, 1000, 90),
  ('profitable', 'forex', 0.10, 0.03, 0.10, 150, 800, 90),
  ('profitable', 'mcx', 0.12, 0.04, 0.12, 180, 900, 90),
  -- New User — promotional
  ('new_user', 'nse_equity', 0.03, 0, 0.01, 0, 80, 60),
  ('new_user', 'forex', 0.02, 0, 0.008, 0, 50, 60),
  ('new_user', 'mcx', 0.025, 0, 0.01, 0, 60, 60);

-- ══════════════════════════════════════════════════════════════
-- 8. DEFAULT SYSTEM SETTINGS
-- ══════════════════════════════════════════════════════════════
INSERT INTO system_settings (key, value, description, category) VALUES
  ('global_kill_switch', 'false', 'Emergency halt all trading', 'trading'),
  ('market_nse_open', 'true', 'NSE market session status', 'trading'),
  ('market_fo_open', 'true', 'F&O market session status', 'trading'),
  ('market_mcx_open', 'true', 'MCX market session status', 'trading'),
  ('market_forex_open', 'true', 'Forex market session status', 'trading'),
  ('profit_ceiling_enabled', 'true', 'Global profit ceiling system', 'risk'),
  ('default_daily_profit_cap', '50000', 'Default max daily profit per client (INR)', 'risk'),
  ('default_weekly_profit_cap', '200000', 'Default max weekly profit per client (INR)', 'risk'),
  ('auto_square_off_at_ceiling', 'true', 'Auto-close positions when profit ceiling hit', 'risk'),
  ('client_message_at_ceiling', '"Trading paused due to market risk conditions."', 'Message shown to client when cap hit', 'risk'),
  ('news_spread_multiplier', '3', 'Spread multiplier during news events', 'spread'),
  ('volatility_auto_widen', 'true', 'Auto-widen spreads on volatility spike', 'spread'),
  ('withdrawal_auto_approve_limit', '10000', 'Auto-approve withdrawals under this amount', 'finance'),
  ('withdrawal_min_hold_hours', '24', 'Minimum hours to hold withdrawal', 'finance'),
  ('first_withdrawal_hold_hours', '72', 'Hold hours for first-time withdrawal', 'finance'),
  ('gst_rate', '18', 'GST percentage', 'fees'),
  ('stamp_duty_rate', '0.003', 'Stamp duty percentage', 'fees'),
  ('sebi_turnover_fee', '0.0001', 'SEBI turnover fee percentage', 'fees'),
  ('bonus_turnover_multiplier', '30', 'Lot turnover required before bonus withdrawal', 'finance')
ON CONFLICT (key) DO NOTHING;
