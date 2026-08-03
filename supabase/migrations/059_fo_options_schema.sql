-- Migration: 059_fo_options_schema.sql
-- Description: Extends instruments, positions, and trades tables for Indian F&O Options (NIFTY & BANKNIFTY).

-- 1. Extend instruments table with options specific columns
ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS option_type TEXT CHECK (option_type IN ('CE', 'PE')),
  ADD COLUMN IF NOT EXISTS strike_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS underlying_symbol TEXT,
  ADD COLUMN IF NOT EXISTS open_interest BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oi_change BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS implied_volatility NUMERIC(8, 4) DEFAULT 0;

-- 2. Optimize index for option queries
CREATE INDEX IF NOT EXISTS idx_instruments_options_query
  ON public.instruments (underlying_symbol, expiry_date, strike_price, option_type)
  WHERE segment = 'fo_options';

-- 3. Extend positions table for options metadata
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS option_type TEXT,
  ADD COLUMN IF NOT EXISTS strike_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS underlying_symbol TEXT,
  ADD COLUMN IF NOT EXISTS lot_size INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS num_lots INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS premium_paid NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS break_even_price NUMERIC(15, 4);

-- 4. Extend trades table for options metadata
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS option_type TEXT,
  ADD COLUMN IF NOT EXISTS strike_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS underlying_symbol TEXT,
  ADD COLUMN IF NOT EXISTS premium_paid NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS premium_received NUMERIC(15, 4);

COMMENT ON COLUMN public.instruments.option_type IS 'CE = Call Option, PE = Put Option';
COMMENT ON COLUMN public.instruments.underlying_symbol IS 'NIFTY or BANKNIFTY';
