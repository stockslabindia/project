-- Migration 047: notification_reads table (Bug #21)
-- Tracks which system notifications each user has read,
-- so the notification badge and read state persist across sessions.

CREATE TABLE IF NOT EXISTS notification_reads (
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_id UUID   NOT NULL REFERENCES system_notifications(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id
  ON notification_reads (user_id);

-- RLS: users can only see and insert their own read records
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_reads" ON notification_reads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_reads" ON notification_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow service role full access (backend uses supabaseAdmin)
CREATE POLICY "service_role_all_reads" ON notification_reads
  FOR ALL USING (auth.role() = 'service_role');
