-- ============================================================
-- TradeX Dabba Trading Platform — Core Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Part 1: Core Tables (Users, Wallets, Instruments)
-- ============================================================

-- ── Enable required extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════════════════════
-- 1. USER PROFILES (extends Supabase auth.users)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT UNIQUE NOT NULL DEFAULT ('TDX-' || floor(random() * 90000 + 10000)::int),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  pan_number TEXT,
  aadhar_number TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_pincode TEXT,
  -- KYC
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  kyc_verified_at TIMESTAMPTZ,
  kyc_rejected_reason TEXT,
  -- Account status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked', 'closed')),
  status_reason TEXT,
  -- Tier system
  tier TEXT DEFAULT 'new_user' CHECK (tier IN ('whale', 'regular', 'retail', 'profitable', 'new_user')),
  tier_updated_at TIMESTAMPTZ DEFAULT now(),
  -- Referral
  referral_code TEXT UNIQUE DEFAULT ('REF' || upper(substr(md5(random()::text), 1, 6))),
  referred_by UUID REFERENCES profiles(id),
  -- Trading flags
  trading_enabled BOOLEAN DEFAULT true,
  max_daily_profit NUMERIC(15,2) DEFAULT 50000,
  max_weekly_profit NUMERIC(15,2) DEFAULT 200000,
  profit_ceiling_enabled BOOLEAN DEFAULT true,
  auto_square_off_at_ceiling BOOLEAN DEFAULT true,
  -- Metadata
  last_login_at TIMESTAMPTZ,
  login_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 2. ADMIN USERS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'operator' CHECK (role IN ('super_admin', 'admin', 'operator', 'finance', 'support')),
  department TEXT DEFAULT 'admin' CHECK (department IN ('admin', 'finance', 'customer_service')),
  avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  ip_whitelist TEXT[], -- allowed IPs
  two_factor_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 3. WALLETS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC(15,2) DEFAULT 0 CHECK (balance >= 0),
  equity NUMERIC(15,2) DEFAULT 0,
  used_margin NUMERIC(15,2) DEFAULT 0 CHECK (used_margin >= 0),
  available_margin NUMERIC(15,2) GENERATED ALWAYS AS (balance - used_margin) STORED,
  -- Bonus system
  bonus_balance NUMERIC(15,2) DEFAULT 0,
  bonus_locked BOOLEAN DEFAULT false,
  bonus_turnover_required NUMERIC(15,2) DEFAULT 0,
  bonus_turnover_completed NUMERIC(15,2) DEFAULT 0,
  -- Credit line
  credit_limit NUMERIC(15,2) DEFAULT 0,
  credit_used NUMERIC(15,2) DEFAULT 0 CHECK (credit_used >= 0),
  credit_interest_rate NUMERIC(6,4) DEFAULT 0.0005, -- 0.05% per day
  -- Totals
  total_deposited NUMERIC(15,2) DEFAULT 0,
  total_withdrawn NUMERIC(15,2) DEFAULT 0,
  total_pnl NUMERIC(15,2) DEFAULT 0,
  today_pnl NUMERIC(15,2) DEFAULT 0,
  week_pnl NUMERIC(15,2) DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 4. WALLET TRANSACTIONS (Ledger)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'trade_pnl', 'commission', 'swap_fee', 'bonus', 'adjustment', 'credit', 'credit_interest', 'penalty', 'refund')),
  amount NUMERIC(15,2) NOT NULL, -- positive = credit, negative = debit
  balance_after NUMERIC(15,2) NOT NULL,
  reference_id TEXT, -- links to deposit_id, withdrawal_id, trade_id etc.
  reference_type TEXT, -- 'deposit', 'withdrawal', 'trade', 'admin_action'
  description TEXT,
  admin_id UUID REFERENCES admin_users(id), -- who did it (for manual adjustments)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 5. INSTRUMENTS (Tradeable assets)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT UNIQUE NOT NULL, -- 'RELIANCE', 'NIFTY50', 'XAUUSD'
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('nse_equity', 'bse_equity', 'fo_futures', 'fo_options', 'mcx', 'forex', 'crypto', 'us_equity', 'global_indices')),
  instrument_type TEXT DEFAULT 'spot' CHECK (instrument_type IN ('spot', 'futures', 'options', 'index')),
  -- Pricing
  base_price NUMERIC(15,4) DEFAULT 0,
  last_price NUMERIC(15,4) DEFAULT 0,
  bid_price NUMERIC(15,4) DEFAULT 0,
  ask_price NUMERIC(15,4) DEFAULT 0,
  day_open NUMERIC(15,4) DEFAULT 0,
  day_high NUMERIC(15,4) DEFAULT 0,
  day_low NUMERIC(15,4) DEFAULT 0,
  prev_close NUMERIC(15,4) DEFAULT 0,
  change_amount NUMERIC(15,4) DEFAULT 0,
  change_percent NUMERIC(8,4) DEFAULT 0,
  volume BIGINT DEFAULT 0,
  -- Trading rules
  lot_size INT DEFAULT 1,
  tick_size NUMERIC(10,4) DEFAULT 0.05,
  margin_required NUMERIC(8,4) DEFAULT 20, -- percentage
  max_leverage NUMERIC(6,2) DEFAULT 5,
  -- Spread control (house edge)
  base_spread NUMERIC(10,4) DEFAULT 0,
  spread_multiplier NUMERIC(6,2) DEFAULT 1,
  -- Circuit breakers
  circuit_upper_pct NUMERIC(6,2) DEFAULT 10,
  circuit_lower_pct NUMERIC(6,2) DEFAULT 10,
  circuit_triggered BOOLEAN DEFAULT false,
  -- Status
  is_active BOOLEAN DEFAULT true,
  trading_enabled BOOLEAN DEFAULT true,
  buy_enabled BOOLEAN DEFAULT true,
  sell_enabled BOOLEAN DEFAULT true,
  -- Swap/overnight fees
  long_swap_rate NUMERIC(8,4) DEFAULT -0.045, -- % per day
  short_swap_rate NUMERIC(8,4) DEFAULT -0.035,
  -- Metadata
  exchange TEXT, -- 'NSE', 'BSE', 'MCX', etc.
  currency TEXT DEFAULT 'INR',
  last_price_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 6. INDEXES for performance
-- ══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_referral ON profiles(referral_code);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(reference_id);

CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_segment ON instruments(segment);
CREATE INDEX IF NOT EXISTS idx_instruments_active ON instruments(is_active);

-- ══════════════════════════════════════════════════════════════
-- 7. Auto-create wallet when profile is created
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_wallet_for_new_user();

-- ══════════════════════════════════════════════════════════════
-- 8. Auto-update updated_at timestamp
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER instruments_updated_at BEFORE UPDATE ON instruments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 9. Row Level Security (RLS)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- Users can read their own wallet
CREATE POLICY wallets_select_own ON wallets FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own transactions
CREATE POLICY wallet_tx_select_own ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- Service role (backend) bypasses RLS for admin operations
