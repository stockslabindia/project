-- ═══════════════════════════════════════════════════════
-- Migration 039: Email System Tables
-- ═══════════════════════════════════════════════════════

-- ── 1. email_logs — Audit trail for every email sent ──
CREATE TABLE IF NOT EXISTS email_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email_to        TEXT NOT NULL,
  type            TEXT NOT NULL,        -- 'welcome', 'deposit_approved', 'kyc_rejected', etc.
  subject         TEXT,
  status          TEXT DEFAULT 'sent',  -- 'sent' | 'failed' | 'bounced'
  error_message   TEXT,
  campaign_id     UUID,                 -- FK to bulk_email_campaigns (added after that table)
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. email_preferences — Per-user opt-in/opt-out ──
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  marketing_emails       BOOLEAN DEFAULT TRUE,       -- Bulk/marketing emails
  transactional_emails   BOOLEAN DEFAULT TRUE,       -- Transactional (approval, KYC, etc.)
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. bulk_email_campaigns — Admin-created bulk send records ──
CREATE TABLE IF NOT EXISTS bulk_email_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID,
  type             TEXT NOT NULL,        -- 'maintenance' | 'important_update' | 'custom_bulk'
  subject          TEXT NOT NULL,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  cta_text         TEXT,
  cta_url          TEXT,
  recipient_filter JSONB DEFAULT '{"type":"all"}'::jsonb,
  total_recipients INT DEFAULT 0,
  total_sent       INT DEFAULT 0,
  total_failed     INT DEFAULT 0,
  status           TEXT DEFAULT 'sending',  -- 'sending' | 'completed' | 'failed'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- ── Add FK from email_logs → bulk_email_campaigns ──
ALTER TABLE email_logs
  ADD CONSTRAINT fk_email_logs_campaign
  FOREIGN KEY (campaign_id) REFERENCES bulk_email_campaigns(id) ON DELETE SET NULL;

-- ── Indexes for common queries ──
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id    ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type       ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status     ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at    ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign   ON email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status ON bulk_email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_date   ON bulk_email_campaigns(created_at DESC);

-- ── RLS: Only service role can write; admins read via service role ──
ALTER TABLE email_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_email_campaigns ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all backend operations use supabaseAdmin (service role key)
-- No additional policies needed for backend-only tables

-- Allow users to read & update their own email_preferences
CREATE POLICY "Users can view own email preferences"
  ON email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email preferences"
  ON email_preferences FOR UPDATE
  USING (auth.uid() = user_id);
