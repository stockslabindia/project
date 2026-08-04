-- Migration: 060_option_quantity_normalization.sql
-- Description: Standardizes explicit lot and unit quantity fields across orders, positions, and trades.

-- 1. Extend orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity_lots NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS quantity_units NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lot_size NUMERIC(15, 4);

-- 2. Extend positions table
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS quantity_lots NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS quantity_units NUMERIC(15, 4);

-- 3. Extend trades table
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS quantity_lots NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS quantity_units NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lot_size NUMERIC(15, 4);

-- 4. Backfill existing records safely
UPDATE public.orders
SET 
  quantity_units = COALESCE(quantity_units, quantity),
  quantity_lots = COALESCE(quantity_lots, CASE WHEN symbol LIKE '%CE' OR symbol LIKE '%PE' THEN quantity ELSE NULL END)
WHERE quantity_units IS NULL;

UPDATE public.positions
SET 
  quantity_units = COALESCE(quantity_units, quantity),
  quantity_lots = COALESCE(quantity_lots, CASE WHEN option_type IS NOT NULL OR symbol LIKE '%CE' OR symbol LIKE '%PE' THEN quantity ELSE NULL END)
WHERE quantity_units IS NULL;

UPDATE public.trades
SET 
  quantity_units = COALESCE(quantity_units, quantity),
  quantity_lots = COALESCE(quantity_lots, CASE WHEN option_type IS NOT NULL OR symbol LIKE '%CE' OR symbol LIKE '%PE' THEN quantity ELSE NULL END)
WHERE quantity_units IS NULL;
