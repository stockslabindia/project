-- Create ohlc_1m table to persist 1-minute historical candles
create table if not exists public.ohlc_1m (
  symbol      text         not null,
  bucket_time timestamptz  not null,
  timeframe   text         not null default '1m',
  open        numeric(20,6) not null,
  high        numeric(20,6) not null,
  low         numeric(20,6) not null,
  close       numeric(20,6) not null,
  volume      bigint        not null default 0,
  primary key (symbol, bucket_time)
);

-- Index for fast symbol + time range queries
create index if not exists ohlc_1m_symbol_time_idx
  on public.ohlc_1m (symbol, bucket_time desc);

-- Enable Row-Level Security (public read is fine since no PII)
alter table public.ohlc_1m enable row level security;

-- Allow public read access
create policy "Allow public read" on public.ohlc_1m for select using (true);
