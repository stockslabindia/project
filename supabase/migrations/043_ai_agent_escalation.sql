-- ============================================================
-- Migration: 043_ai_agent_escalation.sql
-- Purpose: Support AI agent escalation to admin via Telegram.
--   - ai_escalated:                flags sessions where Riya (AI) could not
--                                  answer and escalated to admin
--   - escalation_telegram_msg_id:  the Telegram message_id of the escalation
--                                  alert so we can thread admin replies back
-- ============================================================

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS ai_escalated              boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_telegram_msg_id bigint   DEFAULT NULL;
