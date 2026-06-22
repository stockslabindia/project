-- Migration: 039_positions_product_type
-- Description: Adds product_type column to positions and orders tables.
-- Intraday positions are auto-squared-off at market close.
-- Overnight (NRML) positions are carried forward.

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'intraday'
    CHECK (product_type IN ('intraday', 'overnight'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'intraday'
    CHECK (product_type IN ('intraday', 'overnight'));

-- Update existing open positions: if segment is forex or crypto they are effectively overnight-capable.
-- For safety, keep all existing positions as 'intraday' (default) so no behaviour changes.

COMMENT ON COLUMN public.positions.product_type IS 'intraday = auto-cut at market close; overnight = NRML, carried forward';
COMMENT ON COLUMN public.orders.product_type IS 'intraday = MIS; overnight = NRML';
