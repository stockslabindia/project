-- ============================================================
-- Migration: 040_support_chat.sql
-- Purpose: Customer Support Chat System
--   - agent_availability: admin-controlled agent online/offline
--   - chat_sessions:      one per live support session (full QA audit)
--   - chat_messages:      every message in a session
--   - trouble_tickets:    manually raised by agents from within chat
-- ============================================================

-- ── Sequence for human-readable TT numbers ──────────────────
CREATE SEQUENCE IF NOT EXISTS tt_seq START 1000;

-- ── 1. agent_availability ───────────────────────────────────
-- Controlled ONLY by admin login. Agents cannot self-toggle.
CREATE TABLE IF NOT EXISTS agent_availability (
  agent_id          uuid PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  is_online         boolean       NOT NULL DEFAULT false,
  toggled_by        uuid          REFERENCES admin_users(id),   -- which admin last toggled
  toggled_at        timestamptz   NOT NULL DEFAULT now(),
  active_chat_count int           NOT NULL DEFAULT 0            -- live count maintained by triggers
);

-- ── 2. chat_sessions ────────────────────────────────────────
-- One row per support session. Stores full QA audit trail:
--   agent_id + customer_id + topic + duration + transcript
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id                uuid          REFERENCES admin_users(id) ON DELETE SET NULL,
  status                  text          NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting', 'active', 'ended')),
  topic                   text,           -- e.g. "Deposit > Paid amount not added"
  bot_transcript          jsonb,          -- full bot Q&A before agent joined
  session_duration_seconds int,           -- calculated when session ends
  started_at              timestamptz   NOT NULL DEFAULT now(),   -- when user requested agent
  agent_joined_at         timestamptz,                            -- when agent clicked Accept
  ended_at                timestamptz,
  ended_by                text          CHECK (ended_by IN ('user', 'agent'))
);

-- ── 3. chat_messages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_type     text        NOT NULL CHECK (sender_type IN ('bot', 'user', 'agent', 'system')),
  sender_id       uuid,       -- null for bot/system messages
  message         text        NOT NULL,
  message_type    text        NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text', 'options', 'system')),
  options         jsonb,      -- [{label, value, next}] for bot pill buttons
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 4. trouble_tickets ──────────────────────────────────────
-- Manually raised by agents from within a live chat.
-- Admin reviews & closes these in the Tickets tab.
CREATE TABLE IF NOT EXISTS trouble_tickets (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       text    UNIQUE NOT NULL
                        DEFAULT ('TT-' || nextval('tt_seq')::text),
  session_id          uuid    REFERENCES chat_sessions(id) ON DELETE SET NULL,
  customer_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  raised_by_agent_id  uuid    NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  category            text    NOT NULL
                        CHECK (category IN ('deposit','withdrawal','trading','kyc','account','other')),
  priority            text    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low','medium','high','urgent')),
  description         text    NOT NULL,
  status              text    NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','pending_approval','resolved','closed')),
  admin_notes         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  closed_by           uuid    REFERENCES admin_users(id)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer    ON chat_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent       ON chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status      ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session     ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_trouble_tickets_customer  ON trouble_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_trouble_tickets_agent     ON trouble_tickets(raised_by_agent_id);
CREATE INDEX IF NOT EXISTS idx_trouble_tickets_session   ON trouble_tickets(session_id);
CREATE INDEX IF NOT EXISTS idx_trouble_tickets_status    ON trouble_tickets(status);

-- ── Trigger: auto-update active_chat_count on agent_availability ──
CREATE OR REPLACE FUNCTION update_agent_chat_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate active_chat_count for the affected agent
  IF TG_OP = 'UPDATE' AND NEW.agent_id IS NOT NULL THEN
    UPDATE agent_availability
    SET active_chat_count = (
      SELECT COUNT(*) FROM chat_sessions
      WHERE agent_id = NEW.agent_id AND status = 'active'
    )
    WHERE agent_id = NEW.agent_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.agent_id IS NOT NULL AND OLD.agent_id IS DISTINCT FROM NEW.agent_id THEN
    UPDATE agent_availability
    SET active_chat_count = (
      SELECT COUNT(*) FROM chat_sessions
      WHERE agent_id = OLD.agent_id AND status = 'active'
    )
    WHERE agent_id = OLD.agent_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_agent_chat_count
  AFTER UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_chat_count();

-- ── Trigger: auto-update trouble_tickets.updated_at ──────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trouble_tickets_updated_at
  BEFORE UPDATE ON trouble_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE chat_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trouble_tickets  ENABLE ROW LEVEL SECURITY;
-- agent_availability is admin-only, no public RLS needed

-- Users can only see their own sessions
CREATE POLICY "users_own_sessions" ON chat_sessions
  FOR ALL TO authenticated
  USING (customer_id = auth.uid());

-- Users can only read messages from their own sessions
CREATE POLICY "users_read_own_messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE customer_id = auth.uid()
    )
  );

-- Users can insert messages into their own active sessions
CREATE POLICY "users_insert_own_messages" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions
      WHERE customer_id = auth.uid() AND status = 'active'
    )
    AND sender_type IN ('user', 'bot', 'system')
  );

-- Users can see trouble tickets for their own sessions (read-only — so they know TT was raised)
CREATE POLICY "users_read_own_tickets" ON trouble_tickets
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- ── Auto-create agent_availability row when a new admin_user is added ──
CREATE OR REPLACE FUNCTION create_agent_availability()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_availability (agent_id, is_online, active_chat_count)
  VALUES (NEW.id, false, 0)
  ON CONFLICT (agent_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_agent_availability
  AFTER INSERT ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION create_agent_availability();

-- Backfill existing admin users
INSERT INTO agent_availability (agent_id, is_online, active_chat_count)
SELECT id, false, 0 FROM admin_users
ON CONFLICT (agent_id) DO NOTHING;
